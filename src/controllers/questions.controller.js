// controllers/questions.controller.js
const questionService = require('../services/question.service');
const logger = require('../config/logger');

/**
 * List questions with filtering, pagination, and search
 * GET /api/questions
 */
const listQuestions = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            subject,
            type,
            difficulty,
            tags,
            search,
            author,
            isActive,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object
        const filter = {};

        if (subject) filter.subject = subject;
        if (type) filter.type = type;
        if (difficulty) filter.difficulty = difficulty;
        if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
        if (author) filter.author = author;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        // Search in prompt and explanation
        if (search) {
            filter.$or = [
                { prompt: { $regex: search, $options: 'i' } },
                { explanation: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }

        // Students should only see active questions
        if (req.user.role === 'student') {
            filter.isActive = true;
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
            populate: [
                { path: 'subject', select: 'name description' },
                { path: 'author', select: 'name email' }
            ]
        };

        const result = await questionService.listQuestions(filter, options);

        // Strip sensitive data for students
        if (req.user.role === 'student') {
            result.docs = result.docs.map(q => questionService.sanitizeForStudent(q));
        }

        res.status(200).json({
            success: true,
            data: result.docs,
            pagination: {
                total: result.totalDocs,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            }
        });
    } catch (error) {
        logger.error('Error listing questions:', error);
        next(error);
    }
};

/**
 * Get a single question by ID
 * GET /api/questions/:id
 */
const getQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;

        const question = await questionService.getQuestionById(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                error: 'Question not found'
            });
        }

        // Check if student is trying to access inactive question
        if (req.user.role === 'student' && !question.isActive) {
            return res.status(404).json({
                success: false,
                error: 'Question not found'
            });
        }

        // Sanitize for students (remove correct answers)
        const responseData = req.user.role === 'student'
            ? questionService.sanitizeForStudent(question)
            : question;

        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        logger.error('Error fetching question:', error);
        next(error);
    }
};

/**
 * Create a new question
 * POST /api/questions
 * Trainer/Admin only
 */
const createQuestion = async (req, res, next) => {
    try {
        const questionData = {
            ...req.body,
            author: req.userId
        };

        // Validate question type-specific requirements
        const validationError = questionService.validateQuestionData(questionData);
        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        // Process choices for MCQ questions
        if (['mcq_single', 'mcq_multi'].includes(questionData.type)) {
            questionData.choices = questionService.processChoices(
                questionData.choices,
                questionData.correct
            );
        }

        const question = await questionService.createQuestion(questionData);

        logger.info(`Question created: ${question._id} by user ${req.userId}`);

        res.status(201).json({
            success: true,
            data: question,
            message: 'Question created successfully'
        });
    } catch (error) {
        logger.error('Error creating question:', error);
        next(error);
    }
};

/**
 * Update an existing question
 * PUT /api/questions/:id
 * Trainer/Admin only
 */
const updateQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check if question exists
        const existingQuestion = await questionService.getQuestionById(id);
        if (!existingQuestion) {
            return res.status(404).json({
                success: false,
                error: 'Question not found'
            });
        }

        // Check ownership for trainers (admins can update any)
        // if (req.user.role === 'trainer' &&
        //     existingQuestion.author.toString() !== req.userId.toString()) {
        //     return res.status(403).json({
        //         success: false,
        //         error: 'You can only update your own questions'
        //     });
        // }
        console.log("Author:", String(existingQuestion.author));
        console.log("Logged-in user:", String(req.userId));
        // if (
        //     req.user.role === 'trainer' &&
        //     String(existingQuestion.author) !== String(req.userId)
        // ) {
        //     return res.status(403).json({
        //         success: false,
        //         error: 'You can only update your own questions'
        //     });
        // }
        const authorId = existingQuestion.author._id
            ? existingQuestion.author._id.toString()
            : existingQuestion.author.toString();

        if (req.user.role === 'trainer' && authorId !== String(req.userId)) {
            return res.status(403).json({
                success: false,
                error: 'You can only update your own questions'
            });
        }


        // Validate updated data
        const mergedData = { ...existingQuestion.toObject(), ...updateData };
        const validationError = questionService.validateQuestionData(mergedData);
        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        // Process choices if being updated
        if (updateData.choices && ['mcq_single', 'mcq_multi'].includes(
            updateData.type || existingQuestion.type
        )) {
            updateData.choices = questionService.processChoices(
                updateData.choices,
                updateData.correct || existingQuestion.correct
            );
        }

        const updatedQuestion = await questionService.updateQuestion(id, updateData);

        logger.info(`Question updated: ${id} by user ${req.userId}`);

        res.status(200).json({
            success: true,
            data: updatedQuestion,
            message: 'Question updated successfully'
        });
    } catch (error) {
        logger.error('Error updating question:', error);
        next(error);
    }
};

/**
 * Delete a question
 * DELETE /api/questions/:id
 * Admin only
 */
const deleteQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Check if question exists
        const question = await questionService.getQuestionById(id);
        if (!question) {
            return res.status(404).json({
                success: false,
                error: "Question not found",
            });
        }

        // 2. Permission check
        // Admin → can delete anything
        // Trainer → can delete only their own question
        if (req.user.role === "trainer") {

            const authorId =
                typeof question.author === "object"
                    ? question.author._id
                    : question.author;

            if (authorId.toString() !== req.userId.toString()) {
                return res.status(403).json({
                    success: false,
                    error: "You are not authorized to delete this question.",
                });
            }
        }


        // 3. Check if question is used in active quiz
        const isUsedInQuiz = await questionService.isQuestionUsedInActiveQuiz(id);

        if (isUsedInQuiz) {
            return res.status(400).json({
                success: false,
                error: "Cannot delete question that is used in active quizzes. Deactivate it instead.",
            });
        }

        // 4. Soft delete (recommended)
        // await questionService.updateQuestion(id, { isActive: false });
        await questionService.deleteQuestion(id);

        logger.info(
            `Question ${id} soft deleted by ${req.user.role} (${req.userId})`
        );

        return res.status(200).json({
            success: true,
            message: "Question deactivated successfully",
        });

    } catch (error) {
        logger.error("Error deleting question:", error);
        next(error);
    }
};


/**
 * Bulk import questions
 * POST /api/questions/bulk-import
 * Trainer/Admin only
 */
const bulkImportQuestions = async (req, res, next) => {
    try {
        const { questions } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Questions array is required'
            });
        }

        const results = await questionService.bulkImportQuestions(
            questions,
            req.userId
        );

        logger.info(`Bulk import: ${results.successful} questions imported by user ${req.userId}`);

        res.status(200).json({
            success: true,
            data: {
                successful: results.successful,
                failed: results.failed,
                errors: results.errors,
                questions: results.questions
            },
            message: `${results.successful} questions imported successfully`
        });
    } catch (error) {
        logger.error('Error bulk importing questions:', error);
        next(error);
    }
};

/**
 * Get question statistics
 * GET /api/questions/:id/statistics
 * Trainer/Admin only
 */
const getQuestionStatistics = async (req, res, next) => {
    try {
        const { id } = req.params;

        const stats = await questionService.getQuestionStatistics(id);

        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Question not found or no statistics available'
            });
        }

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error fetching question statistics:', error);
        next(error);
    }
};

/**
 * Verify a question (mark as reviewed and approved)
 * PATCH /api/questions/:id/verify
 * Admin only
 */
const verifyQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;

        const question = await questionService.updateQuestion(id, {
            isVerified: true
        });

        if (!question) {
            return res.status(404).json({
                success: false,
                error: 'Question not found'
            });
        }

        logger.info(`Question verified: ${id} by admin ${req.userId}`);

        res.status(200).json({
            success: true,
            data: question,
            message: 'Question verified successfully'
        });
    } catch (error) {
        logger.error('Error verifying question:', error);
        next(error);
    }
};

module.exports = {
    listQuestions,
    getQuestion,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    bulkImportQuestions,
    getQuestionStatistics,
    verifyQuestion
};
