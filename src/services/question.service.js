// services/question.service.js
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const mongoose = require('mongoose');

/**
 * List questions with filters and pagination
 */
const listQuestions = async (filter, options) => {
    try {
        const {
            page,
            limit,
            sort,
            populate
        } = options;

        const query = Question.find(filter);

        if (populate) {
            populate.forEach(pop => query.populate(pop));
        }

        query.sort(sort);
        query.limit(limit);
        query.skip((page - 1) * limit);

        const [docs, total] = await Promise.all([
            query.exec(),
            Question.countDocuments(filter)
        ]);

        return {
            docs,
            totalDocs: total,
            limit,
            page,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
        };
    } catch (error) {
        throw new Error(`Error listing questions: ${error.message}`);
    }
};

/**
 * Get question by ID
 */
const getQuestionById = async (id) => {
    try {
        return await Question.findById(id)
            .populate('subject', 'name description')
            .populate('author', 'name email');
    } catch (error) {
        throw new Error(`Error fetching question: ${error.message}`);
    }
};

/**
 * Create a new question
 */
const createQuestion = async (questionData) => {
    try {
        const question = new Question(questionData);
        await question.save();

        return await question.populate([
            { path: 'subject', select: 'name description' },
            { path: 'author', select: 'name email' }
        ]);
    } catch (error) {
        throw new Error(`Error creating question: ${error.message}`);
    }
};

/**
 * Update question
 */
const updateQuestion = async (id, updateData) => {
    try {
        return await Question.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('subject', 'name description')
            .populate('author', 'name email');
    } catch (error) {
        throw new Error(`Error updating question: ${error.message}`);
    }
};

/**
 * Delete question
 */
const deleteQuestion = async (id) => {
    try {
        return await Question.findByIdAndDelete(id);
    } catch (error) {
        throw new Error(`Error deleting question: ${error.message}`);
    }
};

/**
 * Validate question data based on type
 */
const validateQuestionData = (data) => {
    const { type, choices, correct } = data;

    // MCQ validations
    if (type === 'mcq_single' || type === 'mcq_multi') {
        if (!choices || choices.length < 2) {
            return 'MCQ questions must have at least 2 choices';
        }

        if (!correct || (Array.isArray(correct) && correct.length === 0)) {
            return 'MCQ questions must have correct answer(s) specified';
        }

        if (type === 'mcq_single' && Array.isArray(correct) && correct.length > 1) {
            return 'Single choice MCQ can only have one correct answer';
        }

        // Validate that correct answer IDs exist in choices
        const choiceIds = choices.map(c => c.id);
        const correctArray = Array.isArray(correct) ? correct : [correct];

        for (const correctId of correctArray) {
            if (!choiceIds.includes(correctId)) {
                return `Correct answer ID '${correctId}' not found in choices`;
            }
        }
    }

    // Numeric validations
    if (type === 'numeric' && (correct === null || correct === undefined)) {
        return 'Numeric questions must have a correct answer specified';
    }

    return null; // No validation errors
};

/**
 * Process choices for MCQ questions
 * Mark choices as correct based on correct answer array
 */
const processChoices = (choices, correct) => {
    const correctArray = Array.isArray(correct) ? correct : [correct];

    return choices.map(choice => ({
        ...choice,
        isCorrect: correctArray.includes(choice.id)
    }));
};

/**
 * Sanitize question for student view
 * Remove correct answers and sensitive data
 */
const sanitizeForStudent = (question) => {
    const questionObj = question.toObject ? question.toObject() : question;

    // Remove correct answers
    delete questionObj.correct;

    // Remove isCorrect flag from choices
    if (questionObj.choices) {
        questionObj.choices = questionObj.choices.map(choice => ({
            id: choice.id,
            text: choice.text
        }));
    }

    // Remove explanation (shown only after attempt)
    delete questionObj.explanation;

    // Remove usage stats
    delete questionObj.timesUsed;
    delete questionObj.averageScore;

    return questionObj;
};

/**
 * Check if question is used in any active quiz
 */
const isQuestionUsedInActiveQuiz = async (questionId) => {
    try {
        const count = await Quiz.countDocuments({
            questionIds: questionId,
            isPublished: true,
            $or: [
                { endTime: { $exists: false } },
                { endTime: { $gt: new Date() } }
            ]
        });

        return count > 0;
    } catch (error) {
        throw new Error(`Error checking question usage: ${error.message}`);
    }
};

/**
 * Bulk import questions
 */
const bulkImportQuestions = async (questions, authorId) => {
    const results = {
        successful: 0,
        failed: 0,
        errors: [],
        questions: []
    };

    for (let i = 0; i < questions.length; i++) {
        try {
            const questionData = {
                ...questions[i],
                author: authorId
            };

            // Validate
            const validationError = validateQuestionData(questionData);
            if (validationError) {
                results.failed++;
                results.errors.push({
                    index: i,
                    error: validationError,
                    data: questions[i]
                });
                continue;
            }

            // Process choices
            if (['mcq_single', 'mcq_multi'].includes(questionData.type)) {
                questionData.choices = processChoices(
                    questionData.choices,
                    questionData.correct
                );
            }

            const question = await createQuestion(questionData);
            results.successful++;
            results.questions.push(question);
        } catch (error) {
            results.failed++;
            results.errors.push({
                index: i,
                error: error.message,
                data: questions[i]
            });
        }
    }

    return results;
};

/**
 * Get question statistics from attempts
 */
const getQuestionStatistics = async (questionId) => {
    try {
        const QuizAttempt = require('../models/QuizAttempt');

        const stats = await QuizAttempt.aggregate([
            { $match: { status: { $in: ['auto_graded', 'submitted'] } } },
            { $unwind: '$rawAnswers' },
            { $match: { 'rawAnswers.questionId': mongoose.Types.ObjectId(questionId) } },
            {
                $group: {
                    _id: '$rawAnswers.questionId',
                    totalAttempts: { $sum: 1 },
                    averageScore: { $avg: '$rawAnswers.score' },
                    maxScore: { $max: '$rawAnswers.score' },
                    minScore: { $min: '$rawAnswers.score' }
                }
            }
        ]);

        if (stats.length === 0) {
            return null;
        }

        return stats[0];
    } catch (error) {
        throw new Error(`Error fetching question statistics: ${error.message}`);
    }
};

module.exports = {
    listQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    validateQuestionData,
    processChoices,
    sanitizeForStudent,
    isQuestionUsedInActiveQuiz,
    bulkImportQuestions,
    getQuestionStatistics
};