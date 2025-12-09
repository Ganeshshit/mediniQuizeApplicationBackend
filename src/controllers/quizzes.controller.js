// controllers/quizzes.controller.js
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const Subject = require('../models/Subject');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const QuizEnrollment = require('../models/QuizEnrollment');
const crypto = require('crypto');
function shuffleArray(arr) {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

function generateAttemptToken() {
    return crypto.randomBytes(32).toString('hex');
}
// Utility: Validate IP address format
function isValidIP(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

class QuizzesController {
    // Utility: Verify quiz ownership for trainer/admin
    //
    async verifyQuizOwnership(quizId, userId, userRole) {
        const quiz = await Quiz.findById(quizId);

        if (!quiz) {
            throw new Error('Quiz not found');
        }

        // Admin can access all quizzes
        if (userRole === 'admin') {
            return quiz;
        }

        // Trainer can only access their own quizzes
        if (userRole === 'trainer' && quiz.createdBy.toString() !== userId.toString()) {
            throw new Error('Access denied: You can only manage your own quizzes');
        }

        return quiz;
    }
    calculateMedian(values) {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

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
                published,
                difficulty,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            const query = {};

            // Role-based filtering
            if (req.user && (req.user.role === "trainer" || req.user.role === "admin")) {
                if (published !== undefined) {
                    query.isPublished = published === "true";
                }
            } else {
                query.isPublished = true;
                // Only show quizzes within time window for students
                const now = new Date();
                query.startTime = { $lte: now };
                query.endTime = { $gte: now };
            }

            // Filters
            if (subject) query.subject = subject;
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } }
                ];
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Sorting
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            const [quizzes, total] = await Promise.all([
                Quiz.find(query)
                    .populate("subject", "name description")
                    .populate("createdBy", "name email")
                    .select("-questionIds -questionPoolFilter")
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Quiz.countDocuments(query)
            ]);

            // Enhanced student response with enrollment and attempt data
            if (req.user && req.user.role === "student") {
                const studentId = req.user._id;
                const quizIds = quizzes.map(q => q._id);

                // Batch fetch enrollments and attempts
                const [enrollments, attempts] = await Promise.all([
                    QuizEnrollment.find({
                        quiz: { $in: quizIds },
                        student: studentId
                    }).lean(),
                    QuizAttempt.aggregate([
                        {
                            $match: {
                                quiz: { $in: quizIds },
                                user: studentId
                            }
                        },
                        {
                            $group: {
                                _id: '$quiz',
                                count: { $sum: 1 },
                                bestScore: { $max: '$totalScore' },
                                lastAttempt: { $max: '$startTime' }
                            }
                        }
                    ])
                ]);

                const enrollmentMap = new Map(
                    enrollments.map(e => [e.quiz.toString(), e])
                );
                const attemptMap = new Map(
                    attempts.map(a => [a._id.toString(), a])
                );

                const result = quizzes.map(quiz => {
                    const quizId = quiz._id.toString();
                    const isEnrolled = enrollmentMap.has(quizId);
                    const attemptData = attemptMap.get(quizId);

                    if (!isEnrolled) {
                        return {
                            _id: quiz._id,
                            title: quiz.title,
                            description: quiz.description,
                            subject: quiz.subject,
                            durationMinutes: quiz.durationMinutes,
                            totalMarks: quiz.totalMarks,
                            startTime: quiz.startTime,
                            endTime: quiz.endTime,
                            isEnrolled: false,
                            canEnroll: true
                        };
                    }

                    return {
                        ...quiz,
                        isEnrolled: true,
                        attemptCount: attemptData?.count || 0,
                        attemptsRemaining: quiz.attemptsAllowed - (attemptData?.count || 0),
                        bestScore: attemptData?.bestScore || null,
                        lastAttemptDate: attemptData?.lastAttempt || null,
                        canAttempt: (attemptData?.count || 0) < quiz.attemptsAllowed
                    };
                });

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

            // Trainer/Admin response
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

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid quiz ID'
                });
            }

            const quiz = await Quiz.findById(id)
                .populate('subject', 'name description')
                .populate('createdBy', 'name email')
                .lean();

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Student access control
            if (req.user.role === 'student') {
                const studentId = req.user._id;

                // Check enrollment
                const enrollment = await QuizEnrollment.findOne({
                    quiz: quiz._id,
                    student: studentId
                }).lean();

                if (!enrollment) {
                    return res.json({
                        success: true,
                        data: {
                            _id: quiz._id,
                            title: quiz.title,
                            description: quiz.description,
                            subject: quiz.subject,
                            durationMinutes: quiz.durationMinutes,
                            totalMarks: quiz.totalMarks,
                            passingMarks: quiz.passingMarks,
                            attemptsAllowed: quiz.attemptsAllowed,
                            startTime: quiz.startTime,
                            endTime: quiz.endTime,
                            instructions: quiz.instructions,
                            isEnrolled: false,
                            enrollmentRequired: true
                        }
                    });
                }

                // Published check
                if (!quiz.isPublished) {
                    return res.status(403).json({
                        success: false,
                        error: 'Quiz is not published'
                    });
                }

                // Time window check
                const now = new Date();
                if (now < quiz.startTime) {
                    return res.status(403).json({
                        success: false,
                        error: 'Quiz has not started yet',
                        availableFrom: quiz.startTime
                    });
                }

                if (now > quiz.endTime) {
                    return res.status(403).json({
                        success: false,
                        error: 'Quiz has ended',
                        endedAt: quiz.endTime
                    });
                }

                // Get attempt statistics
                const attempts = await QuizAttempt.find({
                    quiz: quiz._id,
                    user: studentId
                }).select('totalScore status startTime').lean();

                const attemptCount = attempts.length;
                const bestScore = attempts.length > 0
                    ? Math.max(...attempts.map(a => a.totalScore || 0))
                    : null;

                if (attemptCount >= quiz.attemptsAllowed) {
                    return res.status(403).json({
                        success: false,
                        error: 'Maximum attempts reached',
                        attemptCount,
                        attemptsAllowed: quiz.attemptsAllowed,
                        bestScore
                    });
                }

                // Return safe student data
                return res.json({
                    success: true,
                    data: {
                        _id: quiz._id,
                        title: quiz.title,
                        description: quiz.description,
                        subject: quiz.subject,
                        durationMinutes: quiz.durationMinutes,
                        totalMarks: quiz.totalMarks,
                        passingMarks: quiz.passingMarks,
                        attemptsAllowed: quiz.attemptsAllowed,
                        startTime: quiz.startTime,
                        endTime: quiz.endTime,
                        instructions: quiz.instructions,
                        antiCheatSettings: quiz.antiCheatSettings,
                        isEnrolled: true,
                        attemptCount,
                        attemptsRemaining: quiz.attemptsAllowed - attemptCount,
                        bestScore,
                        previousAttempts: attempts.map(a => ({
                            score: a.totalScore,
                            status: a.status,
                            date: a.startTime
                        }))
                    }
                });
            }

            // Trainer/Admin full access
            if (quiz.questionMode === 'fixed_list' && quiz.questionIds?.length > 0) {
                const populatedQuiz = await Quiz.findById(id)
                    .populate('questionIds')
                    .populate('subject', 'name description')
                    .populate('createdBy', 'name email')
                    .lean();

                return res.json({
                    success: true,
                    data: populatedQuiz
                });
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
                description = '',
                subject,
                questionMode = 'none',
                questionIds = [],
                questionPoolFilter,
                durationMinutes,
                durationSeconds,
                totalMarks,
                passingMarks,
                attemptsAllowed = 1,
                startTime,
                endTime,
                shuffleQuestions = true,
                shuffleChoices = true,
                showResultsImmediately = false,
                showCorrectAnswers = false,
                targetAudience,
                antiCheatSettings = {},
                instructions = '',
                status = 'draft',
                isDraft = true,
                tags = [],
                category
            } = req.body;

            // Calculate duration
            const quizDuration = durationMinutes || (durationSeconds ? Math.ceil(durationSeconds / 60) : 60);

            // ✅ FIXED: Clean up empty string values
            const cleanSubject = subject && subject.trim() !== '' ? subject : undefined;
            const cleanCategory = category && category.trim() !== '' ? category : undefined;

            // ✅ FIXED: Clean up questionPoolFilter
            let cleanQuestionPoolFilter = undefined;
            if (questionMode === 'pool_random' && questionPoolFilter) {
                const poolSubject = questionPoolFilter.subject &&
                    questionPoolFilter.subject.trim() !== ''
                    ? questionPoolFilter.subject
                    : undefined;

                cleanQuestionPoolFilter = {
                    subject: poolSubject,
                    difficulty: questionPoolFilter.difficulty || [],
                    tags: questionPoolFilter.tags || [],
                    count: questionPoolFilter.count || 10
                };

                // Remove undefined subject if not provided
                if (!poolSubject) {
                    delete cleanQuestionPoolFilter.subject;
                }
            }

            // ✅ VALIDATE: subject only if provided and not empty
            if (cleanSubject) {
                const subjectExists = await Subject.findById(cleanSubject).session(session);
                if (!subjectExists) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid subject ID'
                    });
                }
            }

            // ✅ VALIDATE: questionPoolFilter.subject only if provided
            if (cleanQuestionPoolFilter?.subject) {
                const poolSubjectExists = await Subject.findById(cleanQuestionPoolFilter.subject).session(session);
                if (!poolSubjectExists) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid subject ID in question pool filter'
                    });
                }
            }

            // Handle question validation based on mode
            let calculatedTotalMarks = totalMarks || 0;

            if (questionMode === 'fixed_list' && questionIds.length > 0) {
                // Validate questions if provided
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

                // Auto-calculate marks if not provided
                if (!totalMarks) {
                    calculatedTotalMarks = questions.reduce(
                        (sum, q) => sum + (q.marks || 1),
                        0
                    );
                }
            } else if (questionMode === 'pool_random' && cleanQuestionPoolFilter) {
                // Auto-calculate marks for pool mode
                if (!totalMarks) {
                    calculatedTotalMarks = (cleanQuestionPoolFilter.count || 10) * 1;
                }
            }

            // Validate time window only if both are provided
            if (startTime && endTime) {
                if (new Date(startTime) >= new Date(endTime)) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'Start time must be before end time'
                    });
                }
            }

            // Validate passing marks
            const finalPassingMarks = passingMarks || 0;
            if (calculatedTotalMarks > 0 && finalPassingMarks > calculatedTotalMarks) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Passing marks cannot exceed total marks'
                });
            }

            // Create quiz with cleaned fields
            const quiz = new Quiz({
                title,
                description,
                subject: cleanSubject,
                questionMode,
                questionIds: questionMode === 'fixed_list' ? questionIds : [],
                questionPoolFilter: cleanQuestionPoolFilter,
                durationMinutes: quizDuration,
                totalMarks: calculatedTotalMarks,
                passingMarks: finalPassingMarks,
                attemptsAllowed,
                startTime: startTime || undefined,
                endTime: endTime || undefined,
                shuffleQuestions,
                shuffleChoices,
                showResultsImmediately,
                showCorrectAnswers,
                targetAudience,
                antiCheatSettings,
                instructions,
                createdBy: req.user._id,
                status,
                isDraft,
                isPublished: false,
                tags,
                category: cleanCategory,
                lastAutoSave: new Date()
            });

            await quiz.save({ session });
            await session.commitTransaction();

            // Populate relations if they exist
            if (cleanSubject) {
                await quiz.populate('subject', 'name code');
            }
            await quiz.populate('createdBy', 'name email');

            logger.info(`Quiz created: ${quiz._id} by ${req.user.email} (status: ${status})`);

            res.status(201).json({
                success: true,
                data: quiz,
                message: isDraft ? 'Draft quiz created successfully' : 'Quiz created successfully',
                completionPercentage: quiz.getCompletionPercentage()
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

            // ✅ PERMISSION: Check ownership for trainers
            if (req.user.role === 'trainer' && quiz.createdBy.toString() !== req.user._id.toString()) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: 'You can only update your own quizzes'
                });
            }

            // ✅ SMART VALIDATION: Check if quiz has attempts
            const attemptCount = await QuizAttempt.countDocuments({
                quiz: quiz._id
            }).session(session);

            const hasAttempts = attemptCount > 0;

            if (hasAttempts && quiz.isPublished) {
                // Restrict updates if quiz is published and has attempts
                const allowedUpdates = [
                    'description',
                    'instructions',
                    'endTime',
                    'showResultsImmediately',
                    'showCorrectAnswers',
                    'tags',
                    'category'
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
                        allowedFields: allowedUpdates,
                        hint: 'Consider duplicating the quiz to make major changes'
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
            if (updates.questionIds && updates.questionIds.length > 0) {
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

                // Auto-update total marks
                if (!updates.totalMarks) {
                    updates.totalMarks = questions.reduce(
                        (sum, q) => sum + (q.marks || 1),
                        0
                    );
                }
            }

            // Validate time window if being updated
            const newStartTime = updates.startTime || quiz.startTime;
            const newEndTime = updates.endTime || quiz.endTime;

            if (newStartTime && newEndTime && new Date(newStartTime) >= new Date(newEndTime)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Start time must be before end time'
                });
            }

            // ✅ VERSION CONTROL: Save previous version
            if (!quiz.isDraft && hasAttempts) {
                quiz.previousVersions.push({
                    version: quiz.version,
                    snapshot: quiz.toObject(),
                    modifiedBy: req.user._id,
                    modifiedAt: new Date()
                });
                quiz.version += 1;
            }

            // Apply updates
            Object.assign(quiz, updates);
            quiz.modifiedBy = req.user._id;
            quiz.lastAutoSave = new Date();

            await quiz.save({ session });
            await session.commitTransaction();

            await quiz.populate('subject', 'name code');
            await quiz.populate('createdBy', 'name email');
            await quiz.populate('modifiedBy', 'name email');

            logger.info(`Quiz updated: ${quiz._id} by ${req.user.email}`);

            res.json({
                success: true,
                data: quiz,
                message: 'Quiz updated successfully',
                completionPercentage: quiz.getCompletionPercentage(),
                version: quiz.version
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

            // Check ownership for trainers
            if (req.user.role === 'trainer' && quiz.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only publish your own quizzes'
                });
            }

            // ✅ VALIDATE before publishing
            if (isPublished) {
                const validation = quiz.isReadyToPublish();

                if (!validation.ready) {
                    return res.status(400).json({
                        success: false,
                        error: 'Quiz is not ready to publish',
                        errors: validation.errors,
                        completionPercentage: quiz.getCompletionPercentage()
                    });
                }

                quiz.status = 'published';
                quiz.isDraft = false;
            } else {
                quiz.status = 'draft';
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

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(id, req.user._id, req.user.role);

            // Get all enrollments and attempts
            const [enrollments, attempts] = await Promise.all([
                QuizEnrollment.countDocuments({ quiz: id }),
                QuizAttempt.find({ quiz: id })
            ]);

            const completedAttempts = attempts.filter(a =>
                ['submitted', 'auto_graded', 'manually_graded'].includes(a.status)
            );

            // Calculate statistics
            const statistics = {
                enrollment: {
                    total: enrollments,
                    attempted: new Set(attempts.map(a => a.user.toString())).size,
                    notAttempted: enrollments - new Set(attempts.map(a => a.user.toString())).size
                },
                attempts: {
                    total: attempts.length,
                    inProgress: attempts.filter(a => a.status === 'in_progress').length,
                    completed: completedAttempts.length,
                    flagged: attempts.filter(a => a.isFlagged).length
                },
                scores: {
                    average: completedAttempts.length > 0
                        ? completedAttempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / completedAttempts.length
                        : 0,
                    highest: completedAttempts.length > 0
                        ? Math.max(...completedAttempts.map(a => a.totalScore || 0))
                        : 0,
                    lowest: completedAttempts.length > 0
                        ? Math.min(...completedAttempts.map(a => a.totalScore || 0))
                        : 0,
                    median: this.calculateMedian(completedAttempts.map(a => a.totalScore || 0))
                },
                performance: {
                    passRate: completedAttempts.length > 0
                        ? (completedAttempts.filter(a => a.passed).length / completedAttempts.length) * 100
                        : 0,
                    averagePercentage: completedAttempts.length > 0
                        ? completedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / completedAttempts.length
                        : 0
                },
                timing: {
                    averageTimeSpent: completedAttempts.length > 0
                        ? completedAttempts.reduce((sum, a) => sum + (a.timeSpentSeconds || 0), 0) / completedAttempts.length
                        : 0
                },
                antiCheat: {
                    totalFlagged: attempts.filter(a => a.isFlagged).length,
                    averageTabSwitches: attempts.length > 0
                        ? attempts.reduce((sum, a) => sum + (a.tabSwitches || 0), 0) / attempts.length
                        : 0
                }
            };

            // Score distribution
            const scoreRanges = [
                { label: '0-20%', min: 0, max: 20 },
                { label: '21-40%', min: 21, max: 40 },
                { label: '41-60%', min: 41, max: 60 },
                { label: '61-80%', min: 61, max: 80 },
                { label: '81-100%', min: 81, max: 100 }
            ];

            statistics.distribution = scoreRanges.map(range => ({
                label: range.label,
                count: completedAttempts.filter(a =>
                    a.percentage >= range.min && a.percentage <= range.max
                ).length
            }));

            res.json({
                success: true,
                data: {
                    statistics,
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        totalMarks: quiz.totalMarks,
                        passingMarks: quiz.passingMarks,
                        durationMinutes: quiz.durationMinutes
                    }
                }
            });
        } catch (error) {
            logger.error('Get quiz statistics error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
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
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { id: quizId } = req.params;
            const studentId = req.user._id;

            // Security: Capture comprehensive client info
            const clientIP = (req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress).split(',')[0].trim();

            const userAgent = req.headers['user-agent'];
            const fingerprint = req.headers['x-client-fingerprint'] || null;

            // Validate quiz exists
            const quiz = await Quiz.findById(quizId)
                .populate("subject", "name")
                .session(session);

            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: "Quiz not found"
                });
            }

            // Security: Published check
            if (!quiz.isPublished) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: "Quiz is not published"
                });
            }

            // Security: Enrollment check
            const enrollment = await QuizEnrollment.findOne({
                quiz: quizId,
                student: studentId
            }).session(session);

            if (!enrollment) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: "You must enroll to start this quiz"
                });
            }

            // Security: Time window validation
            const now = new Date();
            if (now < quiz.startTime) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: "Quiz has not started yet",
                    availableFrom: quiz.startTime,
                    serverTime: now
                });
            }

            if (now > quiz.endTime) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: "Quiz has ended",
                    endedAt: quiz.endTime,
                    serverTime: now
                });
            }

            // Security: Check attempt limits
            const completedAttempts = await QuizAttempt.countDocuments({
                quiz: quizId,
                user: studentId,
                status: { $in: ['submitted', 'auto_graded', 'timeout', 'manually_graded'] }
            }).session(session);

            if (completedAttempts >= quiz.attemptsAllowed) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: "Maximum attempts reached",
                    attemptCount: completedAttempts,
                    attemptsAllowed: quiz.attemptsAllowed
                });
            }

            // Resume: Check for existing in-progress attempt
            let activeAttempt = await QuizAttempt.findOne({
                quiz: quizId,
                user: studentId,
                status: "in_progress"
            }).session(session);

            if (activeAttempt) {
                const attemptStartTime = new Date(activeAttempt.startTime);
                const durationMs = quiz.durationMinutes * 60 * 1000;
                const elapsed = Date.now() - attemptStartTime.getTime();
                const gracePeriod = 60000; // 1 minute grace

                if (elapsed > (durationMs + gracePeriod)) {
                    // Time expired, auto-submit
                    activeAttempt.status = "timeout";
                    activeAttempt.endTime = new Date();
                    activeAttempt.timeSpentSeconds = Math.floor(elapsed / 1000);
                    activeAttempt.isFlagged = true;
                    activeAttempt.flaggedReasons.push({
                        reason: "Attempt resumed after time limit expired",
                        timestamp: new Date(),
                        severity: "high",
                        details: `Elapsed: ${Math.floor(elapsed / 1000)}s, Allowed: ${quiz.durationMinutes * 60}s`
                    });
                    await activeAttempt.save({ session });
                    await session.commitTransaction();

                    return res.status(400).json({
                        success: false,
                        error: "Previous attempt expired",
                        timeExpired: true,
                        attemptId: activeAttempt._id
                    });
                }

                // Validate attempt integrity
                if (!activeAttempt.attemptToken) {
                    activeAttempt.attemptToken = generateAttemptToken();
                }

                // Rebuild selectedQuestions if missing
                if (!activeAttempt.selectedQuestions || activeAttempt.selectedQuestions.length === 0) {
                    const questionIds = activeAttempt.questionsServed.map(qs => qs.question);
                    const questions = await Question.find({
                        _id: { $in: questionIds }
                    }).session(session);

                    activeAttempt.selectedQuestions = activeAttempt.questionsServed.map(qs => {
                        const question = questions.find(q => q._id.toString() === qs.question.toString());
                        if (!question) return null;

                        return {
                            question: question._id,
                            prompt: question.prompt,
                            type: question.type,
                            marks: question.marks,
                            choices: quiz.shuffleChoices && question.choices
                                ? shuffleArray(question.choices.map(c => ({ id: c.id, text: c.text })))
                                : question.choices?.map(c => ({ id: c.id, text: c.text })) || []
                        };
                    }).filter(Boolean);

                    await activeAttempt.save({ session });
                }

                // Update resume metadata
                activeAttempt.resumeCount = (activeAttempt.resumeCount || 0) + 1;
                activeAttempt.lastResumeTime = new Date();
                activeAttempt.resumeIPs = activeAttempt.resumeIPs || [];
                if (!activeAttempt.resumeIPs.includes(clientIP)) {
                    activeAttempt.resumeIPs.push(clientIP);
                }

                await activeAttempt.save({ session });
                await session.commitTransaction();

                await activeAttempt.populate([
                    { path: 'quiz', select: 'title durationMinutes totalMarks passingMarks antiCheatSettings' }
                ]);

                logger.info(`Resuming attempt: ${activeAttempt._id} for student ${studentId}`);

                return res.json({
                    success: true,
                    resumed: true,
                    message: "Resuming existing attempt",
                    data: {
                        ...activeAttempt.toObject(),
                        timeRemaining: Math.max(0, Math.floor((durationMs - elapsed) / 1000)),
                        serverTime: now
                    }
                });
            }

            // Create new attempt: Build question set
            let selectedQuestions = [];

            if (quiz.questionMode === "fixed_list") {
                if (!quiz.questionIds || quiz.questionIds.length === 0) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: "Quiz has no questions configured"
                    });
                }

                const questions = await Question.find({
                    _id: { $in: quiz.questionIds },
                    isActive: true
                }).session(session);

                if (questions.length === 0) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: "No active questions available"
                    });
                }

                selectedQuestions = questions.map(q => ({
                    question: q._id,
                    prompt: q.prompt,
                    type: q.type,
                    marks: q.marks || 1,
                    choices: quiz.shuffleChoices && q.choices
                        ? shuffleArray(q.choices.map(c => ({ id: c.id, text: c.text })))
                        : q.choices?.map(c => ({ id: c.id, text: c.text })) || []
                }));
            }
            else if (quiz.questionMode === "pool_random") {
                const qFilter = {
                    subject: quiz.subject._id,
                    isActive: true
                };

                if (quiz.questionPoolFilter?.difficulty?.length) {
                    qFilter.difficulty = { $in: quiz.questionPoolFilter.difficulty };
                }

                if (quiz.questionPoolFilter?.tags?.length) {
                    qFilter.tags = { $in: quiz.questionPoolFilter.tags };
                }

                const pool = await Question.find(qFilter).session(session);

                if (pool.length === 0) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: "No questions available in the question pool"
                    });
                }

                const count = Math.min(
                    quiz.questionPoolFilter.count || 10,
                    pool.length
                );

                selectedQuestions = shuffleArray(pool).slice(0, count).map(q => ({
                    question: q._id,
                    prompt: q.prompt,
                    type: q.type,
                    marks: q.marks || 1,
                    choices: quiz.shuffleChoices && q.choices
                        ? shuffleArray(q.choices.map(c => ({ id: c.id, text: c.text })))
                        : q.choices?.map(c => ({ id: c.id, text: c.text })) || []
                }));
            }

            // Shuffle question order if enabled
            if (quiz.shuffleQuestions) {
                selectedQuestions = shuffleArray(selectedQuestions);
            }

            // Calculate total marks
            const attemptMaxScore = selectedQuestions.reduce(
                (sum, q) => sum + (q.marks || 1), 0
            );

            // Create new attempt
            const newAttempt = new QuizAttempt({
                quiz: quizId,
                user: studentId,
                attemptNumber: completedAttempts + 1,
                attemptToken: generateAttemptToken(),
                status: "in_progress",
                selectedQuestions,
                startTime: new Date(),
                totalScore: 0,
                maxScore: attemptMaxScore,
                tabSwitches: 0,
                ipAtStart: clientIP,
                userAgentStart: userAgent,
                clientFingerprint: fingerprint,
                questionsServed: selectedQuestions.map((q, idx) => ({
                    question: q.question,
                    orderIndex: idx,
                    marks: q.marks
                })),
                browserInfo: {
                    userAgent: userAgent,
                    platform: req.headers['sec-ch-ua-platform'] || 'unknown'
                },
                resumeCount: 0,
                resumeIPs: [clientIP]
            });

            await newAttempt.save({ session });
            await session.commitTransaction();

            await newAttempt.populate([
                { path: 'quiz', select: 'title durationMinutes totalMarks passingMarks antiCheatSettings' }
            ]);

            logger.info(`Quiz started: ${quizId} by student ${studentId}, attempt ${newAttempt._id}`);

            return res.json({
                success: true,
                message: "Quiz started successfully",
                data: {
                    ...newAttempt.toObject(),
                    serverTime: now,
                    timeRemaining: quiz.durationMinutes * 60
                }
            });

        } catch (error) {
            await session.abortTransaction();
            logger.error("Start quiz error:", error);
            next(error);
        } finally {
            session.endSession();
        }
    }
    // Utility function for shuffling
    // shuffleArray(arr) {
    //     return arr.sort(() => Math.random() - 0.5);
    // }
    async submitQuiz(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { attemptId } = req.params;
            const { answers, tabSwitches, timeSpentSeconds, isAutoSubmit, clientFingerprint } = req.body;
            const studentId = req.user._id;

            // Security: Capture submission metadata
            const submitIP = (req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress).split(',')[0].trim();
            const submitUserAgent = req.headers['user-agent'];
            const submitTime = new Date();

            // Validate attempt ID
            if (!mongoose.Types.ObjectId.isValid(attemptId)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: "Invalid attempt ID"
                });
            }

            // Fetch attempt with quiz data
            const attempt = await QuizAttempt.findById(attemptId)
                .populate("quiz")
                .session(session);

            if (!attempt) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: "Attempt not found"
                });
            }

            // Security: Verify ownership
            if (attempt.user.toString() !== studentId.toString()) {
                await session.abortTransaction();
                logger.warn(`Unauthorized submission attempt by ${studentId} for attempt ${attemptId}`);
                return res.status(403).json({
                    success: false,
                    error: "Not authorized to submit this attempt"
                });
            }

            // Security: Check if already submitted
            if (attempt.status !== "in_progress") {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: "This attempt has already been submitted",
                    status: attempt.status,
                    submittedAt: attempt.endTime
                });
            }

            const quiz = attempt.quiz;

            // Security: Time validation with precise calculations
            const attemptStartTime = new Date(attempt.startTime);
            const actualTimeSpent = Math.floor((submitTime - attemptStartTime) / 1000);
            const allowedDuration = quiz.durationMinutes * 60;
            const gracePeriod = 30; // 30 seconds grace period

            if (actualTimeSpent > (allowedDuration + gracePeriod)) {
                attempt.status = "timeout";
                attempt.endTime = submitTime;
                attempt.timeSpentSeconds = actualTimeSpent;
                attempt.isFlagged = true;
                attempt.flaggedReasons.push({
                    reason: "Submission after time limit expired",
                    timestamp: submitTime,
                    severity: "high",
                    details: `Time spent: ${actualTimeSpent}s, Allowed: ${allowedDuration}s`
                });
                await attempt.save({ session });
                await session.commitTransaction();

                logger.warn(`Time exceeded submission: attemptId=${attemptId}, time=${actualTimeSpent}s`);

                return res.status(400).json({
                    success: false,
                    error: "Quiz time expired",
                    timeExceeded: true,
                    timeSpent: actualTimeSpent,
                    allowedTime: allowedDuration
                });
            }

            // Security: Validate answers format
            if (!Array.isArray(answers)) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: "Invalid answers format"
                });
            }

            // Store raw answers with server timestamps
            attempt.rawAnswers = answers.map(ans => ({
                questionId: ans.questionId,
                answer: ans.answer,
                clientTimestamp: ans.clientTimestamp ? new Date(ans.clientTimestamp) : undefined,
                serverTimestamp: submitTime
            }));

            // Anti-cheat: Update tracking
            attempt.tabSwitches = Math.max(attempt.tabSwitches || 0, tabSwitches || 0);
            attempt.ipAtEnd = submitIP;
            attempt.userAgentEnd = submitUserAgent;

            // Flag excessive tab switches
            const maxTabSwitches = quiz.antiCheatSettings?.maxTabSwitches || 5;
            if (attempt.tabSwitches > maxTabSwitches) {
                attempt.isFlagged = true;
                attempt.flaggedReasons.push({
                    reason: `Excessive tab switches detected`,
                    timestamp: submitTime,
                    severity: "high",
                    details: `Count: ${attempt.tabSwitches}, Max allowed: ${maxTabSwitches}`
                });
            }

            // Flag IP address changes
            if (quiz.antiCheatSettings?.trackIPAddress && !quiz.antiCheatSettings?.allowIPChange) {
                if (attempt.ipAtStart && submitIP && attempt.ipAtStart !== submitIP) {
                    attempt.isFlagged = true;
                    attempt.flaggedReasons.push({
                        reason: "IP address changed during quiz",
                        timestamp: submitTime,
                        severity: "medium",
                        details: `Start IP: ${attempt.ipAtStart}, End IP: ${submitIP}`
                    });
                }
            }

            // Flag user agent changes
            if (attempt.userAgentStart && submitUserAgent &&
                attempt.userAgentStart !== submitUserAgent) {
                attempt.isFlagged = true;
                attempt.flaggedReasons.push({
                    reason: "User agent changed during quiz",
                    timestamp: submitTime,
                    severity: "medium"
                });
            }

            // Flag fingerprint mismatch
            if (attempt.clientFingerprint && clientFingerprint &&
                attempt.clientFingerprint !== clientFingerprint) {
                attempt.isFlagged = true;
                attempt.flaggedReasons.push({
                    reason: "Client fingerprint mismatch",
                    timestamp: submitTime,
                    severity: "high"
                });
            }

            // Flag suspiciously fast completion
            const minReasonableTime = Math.min(quiz.durationMinutes * 60 * 0.1, 60); // 10% of duration or 60s
            if (actualTimeSpent < minReasonableTime) {
                attempt.isFlagged = true;
                attempt.flaggedReasons.push({
                    reason: "Suspiciously fast completion",
                    timestamp: submitTime,
                    severity: "medium",
                    details: `Completed in ${actualTimeSpent}s (< ${minReasonableTime}s minimum)`
                });
            }

            // Grading: Load questions with correct answers
            const questionIds = attempt.selectedQuestions.map(sq => sq.question);
            const questions = await Question.find({
                _id: { $in: questionIds }
            }).session(session);

            const questionMap = new Map(
                questions.map(q => [q._id.toString(), q])
            );

            // Grading: Calculate scores
            let totalScore = 0;
            let correctCount = 0;
            let wrongCount = 0;
            let partialCount = 0;
            let unansweredCount = 0;
            const autoGradeResult = [];

            for (const sq of attempt.selectedQuestions) {
                const questionId = sq.question.toString();
                const questionData = questionMap.get(questionId);

                if (!questionData) {
                    logger.error(`Question ${questionId} not found during grading`);
                    continue;
                }

                const submitted = answers.find(a => a.questionId.toString() === questionId);
                const marks = sq.marks || questionData.marks || 1;
                const negativeMarks = questionData.negativeMarks || 0;

                // Not answered
                if (!submitted || submitted.answer === null ||
                    submitted.answer === undefined || submitted.answer === '') {
                    autoGradeResult.push({
                        questionId: questionData._id,
                        score: 0,
                        maxScore: marks,
                        isCorrect: false,
                        isPartial: false,
                        feedback: "Not answered",
                        correctAnswer: quiz.showCorrectAnswers ? questionData.correct : undefined
                    });
                    unansweredCount++;
                    continue;
                }

                // MCQ Single Correct
                if (questionData.type === "mcq_single") {
                    const correctAnswer = questionData.correct;
                    const submittedAnswer = submitted.answer;
                    const isCorrect = submittedAnswer.toString() === correctAnswer.toString();

                    let earnedScore = isCorrect ? marks : -negativeMarks;
                    totalScore += earnedScore;

                    if (isCorrect) correctCount++;
                    else wrongCount++;

                    autoGradeResult.push({
                        questionId: questionData._id,
                        score: earnedScore,
                        maxScore: marks,
                        isCorrect,
                        isPartial: false,
                        feedback: isCorrect ? "Correct" : "Incorrect",
                        submittedAnswer: submittedAnswer,
                        correctAnswer: quiz.showCorrectAnswers ? correctAnswer : undefined
                    });
                }

                // MCQ Multiple Correct
                else if (questionData.type === "mcq_multi") {
                    const correctChoices = questionData.choices
                        .filter(c => c.isCorrect)
                        .map(c => c.id)
                        .sort();

                    const submittedChoices = Array.isArray(submitted.answer)
                        ? submitted.answer.map(a => a.toString()).sort()
                        : [];

                    const isExactMatch = JSON.stringify(correctChoices) === JSON.stringify(submittedChoices);

                    if (isExactMatch) {
                        totalScore += marks;
                        correctCount++;

                        autoGradeResult.push({
                            questionId: questionData._id,
                            score: marks,
                            maxScore: marks,
                            isCorrect: true,
                            isPartial: false,
                            feedback: "All correct answers selected",
                            submittedAnswer: submittedChoices,
                            correctAnswer: quiz.showCorrectAnswers ? correctChoices : undefined
                        });
                    } else {
                        const correctSelected = submittedChoices.filter(sc =>
                            correctChoices.includes(sc)
                        ).length;
                        const wrongSelected = submittedChoices.filter(sc =>
                            !correctChoices.includes(sc)
                        ).length;

                        const partialScore = Math.max(0,
                            ((correctSelected - wrongSelected) / correctChoices.length) * marks
                        );

                        totalScore += partialScore;

                        if (partialScore > 0) {
                            partialCount++;
                        } else {
                            wrongCount++;
                        }

                        autoGradeResult.push({
                            questionId: questionData._id,
                            score: partialScore,
                            maxScore: marks,
                            isCorrect: false,
                            isPartial: partialScore > 0,
                            feedback: partialScore > 0
                                ? `Partially correct (${correctSelected}/${correctChoices.length} correct, ${wrongSelected} wrong)`
                                : "Incorrect",
                            submittedAnswer: submittedChoices,
                            correctAnswer: quiz.showCorrectAnswers ? correctChoices : undefined
                        });
                    }
                }

                // True/False
                else if (questionData.type === "true_false") {
                    const correctAnswer = questionData.correct;
                    const submittedAnswer = submitted.answer;
                    const isCorrect = submittedAnswer.toString().toLowerCase() ===
                        correctAnswer.toString().toLowerCase();

                    let earnedScore = isCorrect ? marks : -negativeMarks;
                    totalScore += earnedScore;

                    if (isCorrect) correctCount++;
                    else wrongCount++;

                    autoGradeResult.push({
                        questionId: questionData._id,
                        score: earnedScore,
                        maxScore: marks,
                        isCorrect,
                        isPartial: false,
                        feedback: isCorrect ? "Correct" : "Incorrect",
                        submittedAnswer,
                        correctAnswer: quiz.showCorrectAnswers ? correctAnswer : undefined
                    });
                }

                // Numeric
                else if (questionData.type === "numeric") {
                    const correctAnswer = parseFloat(questionData.correct);
                    const submittedAnswer = parseFloat(submitted.answer);
                    const tolerance = questionData.tolerance || 0.01;

                    const isCorrect = Math.abs(submittedAnswer - correctAnswer) <= tolerance;

                    let earnedScore = isCorrect ? marks : -negativeMarks;
                    totalScore += earnedScore;

                    if (isCorrect) correctCount++;
                    else wrongCount++;

                    autoGradeResult.push({
                        questionId: questionData._id,
                        score: earnedScore,
                        maxScore: marks,
                        isCorrect,
                        isPartial: false,
                        feedback: isCorrect ? "Correct" : "Incorrect",
                        submittedAnswer,
                        correctAnswer: quiz.showCorrectAnswers ? correctAnswer : undefined
                    });
                }
            }

            // Ensure totalScore is not negative
            totalScore = Math.max(0, totalScore);

            // Finalize attempt
            attempt.totalScore = totalScore;
            attempt.correctCount = correctCount;
            attempt.wrongCount = wrongCount;
            attempt.partialCount = partialCount;
            attempt.unansweredCount = unansweredCount;
            attempt.status = "submitted";
            attempt.endTime = submitTime;
            attempt.timeSpentSeconds = timeSpentSeconds || actualTimeSpent;
            attempt.autoGradeResult = autoGradeResult;
            attempt.passed = totalScore >= quiz.passingMarks;
            attempt.percentage = (totalScore / attempt.maxScore) * 100;
            attempt.isAutoSubmit = isAutoSubmit || false;

            await attempt.save({ session });

            // Update quiz statistics
            const allAttempts = await QuizAttempt.find({
                quiz: quiz._id,
                status: { $in: ['submitted', 'auto_graded', 'manually_graded'] }
            }).session(session);

            const avgScore = allAttempts.length > 0
                ? allAttempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / allAttempts.length
                : 0;

            await Quiz.findByIdAndUpdate(
                quiz._id,
                {
                    $inc: { totalAttempts: 1 },
                    $set: { averageScore: avgScore }
                },
                { session }
            );

            await session.commitTransaction();

            logger.info(`Quiz submitted: attemptId=${attemptId}, score=${totalScore}/${attempt.maxScore}, user=${studentId}`);

            return res.json({
                success: true,
                message: "Quiz submitted successfully",
                data: {
                    attemptId,
                    totalScore,
                    maxScore: attempt.maxScore,
                    correctCount,
                    wrongCount,
                    partialCount,
                    unansweredCount,
                    percentage: attempt.percentage.toFixed(2),
                    passed: attempt.passed,
                    passingMarks: quiz.passingMarks,
                    isFlagged: attempt.isFlagged,
                    flaggedReasons: attempt.isFlagged ? attempt.flaggedReasons : undefined,
                    showCorrectAnswers: quiz.showCorrectAnswers,
                    results: quiz.showCorrectAnswers ? autoGradeResult : undefined
                }
            });

        } catch (error) {
            await session.abortTransaction();
            logger.error("Submit quiz error:", error);
            next(error);
        } finally {
            session.endSession();
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
                .select('-rawAnswers -selectedQuestions')
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
                .populate("selectedQuestions.question");

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
            logger.error("Attempt detail error:", error);
            next(error);
        }
    }
    async getMyEnrolledQuizzes(req, res, next) {
        try {
            const studentId = req.user._id;

            // Find all enrollments of this student
            const enrollments = await QuizEnrollment.find({ student: studentId })
                .populate({
                    path: "quiz",
                    populate: [
                        { path: "subject", select: "name" },
                        { path: "createdBy", select: "name email" }
                    ]
                })
                .sort({ createdAt: -1 });

            const enrolledQuizzes = await Promise.all(
                enrollments.map(async (en) => {
                    const quiz = en.quiz;

                    // Count attempts
                    const attemptCount = await QuizAttempt.countDocuments({
                        quiz: quiz._id,
                        user: studentId
                    });

                    return {
                        _id: quiz._id,
                        title: quiz.title,
                        description: quiz.description,
                        subject: quiz.subject,
                        startTime: quiz.startTime,
                        endTime: quiz.endTime,
                        durationMinutes: quiz.durationMinutes,
                        attemptsAllowed: quiz.attemptsAllowed,
                        userAttemptCount: attemptCount,
                        attemptsRemaining: quiz.attemptsAllowed - attemptCount,
                        isPublished: quiz.isPublished,
                        createdBy: quiz.createdBy,
                    };
                })
            );

            return res.json({
                success: true,
                data: enrolledQuizzes
            });

        } catch (error) {
            console.error("Get enrolled quizzes error:", error);
            next(error);
        }
    }
    async autoSaveAnswers(req, res, next) {
        try {
            const { attemptId } = req.params;
            const { answers, tabSwitches } = req.body;
            const studentId = req.user._id;

            const attempt = await QuizAttempt.findById(attemptId);

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: "Attempt not found"
                });
            }

            // Verify ownership
            if (attempt.user.toString() !== studentId.toString()) {
                return res.status(403).json({
                    success: false,
                    error: "Not authorized"
                });
            }

            // Only save if in progress
            if (attempt.status !== "in_progress") {
                return res.status(400).json({
                    success: false,
                    error: "Cannot save to completed attempt"
                });
            }

            // Update raw answers (don't replace, merge)
            if (answers && answers.length > 0) {
                const answerMap = new Map();

                // First add existing answers
                if (attempt.rawAnswers) {
                    attempt.rawAnswers.forEach(ans => {
                        answerMap.set(ans.questionId.toString(), ans);
                    });
                }

                // Update with new answers
                answers.forEach(ans => {
                    answerMap.set(ans.questionId.toString(), {
                        questionId: ans.questionId,
                        answer: ans.answer,
                        clientTimestamp: ans.clientTimestamp,
                        serverTimestamp: new Date()
                    });
                });

                attempt.rawAnswers = Array.from(answerMap.values());
            }

            // Update tab switches
            if (tabSwitches !== undefined) {
                attempt.tabSwitches = Math.max(attempt.tabSwitches || 0, tabSwitches);
            }

            await attempt.save();

            return res.json({
                success: true,
                message: "Progress saved",
                savedAt: new Date()
            });

        } catch (error) {
            logger.error("Auto-save error:", error);
            next(error);
        }
    }
    async getAttemptById(req, res, next) {
        try {
            const { attemptId } = req.params;
            const studentId = req.user._id;

            const attempt = await QuizAttempt.findById(attemptId)
                .populate({
                    path: "quiz",
                    select: "title durationMinutes totalMarks passingMarks antiCheatSettings startTime endTime showCorrectAnswers"
                })
                .populate({
                    path: "selectedQuestions.question",
                    model: "Question",
                    select: "_id"
                });

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: "Attempt not found"
                });
            }

            // SECURITY: Verify ownership
            if (attempt.user.toString() !== studentId.toString()) {
                logger.warn(`Unauthorized attempt access by ${studentId} for attempt ${attemptId}`);
                return res.status(403).json({
                    success: false,
                    error: "Not authorized to view this attempt"
                });
            }

            // SECURITY: Check if quiz time window is still valid
            const now = new Date();
            if (attempt.status === "in_progress") {
                if (now > attempt.quiz.endTime) {
                    attempt.status = "timeout";
                    attempt.endTime = now;
                    attempt.timeSpentSeconds = Math.floor(
                        (now - new Date(attempt.startTime)) / 1000
                    );
                    await attempt.save();

                    return res.status(400).json({
                        success: false,
                        error: "Quiz time window has ended",
                        timeExpired: true
                    });
                }

                const durationMs = attempt.quiz.durationMinutes * 60 * 1000;
                const elapsed = now - new Date(attempt.startTime);

                if (elapsed > durationMs) {
                    attempt.status = "timeout";
                    attempt.endTime = now;
                    attempt.timeSpentSeconds = Math.floor(elapsed / 1000);
                    await attempt.save();

                    return res.status(400).json({
                        success: false,
                        error: "Quiz duration exceeded",
                        timeExpired: true
                    });
                }
            }

            // SECURITY: Don't expose correct answers during attempt
            if (attempt.status === "in_progress") {
                const sanitizedAttempt = attempt.toObject();

                if (sanitizedAttempt.selectedQuestions) {
                    sanitizedAttempt.selectedQuestions = sanitizedAttempt.selectedQuestions.map(sq => ({
                        question: sq.question,
                        prompt: sq.prompt,
                        type: sq.type,
                        marks: sq.marks,
                        choices: sq.choices
                    }));
                }

                delete sanitizedAttempt.autoGradeResult;
                delete sanitizedAttempt.manualGradeResult;

                return res.json({
                    success: true,
                    data: sanitizedAttempt
                });
            }

            // For completed attempts, return full data
            return res.json({
                success: true,
                data: attempt
            });

        } catch (error) {
            logger.error("Get attempt error:", error);
            next(error);
        }
    }

    async getQuizEnrollments(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, search = '' } = req.query;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(id, req.user._id, req.user.role);

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build search query
            let studentQuery = {};
            if (search) {
                studentQuery = {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                };
            }

            // Get matching students first
            const students = search ? await User.find(studentQuery).select('_id') : null;
            const studentIds = students ? students.map(s => s._id) : null;

            // Build enrollment query
            const enrollmentQuery = { quiz: id };
            if (studentIds) {
                enrollmentQuery.student = { $in: studentIds };
            }

            // Get enrollments with pagination
            const [enrollments, total] = await Promise.all([
                QuizEnrollment.find(enrollmentQuery)
                    .populate('student', 'name email registrationNumber semester department')
                    .sort({ enrolledAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                QuizEnrollment.countDocuments(enrollmentQuery)
            ]);

            // Get attempt statistics for each enrolled student
            const enrichedEnrollments = await Promise.all(
                enrollments.map(async (enrollment) => {
                    const attempts = await QuizAttempt.find({
                        quiz: id,
                        user: enrollment.student._id
                    }).select('status totalScore maxScore endTime');

                    const completedAttempts = attempts.filter(a =>
                        ['submitted', 'auto_graded', 'manually_graded'].includes(a.status)
                    );

                    const bestScore = completedAttempts.length > 0
                        ? Math.max(...completedAttempts.map(a => a.totalScore || 0))
                        : null;

                    return {
                        _id: enrollment._id,
                        student: enrollment.student,
                        enrolledAt: enrollment.enrolledAt,
                        stats: {
                            totalAttempts: attempts.length,
                            completedAttempts: completedAttempts.length,
                            inProgressAttempts: attempts.filter(a => a.status === 'in_progress').length,
                            bestScore,
                            lastAttemptDate: attempts.length > 0
                                ? attempts[attempts.length - 1].endTime
                                : null
                        }
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    enrollments: enrichedEnrollments,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    },
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        totalMarks: quiz.totalMarks
                    }
                }
            });
        } catch (error) {
            logger.error('Get quiz enrollments error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    // ============================================
    // GET QUIZ ATTEMPTS (Trainer/Admin)
    // ============================================
    async getQuizAttempts(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, status, studentId, search = '' } = req.query;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(id, req.user._id, req.user.role);

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build query
            const query = { quiz: id };
            if (status) query.status = status;
            if (studentId) query.user = studentId;

            // Search by student name/email if provided
            if (search) {
                const students = await User.find({
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                }).select('_id');

                query.user = { $in: students.map(s => s._id) };
            }

            // Get attempts with pagination
            const [attempts, total] = await Promise.all([
                QuizAttempt.find(query)
                    .populate('user', 'name email registrationNumber semester department')
                    .sort({ startTime: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                QuizAttempt.countDocuments(query)
            ]);

            // Calculate summary statistics
            const allAttempts = await QuizAttempt.find({ quiz: id });
            const summary = {
                total: allAttempts.length,
                inProgress: allAttempts.filter(a => a.status === 'in_progress').length,
                submitted: allAttempts.filter(a => a.status === 'submitted').length,
                graded: allAttempts.filter(a => ['auto_graded', 'manually_graded'].includes(a.status)).length,
                flagged: allAttempts.filter(a => a.status === 'flagged').length,
                averageScore: allAttempts.length > 0
                    ? allAttempts.reduce((sum, a) => sum + (a.totalScore || 0), 0) / allAttempts.length
                    : 0
            };

            res.json({
                success: true,
                data: {
                    attempts,
                    summary,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    },
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        totalMarks: quiz.totalMarks,
                        passingMarks: quiz.passingMarks
                    }
                }
            });
        } catch (error) {
            logger.error('Get quiz attempts error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    // ============================================
    // GET ATTEMPT DETAILS (Trainer/Admin)
    // ============================================
    async getAttemptDetails(req, res, next) {
        try {
            const { id, attemptId } = req.params;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(id, req.user._id, req.user.role);

            // Get attempt with all details
            const attempt = await QuizAttempt.findOne({
                _id: attemptId,
                quiz: id
            }).populate('user', 'name email registrationNumber semester department');

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            // Get questions with student answers
            const questionIds = attempt.selectedQuestions.map(q => q.question);
            const questions = await Question.find({ _id: { $in: questionIds } });

            // Combine questions with answers and grading
            const questionsWithAnswers = attempt.selectedQuestions.map(sq => {
                const fullQuestion = questions.find(q => q._id.toString() === sq.question.toString());
                const studentAnswer = attempt.rawAnswers.find(a =>
                    a.questionId.toString() === sq.question.toString()
                );
                const gradeResult = attempt.autoGradeResult.find(r =>
                    r.questionId.toString() === sq.question.toString()
                );

                return {
                    question: {
                        _id: fullQuestion._id,
                        prompt: sq.prompt,
                        type: sq.type,
                        marks: sq.marks,
                        choices: sq.choices,
                        correctAnswer: fullQuestion.correct
                    },
                    studentAnswer: studentAnswer?.answer,
                    timeSpent: studentAnswer?.timeSpentOnQuestion,
                    grading: gradeResult ? {
                        score: gradeResult.score,
                        maxScore: gradeResult.maxScore,
                        isCorrect: gradeResult.isCorrect,
                        feedback: gradeResult.feedback
                    } : null
                };
            });

            // Get anti-cheat audit logs
            const AuditLog = require('../models/AuditLog');
            const auditLogs = await AuditLog.find({ attemptId })
                .sort({ timestamp: 1 })
                .limit(100);

            res.json({
                success: true,
                data: {
                    attempt: {
                        _id: attempt._id,
                        status: attempt.status,
                        startTime: attempt.startTime,
                        endTime: attempt.endTime,
                        timeSpentSeconds: attempt.timeSpentSeconds,
                        totalScore: attempt.totalScore,
                        maxScore: attempt.maxScore,
                        percentage: attempt.percentage,
                        passed: attempt.passed,
                        correctCount: attempt.correctCount,
                        wrongCount: attempt.wrongCount,
                        unansweredCount: attempt.unansweredCount
                    },
                    student: attempt.user,
                    antiCheat: {
                        tabSwitches: attempt.tabSwitches,
                        copyPasteEvents: attempt.copyPasteEvents,
                        fullScreenExits: attempt.fullScreenExits,
                        ipAtStart: attempt.ipAtStart,
                        ipAtEnd: attempt.ipAtEnd,
                        isFlagged: attempt.isFlagged,
                        flaggedReasons: attempt.flaggedReasons,
                        auditLogs: auditLogs.map(log => ({
                            eventType: log.eventType,
                            timestamp: log.timestamp,
                            meta: log.meta
                        }))
                    },
                    questionsWithAnswers,
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        showCorrectAnswers: quiz.showCorrectAnswers
                    }
                }
            });
        } catch (error) {
            logger.error('Get attempt details error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

}

module.exports = new QuizzesController();
