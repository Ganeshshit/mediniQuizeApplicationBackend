// controllers/quizzes.controller.js
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const Subject = require('../models/Subject');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const QuizEnrollment = require('../models/QuizEnrollment');
class QuizzesController {
    /**
   * GET /api/quizzes
   * Students see:
   *  - ONLY published quizzes
   *  - FULL details ONLY if enrolled
   *  - Otherwise basic details with isEnrolled=false
   */
    async listQuizzes(req, res, next) {
        try {
            const {
                page = 1,
                limit = 10,
                subject,
                search,
                published
            } = req.query;

            const query = {};

            // TRAINERS / ADMINS SEE EVERYTHING
            if (req.user && (req.user.role === "trainer" || req.user.role === "admin")) {
                if (published !== undefined) {
                    query.isPublished = published === "true";
                }
            }
            else {
                // STUDENTS SEE ONLY PUBLISHED QUIZZES
                query.isPublished = true;
            }

            // Subject filter
            if (subject) query.subject = subject;

            // Search filter
            if (search) {
                query.title = { $regex: search, $options: "i" };
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Fetch quizzes
            const [quizzes, total] = await Promise.all([
                Quiz.find(query)
                    .populate("subject", "name")
                    .populate("createdBy", "name email")
                    .select("-questionIds -questionPoolFilter")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                Quiz.countDocuments(query)
            ]);

            // ================================
            // STUDENT SPECIAL RESPONSE
            // ================================
            if (req.user && req.user.role === "student") {
                const studentId = req.user._id;

                const QuizEnrollment = require('../models/QuizEnrollment');

                const result = [];

                for (const quiz of quizzes) {
                    const quizObj = quiz.toObject();

                    // Check enrollment
                    const enrollment = await QuizEnrollment.findOne({
                        quiz: quiz._id,
                        student: studentId
                    });

                    const isEnrolled = !!enrollment;

                    // Load attempt count
                    const attemptCount = await QuizAttempt.countDocuments({
                        quiz: quiz._id,
                        user: studentId
                    });

                    // BASIC info for non-enrolled students
                    if (!isEnrolled) {
                        result.push({
                            _id: quiz._id,
                            title: quiz.title,
                            description: quiz.description,
                            subject: quiz.subject,
                            isEnrolled: false
                        });
                    }
                    else {
                        // FULL student-safe details for enrolled users
                        result.push({
                            ...quizObj,
                            isEnrolled: true,
                            userAttemptCount: attemptCount,
                            attemptsRemaining: quiz.attemptsAllowed - attemptCount
                        });
                    }
                }

                return res.json({
                    success: true,
                    data: result,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    }
                });
            }

            // ===================================
            // TRAINERS / ADMINS NORMAL RESPONSE
            // ===================================
            return res.json({
                success: true,
                data: quizzes,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            logger.error("List quizzes error:", error);
            next(error);
        }
    }
    /**
     * GET /api/quizzes/:id
     * Get quiz details (students don't see correct answers)
     */
    async getQuiz(req, res, next) {
        try {
            const { id } = req.params;

            const quiz = await Quiz.findById(id)
                .populate('subject', 'name description')
                .populate('createdBy', 'name email');

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // ======================================================
            // STUDENT ACCESS CONTROL (ENROLLMENT + CONDITIONS)
            // ======================================================
            if (req.user.role === 'student') {
                const QuizEnrollment = require('../models/QuizEnrollment');

                const studentId = req.user._id;

                // 🔥 Check enrollment
                const enrollment = await QuizEnrollment.findOne({
                    quiz: quiz._id,
                    student: studentId
                });

                const isEnrolled = !!enrollment;

                // ================================
                // CASE 1 → NOT ENROLLED
                // ================================
                if (!isEnrolled) {
                    return res.json({
                        success: true,
                        data: {
                            _id: quiz._id,
                            title: quiz.title,
                            description: quiz.description,
                            subject: quiz.subject,
                            isEnrolled: false,
                            enrollmentRequired: true,
                            message: "Enroll to view full quiz details."
                        }
                    });
                }

                // ================================
                // CASE 2 → QUIZ NOT PUBLISHED
                // ================================
                if (!quiz.isPublished) {
                    return res.status(403).json({
                        success: false,
                        error: 'Quiz is not published'
                    });
                }

                // ================================
                // CASE 3 → TIME WINDOW CHECK
                // ================================
                const now = new Date();
                if (now < quiz.startTime || now > quiz.endTime) {
                    return res.status(403).json({
                        success: false,
                        error: 'Quiz is not available at this time',
                        availableFrom: quiz.startTime,
                        availableUntil: quiz.endTime
                    });
                }

                // ================================
                // CASE 4 → ATTEMPT LIMIT CHECK
                // ================================
                const attemptCount = await QuizAttempt.countDocuments({
                    quiz: quiz._id,
                    user: studentId
                });

                if (attemptCount >= quiz.attemptsAllowed) {
                    return res.status(403).json({
                        success: false,
                        error: 'Maximum attempts reached',
                        attemptCount,
                        attemptsAllowed: quiz.attemptsAllowed
                    });
                }

                // ================================
                // CASE 5 → STUDENT GETS ONLY SAFE INFO
                // (HIDE questions, hide pool filter)
                // ================================
                return res.json({
                    success: true,
                    data: {
                        ...quiz.toObject(),
                        isEnrolled: true,
                        userAttemptCount: attemptCount,
                        attemptsRemaining: quiz.attemptsAllowed - attemptCount,
                        questionIds: undefined,
                        questionPoolFilter: undefined
                    }
                });
            }

            // ======================================================
            // TRAINER / ADMIN → FULL ACCESS
            // ======================================================
            if (quiz.questionMode === 'fixed_list' && quiz.questionIds.length > 0) {
                await quiz.populate('questionIds');
            }

            return res.json({
                success: true,
                data: quiz
            });

        } catch (error) {
            logger.error('Get quiz error:', error);
            next(error);
        }
    }

    /**
     * POST /api/quizzes
     * Create new quiz (trainer/admin only)
     */
    async createQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                title,
                description,
                subject,
                questionMode,
                questionIds,
                questionPoolFilter,
                durationMinutes = req.body.durationSeconds
                    ? Math.ceil(req.body.durationSeconds / 60)
                    : req.body.durationMinutes || 60,
                totalMarks,
                passingMarks,
                attemptsAllowed,
                startTime,
                endTime,
                shuffleQuestions,
                shuffleChoices,
                showResultsImmediately,
                showCorrectAnswers,
                targetAudience,
                antiCheatSettings,
                instructions
            } = req.body;

            // Validate subject exists
            const subjectExists = await Subject.findById(subject).session(session);
            if (!subjectExists) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid subject'
                });
            }

            // Validate question mode
            if (questionMode === 'fixed_list') {
                if (!questionIds || questionIds.length === 0) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Question IDs required for fixed_list mode'
                    });
                }

                // Validate all questions exist
                const questions = await Question.find({
                    _id: { $in: questionIds }
                }).session(session);

                if (questions.length !== questionIds.length) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Some question IDs are invalid'
                    });
                }

                // Calculate total marks if not provided
                const calculatedTotalMarks = questions.reduce(
                    (sum, q) => sum + (q.marks || 1),
                    0
                );

                if (!totalMarks) {
                    req.body.totalMarks = calculatedTotalMarks;
                }
            } else if (questionMode === 'pool_random') {
                if (!questionPoolFilter || !questionPoolFilter.count) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Question pool filter and count required for pool_random mode'
                    });
                }
            }

            // Validate time window
            if (new Date(startTime) >= new Date(endTime)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Start time must be before end time'
                });
            }

            // Validate passing marks
            if (passingMarks && totalMarks && passingMarks > totalMarks) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Passing marks cannot exceed total marks'
                });
            }

            const quiz = new Quiz({
                title,
                description,
                subject,
                questionMode,
                questionIds: questionMode === 'fixed_list' ? questionIds : [],
                questionPoolFilter: questionMode === 'pool_random' ? questionPoolFilter : undefined,
                durationMinutes: durationMinutes || 60,
                totalMarks: req.body.totalMarks || totalMarks,
                passingMarks: passingMarks || 0,
                attemptsAllowed: attemptsAllowed || 1,
                startTime,
                endTime,
                shuffleQuestions: shuffleQuestions !== undefined ? shuffleQuestions : true,
                shuffleChoices: shuffleChoices !== undefined ? shuffleChoices : true,
                showResultsImmediately: showResultsImmediately || false,
                showCorrectAnswers: showCorrectAnswers || false,
                targetAudience,
                antiCheatSettings: antiCheatSettings || {},
                instructions,
                createdBy: req.user._id,
                isPublished: false // Default unpublished
            });

            await quiz.save({ session });
            await session.commitTransaction();

            await quiz.populate('subject', 'name');
            await quiz.populate('createdBy', 'name email');

            logger.info(`Quiz created: ${quiz._id} by ${req.user.email}`);

            res.status(201).json({
                success: true,
                data: quiz,
                message: 'Quiz created successfully'
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Create quiz error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * PUT /api/quizzes/:id
     * Update quiz (trainer/admin only)
     */
    async updateQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;
            const updates = req.body;

            const quiz = await Quiz.findById(id).session(session);

            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Check if quiz has attempts (restrict editing published quizzes with attempts)
            const attemptCount = await QuizAttempt.countDocuments({
                quiz: quiz._id
            }).session(session);

            if (attemptCount > 0 && quiz.isPublished) {
                // Only allow limited updates for published quizzes with attempts
                const allowedUpdates = [
                    'description',
                    'instructions',
                    'endTime',
                    'showResultsImmediately',
                    'showCorrectAnswers'
                ];

                const attemptedUpdates = Object.keys(updates);
                const restrictedUpdates = attemptedUpdates.filter(
                    key => !allowedUpdates.includes(key)
                );

                if (restrictedUpdates.length > 0) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot modify core quiz settings after students have attempted',
                        restrictedFields: restrictedUpdates,
                        allowedFields: allowedUpdates
                    });
                }
            }

            // Validate subject if being updated
            if (updates.subject) {
                const subjectExists = await Subject.findById(updates.subject).session(session);
                if (!subjectExists) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid subject'
                    });
                }
            }

            // Validate questions if being updated
            if (updates.questionIds) {
                const questions = await Question.find({
                    _id: { $in: updates.questionIds }
                }).session(session);

                if (questions.length !== updates.questionIds.length) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Some question IDs are invalid'
                    });
                }
            }

            // Validate time window if being updated
            const newStartTime = updates.startTime || quiz.startTime;
            const newEndTime = updates.endTime || quiz.endTime;

            if (new Date(newStartTime) >= new Date(newEndTime)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Start time must be before end time'
                });
            }

            // Apply updates
            Object.assign(quiz, updates);
            quiz.modifiedBy = req.user._id;

            await quiz.save({ session });
            await session.commitTransaction();

            await quiz.populate('subject', 'name');
            await quiz.populate('createdBy', 'name email');
            await quiz.populate('modifiedBy', 'name email');

            logger.info(`Quiz updated: ${quiz._id} by ${req.user.email}`);

            res.json({
                success: true,
                data: quiz,
                message: 'Quiz updated successfully'
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Update quiz error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * PATCH /api/quizzes/:id/publish
     * Publish/unpublish quiz (trainer/admin only)
     */
    async publishQuiz(req, res, next) {
        try {
            const { id } = req.params;
            const { isPublished } = req.body;

            const quiz = await Quiz.findById(id);

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Validate quiz is ready for publishing
            if (isPublished) {
                // Check if quiz has questions
                if (quiz.questionMode === 'fixed_list' && (!quiz.questionIds || quiz.questionIds.length === 0)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot publish quiz without questions'
                    });
                }

                if (quiz.questionMode === 'pool_random' && !quiz.questionPoolFilter) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot publish quiz without question pool filter'
                    });
                }

                // Validate required fields
                if (!quiz.durationMinutes || !quiz.startTime || !quiz.endTime) {
                    return res.status(400).json({
                        success: false,
                        error: 'Duration, start time, and end time are required'
                    });
                }
            }

            quiz.isPublished = isPublished;
            quiz.modifiedBy = req.user._id;

            await quiz.save();

            logger.info(`Quiz ${isPublished ? 'published' : 'unpublished'}: ${quiz._id} by ${req.user.email}`);

            res.json({
                success: true,
                data: quiz,
                message: `Quiz ${isPublished ? 'published' : 'unpublished'} successfully`
            });
        } catch (error) {
            logger.error('Publish quiz error:', error);
            next(error);
        }
    }

    /**
     * DELETE /api/quizzes/:id
     * Delete quiz (admin only, only if no attempts)
     */
    async deleteQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;

            const quiz = await Quiz.findById(id).session(session);

            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Check for existing attempts
            const attemptCount = await QuizAttempt.countDocuments({
                quiz: quiz._id
            }).session(session);

            if (attemptCount > 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete quiz with existing attempts',
                    attemptCount
                });
            }

            await quiz.deleteOne({ session });
            await session.commitTransaction();

            logger.info(`Quiz deleted: ${id} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'Quiz deleted successfully'
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Delete quiz error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * GET /api/quizzes/:id/statistics
     * Get quiz statistics (trainer/admin only)
     */
    async getQuizStatistics(req, res, next) {
        try {
            const { id } = req.params;

            const quiz = await Quiz.findById(id);

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Aggregate attempt statistics
            const stats = await QuizAttempt.aggregate([
                {
                    $match: {
                        quiz: mongoose.Types.ObjectId(id),
                        status: { $in: ['auto_graded', 'submitted'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAttempts: { $sum: 1 },
                        uniqueStudents: { $addToSet: '$user' },
                        averageScore: { $avg: '$totalScore' },
                        maxScore: { $max: '$totalScore' },
                        minScore: { $min: '$totalScore' },
                        averageTabSwitches: { $avg: '$tabSwitches' },
                        flaggedCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0]
                            }
                        }
                    }
                }
            ]);

            const statistics = stats[0] || {
                totalAttempts: 0,
                uniqueStudents: [],
                averageScore: 0,
                maxScore: 0,
                minScore: 0,
                averageTabSwitches: 0,
                flaggedCount: 0
            };

            res.json({
                success: true,
                data: {
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        totalMarks: quiz.totalMarks,
                        passingMarks: quiz.passingMarks
                    },
                    statistics: {
                        ...statistics,
                        uniqueStudentCount: statistics.uniqueStudents.length,
                        passPercentage: statistics.averageScore
                            ? ((statistics.averageScore / quiz.totalMarks) * 100).toFixed(2)
                            : 0
                    }
                }
            });
        } catch (error) {
            logger.error('Get quiz statistics error:', error);
            next(error);
        }
    }

    /**
     * GET /api/quizzes/:id/results
     * Get all attempts for a quiz (trainer/admin only)
     */
    async getQuizResults(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, status, userId } = req.query;

            const quiz = await Quiz.findById(id);

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            const query = { quiz: id };

            if (status) {
                query.status = status;
            }

            if (userId) {
                query.user = userId;
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [attempts, total] = await Promise.all([
                QuizAttempt.find(query)
                    .populate('user', 'name email')
                    .select('-rawAnswers -autoGradeResult') // Exclude large fields in list
                    .sort({ startTime: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                QuizAttempt.countDocuments(query)
            ]);

            res.json({
                success: true,
                data: attempts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            logger.error('Get quiz results error:', error);
            next(error);
        }
    }

    /**
     * POST /api/quizzes/:id/duplicate
     * Duplicate an existing quiz (trainer/admin only)
     */
    async duplicateQuiz(req, res, next) {
        try {
            const { id } = req.params;

            const originalQuiz = await Quiz.findById(id);

            if (!originalQuiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            const duplicatedQuiz = new Quiz({
                ...originalQuiz.toObject(),
                _id: undefined,
                title: `${originalQuiz.title} (Copy)`,
                isPublished: false,
                createdBy: req.user._id,
                createdAt: undefined,
                updatedAt: undefined,
                totalAttempts: 0,
                averageScore: 0
            });

            await duplicatedQuiz.save();

            await duplicatedQuiz.populate('subject', 'name');
            await duplicatedQuiz.populate('createdBy', 'name email');

            logger.info(`Quiz duplicated: ${id} -> ${duplicatedQuiz._id} by ${req.user.email}`);

            res.status(201).json({
                success: true,
                data: duplicatedQuiz,
                message: 'Quiz duplicated successfully'
            });
        } catch (error) {
            logger.error('Duplicate quiz error:', error);
            next(error);
        }
    }
    //! Quiz Question Management Handlers
    // Get Questions of a Quiz
    async getQuizQuestions(req, res, next) {
        try {
            const { id } = req.params;

            const quiz = await Quiz.findById(id)
                .populate({
                    path: 'questionIds',
                    populate: [
                        { path: 'subject', select: 'name' },
                        { path: 'author', select: 'name email' }
                    ]
                });

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            return res.json({
                success: true,
                data: {
                    quiz: {
                        _id: quiz._id,
                        title: quiz.title,
                        subject: quiz.subject,
                        totalMarks: quiz.totalMarks,
                        durationMinutes: quiz.durationMinutes
                    },
                    questions: quiz.questionIds || []
                }
            });
        } catch (error) {
            logger.error('Get quiz questions error:', error);
            next(error);
        }
    }

    // Attach an existing question to a quiz

    async addQuestionToQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;
            const { questionId } = req.body;

            const quiz = await Quiz.findById(id).session(session);
            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            const question = await Question.findById(questionId).session(session);
            if (!question) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Invalid question'
                });
            }

            // Prevent duplicates
            const exists = quiz.questionIds.some(
                qid => qid.toString() === questionId.toString()
            );
            if (exists) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Question already added to quiz'
                });
            }

            quiz.questionIds.push(questionId);

            // Optionally update totalMarks automatically based on question.marks
            if (typeof question.marks === 'number') {
                quiz.totalMarks = (quiz.totalMarks || 0) + question.marks;
            }

            await quiz.save({ session });
            await session.commitTransaction();

            logger.info(`Question ${questionId} added to quiz ${id} by ${req.user.email}`);

            return res.status(201).json({
                success: true,
                message: 'Question added to quiz',
                data: quiz
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Add question to quiz error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }
    async removeQuestionFromQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id, questionId } = req.params;

            const quiz = await Quiz.findById(id).session(session);
            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            const beforeCount = quiz.questionIds.length;

            quiz.questionIds = quiz.questionIds.filter(
                qid => qid.toString() !== questionId.toString()
            );

            if (quiz.questionIds.length === beforeCount) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Question not found in this quiz'
                });
            }

            // Optionally recalc totalMarks if your Question model has marks
            const questions = await Question.find({
                _id: { $in: quiz.questionIds }
            }).session(session);

            quiz.totalMarks = questions.reduce(
                (sum, q) => sum + (q.marks || 1),
                0
            );

            await quiz.save({ session });
            await session.commitTransaction();

            logger.info(`Question ${questionId} removed from quiz ${id} by ${req.user.email}`);

            return res.json({
                success: true,
                message: 'Question removed from quiz',
                data: quiz
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Remove question from quiz error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }
    async bulkUploadQuestions(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;

            if (!req.file) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'File is required'
                });
            }

            const quiz = await Quiz.findById(id).session(session);
            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Read XLS/XLSX/CSV file
            const workbook = XLSX.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (!rows || rows.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'No rows found in uploaded file'
                });
            }

            // Map rows -> Question documents
            const questionsToCreate = rows.map(row => {
                const options = row.options
                    ? String(row.options).split('|').map(o => o.trim())
                    : [];

                return {
                    prompt: row.prompt,
                    type: row.type || 'mcq_single',
                    options,
                    correctAnswer: row.correctAnswer, // adjust to your schema
                    marks: Number(row.marks) || 1,
                    subject: quiz.subject,
                    author: req.user._id
                };
            });

            const createdQuestions = await Question.insertMany(questionsToCreate, {
                session
            });

            quiz.questionIds.push(...createdQuestions.map(q => q._id));

            // Recalculate totalMarks
            quiz.totalMarks = (quiz.totalMarks || 0) + createdQuestions.reduce(
                (sum, q) => sum + (q.marks || 1),
                0
            );

            await quiz.save({ session });
            await session.commitTransaction();

            logger.info(
                `Bulk uploaded ${createdQuestions.length} questions to quiz ${id} by ${req.user.email}`
            );

            // Clean up the uploaded file
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                logger.warn('Failed to delete uploaded file:', e);
            }

            return res.status(201).json({
                success: true,
                message: 'Questions uploaded and attached to quiz',
                addedCount: createdQuestions.length,
                data: createdQuestions
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Bulk upload questions error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }

    // POST /api/quizzes/:id/questions/manual
    async addManualQuestionToQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id } = req.params;
            const { prompt, type, marks, choices } = req.body;

            // Validate quiz exists
            const quiz = await Quiz.findById(id).session(session);
            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: "Quiz not found"
                });
            }

            // Create question
            const newQuestion = new Question({
                prompt,
                type: type || "mcq_single",
                marks: marks || 1,
                choices,
                correct: choices.find(c => c.isCorrect)?.id,
                author: req.user._id,
                subject: quiz.subject,
            });

            await newQuestion.save({ session });

            // Attach question to quiz
            quiz.questionIds.push(newQuestion._id);

            // Update quiz total marks
            quiz.totalMarks = (quiz.totalMarks || 0) + (newQuestion.marks || 1);

            await quiz.save({ session });

            await session.commitTransaction();

            return res.status(201).json({
                success: true,
                message: "New question created & added to quiz",
                data: newQuestion
            });

        } catch (error) {
            await session.abortTransaction();
            console.error("Manual question add error:", error);
            next(error);
        } finally {
            session.endSession();
        }
    }
    async enrollInQuiz(req, res, next) {
        try {
            const { id: quizId } = req.params;
            const studentId = req.user._id;

            const quiz = await Quiz.findById(quizId);

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: "Quiz not found"
                });
            }

            if (!quiz.isPublished) {
                return res.status(400).json({
                    success: false,
                    error: "Quiz is not published yet"
                });
            }

            // Check if already enrolled
            const exists = await QuizEnrollment.findOne({ quiz: quizId, student: studentId });

            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: "Already enrolled in this quiz"
                });
            }

            // Enroll student
            const enrollment = new QuizEnrollment({
                quiz: quizId,
                student: studentId
            });

            await enrollment.save();

            return res.status(201).json({
                success: true,
                message: "Enrolled successfully",
                data: enrollment
            });

        } catch (error) {
            console.error("Enroll error:", error);
            next(error);
        }
    }


    async startQuiz(req, res, next) {
        try {
            const { id: quizId } = req.params;
            const studentId = req.user._id;

            const QuizEnrollment = require('../models/QuizEnrollment');

            // Fetch quiz with questions
            let quiz = await Quiz.findById(quizId)
                .populate("questionIds")
                .populate("subject", "name");

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: "Quiz not found"
                });
            }

            // Only published quizzes can be started
            if (!quiz.isPublished) {
                return res.status(403).json({
                    success: false,
                    error: "Quiz is not published"
                });
            }

            // Check enrollment
            const enrollment = await QuizEnrollment.findOne({
                quiz: quizId,
                student: studentId
            });

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    error: "You must enroll to start this quiz"
                });
            }

            // Time window check
            const now = new Date();
            if (now < quiz.startTime || now > quiz.endTime) {
                return res.status(403).json({
                    success: false,
                    error: "Quiz is not available at this time",
                    availableFrom: quiz.startTime,
                    availableUntil: quiz.endTime
                });
            }

            // Count attempts
            const attemptCount = await QuizAttempt.countDocuments({
                quiz: quizId,
                user: studentId
            });

            if (attemptCount >= quiz.attemptsAllowed) {
                return res.status(403).json({
                    success: false,
                    error: "Maximum attempts reached"
                });
            }

            // FIND IF THERE IS AN ACTIVE IN-PROGRESS ATTEMPT
            let activeAttempt = await QuizAttempt.findOne({
                quiz: quizId,
                user: studentId,
                status: "in_progress"
            });

            if (activeAttempt) {
                return res.json({
                    success: true,
                    resumed: true,
                    message: "Resuming existing attempt",
                    data: activeAttempt
                });
            }

            // ====================================================
            // Build question set (fixed_list or pool_random)
            // ====================================================
            let selectedQuestions = [];

            if (quiz.questionMode === "fixed_list") {
                selectedQuestions = quiz.questionIds.map(q => ({
                    _id: q._id,
                    prompt: q.prompt,
                    type: q.type,
                    marks: q.marks,
                    choices: quiz.shuffleChoices ? shuffleArray(q.choices) : q.choices
                }));
            } else {
                // pool_random mode
                const qFilter = { subject: quiz.subject._id };
                if (quiz.questionPoolFilter.difficulty.length)
                    qFilter.difficulty = { $in: quiz.questionPoolFilter.difficulty };
                if (quiz.questionPoolFilter.tags.length)
                    qFilter.tags = { $in: quiz.questionPoolFilter.tags };

                const pool = await Question.find(qFilter);

                selectedQuestions = shuffleArray(pool).slice(0, quiz.questionPoolFilter.count);
            }

            // Shuffle question order
            if (quiz.shuffleQuestions) {
                selectedQuestions = shuffleArray(selectedQuestions);
            }

            // ====================================================
            // Create new attempt
            // ====================================================
            const newAttempt = new QuizAttempt({
                quiz: quizId,
                user: studentId,
                status: "in_progress",
                selectedQuestions,
                startTime: new Date(),
                totalScore: 0,
                tabSwitches: 0
            });

            await newAttempt.save();

            return res.json({
                success: true,
                message: "Quiz started successfully",
                data: newAttempt
            });

        } catch (error) {
            console.error("Start quiz error:", error);
            next(error);
        }
    }


    // Utility function for shuffling
    shuffleArray(arr) {
        return arr.sort(() => Math.random() - 0.5);
    }
    async submitQuiz(req, res, next) {
        try {
            const { attemptId } = req.params;
            const { answers } = req.body;
            const studentId = req.user._id;

            const attempt = await QuizAttempt.findById(attemptId)
                .populate("quiz")
                .populate("selectedQuestions._id");

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: "Attempt not found"
                });
            }

            // Only the student who started can submit
            if (attempt.user.toString() !== studentId.toString()) {
                return res.status(403).json({
                    success: false,
                    error: "Not allowed"
                });
            }

            // Attempt must be in progress
            if (attempt.status !== "in_progress") {
                return res.status(400).json({
                    success: false,
                    error: "This attempt is already submitted"
                });
            }

            // Ensure quiz is still active
            const now = new Date();
            if (now > attempt.quiz.endTime) {
                attempt.status = "time_expired";
                await attempt.save();
                return res.status(400).json({
                    success: false,
                    error: "Quiz time expired"
                });
            }

            // Store raw answers
            attempt.rawAnswers = answers;

            let totalScore = 0;
            let correctCount = 0;
            let wrongCount = 0;

            // Auto-grading
            for (let q of attempt.selectedQuestions) {
                const submitted = answers.find(a => a.questionId == q._id);

                if (!submitted) continue;

                const correctAnswer = q._id.correct;
                const marks = q._id.marks || 1;

                // Single correct (mcq_single)
                if (q._id.type === "mcq_single") {
                    if (submitted.answer == correctAnswer) {
                        totalScore += marks;
                        correctCount++;
                    } else {
                        wrongCount++;
                    }
                }

                // Multi correct (mcq_multi)
                if (q._id.type === "mcq_multi") {
                    const correctArray = q._id.choices
                        .filter(c => c.isCorrect)
                        .map(c => c.id)
                        .sort();

                    const submittedArray = Array.isArray(submitted.answer)
                        ? submitted.answer.sort()
                        : [];

                    if (JSON.stringify(correctArray) === JSON.stringify(submittedArray)) {
                        totalScore += marks;
                        correctCount++;
                    } else {
                        wrongCount++;
                    }
                }
            }

            // Update attempt
            attempt.totalScore = totalScore;
            attempt.correctCount = correctCount;
            attempt.wrongCount = wrongCount;
            attempt.status = "submitted";
            attempt.endTime = new Date();

            await attempt.save();

            // Update quiz statistics
            await Quiz.findByIdAndUpdate(attempt.quiz._id, {
                $inc: { totalAttempts: 1 },
                $set: { averageScore: attempt.totalScore }  // optional
            });

            return res.json({
                success: true,
                message: "Quiz submitted successfully",
                data: {
                    attemptId,
                    totalScore,
                    correctCount,
                    wrongCount,
                    totalMarks: attempt.quiz.totalMarks
                }
            });

        } catch (error) {
            console.error("Submit quiz error:", error);
            next(error);
        }
    }
    async getMyAttemptsForQuiz(req, res, next) {
        try {
            const { id: quizId } = req.params;
            const studentId = req.user._id;

            const attempts = await QuizAttempt.find({
                quiz: quizId,
                user: studentId
            })
                .select('-rawAnswers -selectedQuestions') // hide heavy data
                .sort({ startTime: -1 });

            return res.json({
                success: true,
                data: attempts
            });

        } catch (error) {
            console.error("Get my attempts error:", error);
            next(error);
        }
    }
    async getMyAttemptDetail(req, res, next) {
        try {
            const { attemptId } = req.params;
            const studentId = req.user._id;

            const attempt = await QuizAttempt.findById(attemptId)
                .populate("quiz", "title durationMinutes totalMarks passingMarks")
                .populate("selectedQuestions._id");

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: "Attempt not found"
                });
            }

            // Ensure student is owner
            if (attempt.user.toString() !== studentId.toString()) {
                return res.status(403).json({
                    success: false,
                    error: "Not allowed to view this attempt"
                });
            }

            return res.json({
                success: true,
                data: attempt
            });

        } catch (error) {
            console.error("Attempt detail error:", error);
            next(error);
        }
    }


}

module.exports = new QuizzesController();
