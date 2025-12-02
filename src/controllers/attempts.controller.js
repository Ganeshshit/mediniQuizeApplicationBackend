
// controllers/attempts.controller.js
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const config = require('../config');
const gradingService = require('../services/grading.service');

class AttemptsController {
    /**
     * POST /api/quizzes/:quizId/start
     * Start a new quiz attempt (Student)
     */
    async startAttempt(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const userId = req.user._id;

            // Fetch quiz with validation
            const quiz = await Quiz.findById(quizId)
                .populate('questionIds')
                .session(session);

            if (!quiz) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Quiz not found'
                });
            }

            // Check if quiz is published
            if (!quiz.isPublished) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: 'Quiz is not published'
                });
            }

            // Check time window
            const now = new Date();
            if (now < quiz.startTime) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: 'Quiz has not started yet',
                    startsAt: quiz.startTime
                });
            }

            if (now > quiz.endTime) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: 'Quiz has ended',
                    endedAt: quiz.endTime
                });
            }

            // Check existing attempts
            const existingAttempts = await QuizAttempt.find({
                quiz: quizId,
                user: userId
            }).session(session);

            const attemptCount = existingAttempts.length;

            if (attemptCount >= quiz.attemptsAllowed) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: 'Maximum attempts reached',
                    attemptCount,
                    attemptsAllowed: quiz.attemptsAllowed
                });
            }

            // Check for in-progress attempt
            const inProgressAttempt = existingAttempts.find(
                attempt => attempt.status === 'in_progress'
            );

            if (inProgressAttempt) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'You have an in-progress attempt',
                    attemptId: inProgressAttempt._id
                });
            }

            // Get questions for this attempt
            let questions = [];
            if (quiz.questionMode === 'fixed_list') {
                questions = quiz.questionIds;
            } else if (quiz.questionMode === 'pool_random') {
                // Fetch random questions based on pool filter
                const filter = quiz.questionPoolFilter;
                const query = {};

                if (filter.subject) {
                    query.subject = filter.subject;
                }
                if (filter.difficulty && filter.difficulty.length > 0) {
                    query['metadata.difficulty'] = { $in: filter.difficulty };
                }
                if (filter.tags && filter.tags.length > 0) {
                    query['metadata.tags'] = { $in: filter.tags };
                }

                questions = await Question.aggregate([
                    { $match: query },
                    { $sample: { size: filter.count || 10 } }
                ]).session(session);
            }

            if (questions.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'No questions available for this quiz'
                });
            }

            // Shuffle questions if enabled
            if (quiz.shuffleQuestions) {
                questions = this.shuffleArray(questions);
            }

            // Calculate max score
            const maxScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

            // Create attempt
            const attempt = new QuizAttempt({
                quiz: quizId,
                user: userId,
                startTime: now,
                status: 'in_progress',
                rawAnswers: [],
                attemptIndex: attemptCount + 1,
                maxScore,
                ipAtStart: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgentStart: req.headers['user-agent'],
                tabSwitches: 0
            });

            await attempt.save({ session });

            // Update quiz stats
            quiz.totalAttempts += 1;
            await quiz.save({ session });

            await session.commitTransaction();

            // Prepare questions for client (strip correct answers)
            const clientQuestions = questions.map(q => {
                const question = q.toObject ? q.toObject() : q;

                // Shuffle choices if enabled
                if (quiz.shuffleChoices && question.choices) {
                    question.choices = this.shuffleArray([...question.choices]);
                }

                // Remove correct answer info
                return {
                    _id: question._id,
                    type: question.type,
                    prompt: question.prompt,
                    choices: question.choices,
                    marks: question.marks,
                    // DO NOT send 'correct' field to client
                };
            });

            logger.info(`Quiz attempt started: ${attempt._id} by ${req.user.email}`);

            res.status(201).json({
                success: true,
                data: {
                    attemptId: attempt._id,
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        description: quiz.description,
                        durationMinutes: quiz.durationMinutes,
                        totalMarks: quiz.totalMarks,
                        instructions: quiz.instructions,
                        antiCheatSettings: quiz.antiCheatSettings
                    },
                    questions: clientQuestions,
                    startTime: attempt.startTime,
                    serverTime: now,
                    maxScore: attempt.maxScore
                }
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Start attempt error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * POST /api/quizzes/:quizId/save
     * Save answers incrementally (autosave)
     */
    async saveAnswers(req, res, next) {
        try {
            const { quizId } = req.params;
            const { attemptId, answers } = req.body;
            const userId = req.user._id;

            // Fetch attempt
            const attempt = await QuizAttempt.findOne({
                _id: attemptId,
                quiz: quizId,
                user: userId,
                status: 'in_progress'
            });

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Active attempt not found'
                });
            }

            // Check if attempt has expired
            const quiz = await Quiz.findById(quizId);
            const timeLimit = quiz.durationMinutes * 60 * 1000; // Convert to ms
            const elapsed = new Date() - attempt.startTime;

            if (elapsed > timeLimit) {
                // Auto-submit if time expired
                attempt.status = 'submitted';
                attempt.endTime = new Date(attempt.startTime.getTime() + timeLimit);
                await attempt.save();

                return res.status(400).json({
                    success: false,
                    error: 'Time limit exceeded. Attempt auto-submitted.',
                    attemptId: attempt._id
                });
            }

            // Merge/update answers
            const existingAnswers = attempt.rawAnswers || [];

            answers.forEach(newAnswer => {
                const existingIndex = existingAnswers.findIndex(
                    a => a.questionId.toString() === newAnswer.questionId.toString()
                );

                if (existingIndex >= 0) {
                    // Update existing answer
                    existingAnswers[existingIndex] = {
                        ...newAnswer,
                        serverTimestamp: new Date()
                    };
                } else {
                    // Add new answer
                    existingAnswers.push({
                        ...newAnswer,
                        serverTimestamp: new Date()
                    });
                }
            });

            attempt.rawAnswers = existingAnswers;
            await attempt.save();

            res.json({
                success: true,
                message: 'Answers saved',
                savedCount: answers.length,
                totalAnswered: existingAnswers.length
            });
        } catch (error) {
            logger.error('Save answers error:', error);
            next(error);
        }
    }

    /**
     * POST /api/quizzes/:quizId/submit
     * Submit attempt for grading
     */
    async submitAttempt(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { attemptId } = req.body;
            const userId = req.user._id;

            // Fetch attempt
            const attempt = await QuizAttempt.findOne({
                _id: attemptId,
                quiz: quizId,
                user: userId
            }).session(session);

            if (!attempt) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            if (attempt.status !== 'in_progress') {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Attempt already submitted',
                    status: attempt.status
                });
            }

            const quiz = await Quiz.findById(quizId).session(session);
            const now = new Date();

            // Set end time
            attempt.endTime = now;
            attempt.status = 'submitted';
            attempt.ipAtEnd = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            attempt.userAgentEnd = req.headers['user-agent'];

            // Check for suspicious activity
            const flaggedReasons = [];

            // Check tab switches
            if (attempt.tabSwitches > config.antiCheat.maxTabSwitches) {
                flaggedReasons.push(`Excessive tab switches: ${attempt.tabSwitches}`);
            }

            // Check IP change
            if (attempt.ipAtStart !== attempt.ipAtEnd && !config.antiCheat.allowIPChange) {
                flaggedReasons.push('IP address changed during attempt');
            }

            // Check time anomalies
            const expectedMinTime = quiz.durationMinutes * 60 * 1000;
            const actualTime = attempt.endTime - attempt.startTime;

            if (actualTime < (expectedMinTime * 0.1)) {
                // Submitted too quickly (less than 10% of allowed time)
                flaggedReasons.push('Submitted suspiciously fast');
            }

            if (flaggedReasons.length > 0) {
                attempt.status = 'flagged';
                attempt.flaggedReasons = flaggedReasons;
            }

            // Auto-grade the attempt
            const gradingResult = await gradingService.autoGrade(attempt, quiz);

            attempt.autoGradeResult = gradingResult.results;
            attempt.totalScore = gradingResult.totalScore;

            // Determine final status
            if (flaggedReasons.length > 0) {
                attempt.status = 'flagged';
            } else if (gradingResult.needsManualReview) {
                attempt.status = 'needs_manual_review';
            } else {
                attempt.status = 'auto_graded';
            }

            await attempt.save({ session });

            // Update quiz average score
            const allGradedAttempts = await QuizAttempt.find({
                quiz: quizId,
                status: { $in: ['auto_graded', 'flagged'] }
            }).session(session);

            if (allGradedAttempts.length > 0) {
                const avgScore = allGradedAttempts.reduce(
                    (sum, a) => sum + (a.totalScore || 0),
                    0
                ) / allGradedAttempts.length;

                quiz.averageScore = avgScore;
                await quiz.save({ session });
            }

            await session.commitTransaction();

            logger.info(`Quiz attempt submitted: ${attempt._id} by ${req.user.email}`);

            // Prepare response based on quiz settings
            const response = {
                success: true,
                data: {
                    attemptId: attempt._id,
                    status: attempt.status,
                    endTime: attempt.endTime,
                    flaggedReasons: attempt.flaggedReasons
                }
            };

            if (quiz.showResultsImmediately && attempt.status === 'auto_graded') {
                response.data.totalScore = attempt.totalScore;
                response.data.maxScore = attempt.maxScore;
                response.data.percentage = ((attempt.totalScore / attempt.maxScore) * 100).toFixed(2);
                response.data.passed = attempt.totalScore >= quiz.passingMarks;
            }

            if (quiz.showCorrectAnswers && attempt.status === 'auto_graded') {
                response.data.results = attempt.autoGradeResult;
            }

            res.json(response);
        } catch (error) {
            await session.abortTransaction();
            logger.error('Submit attempt error:', error);
            next(error);
        } finally {
            session.endSession();
        }
    }

    /**
     * GET /api/quizzes/:quizId/attempts/:attemptId
     * Get attempt results
     */
    async getAttempt(req, res, next) {
        try {
            const { quizId, attemptId } = req.params;
            const userId = req.user._id;

            const attempt = await QuizAttempt.findOne({
                _id: attemptId,
                quiz: quizId
            }).populate('quiz').populate('user', 'name email');

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            // Access control: students can only see their own attempts
            if (req.user.role === 'student' && attempt.user._id.toString() !== userId.toString()) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const quiz = attempt.quiz;

            // Student view - filtered data based on quiz settings
            if (req.user.role === 'student') {
                const response = {
                    success: true,
                    data: {
                        attemptId: attempt._id,
                        quiz: {
                            id: quiz._id,
                            title: quiz.title
                        },
                        status: attempt.status,
                        startTime: attempt.startTime,
                        endTime: attempt.endTime,
                        attemptIndex: attempt.attemptIndex
                    }
                };

                // Show results based on quiz settings
                if (attempt.status === 'auto_graded' || attempt.status === 'flagged') {
                    if (quiz.showResultsImmediately) {
                        response.data.totalScore = attempt.totalScore;
                        response.data.maxScore = attempt.maxScore;
                        response.data.percentage = ((attempt.totalScore / attempt.maxScore) * 100).toFixed(2);
                        response.data.passed = attempt.totalScore >= quiz.passingMarks;
                    }

                    if (quiz.showCorrectAnswers) {
                        response.data.results = attempt.autoGradeResult;
                    }
                }

                if (attempt.status === 'needs_manual_review') {
                    response.data.message = 'Your answers are being reviewed by the instructor';
                }

                if (attempt.status === 'flagged') {
                    response.data.message = 'Your attempt has been flagged for review';
                }

                return res.json(response);
            }

            // Trainer/Admin view - full data
            res.json({
                success: true,
                data: attempt
            });
        } catch (error) {
            logger.error('Get attempt error:', error);
            next(error);
        }
    }

    /**
     * GET /api/quizzes/:quizId/attempts
     * List all attempts for a quiz (Trainer/Admin)
     */
    async listAttempts(req, res, next) {
        try {
            const { quizId } = req.params;
            const { page = 1, limit = 20, status, userId } = req.query;

            const query = { quiz: quizId };

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
            logger.error('List attempts error:', error);
            next(error);
        }
    }

    /**
     * GET /api/grading/pending
     * Get all attempts needing manual grading (Trainer/Admin)
     */
    async getPendingGrading(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [attempts, total] = await Promise.all([
                QuizAttempt.find({
                    status: 'needs_manual_review'
                })
                    .populate('user', 'name email')
                    .populate('quiz', 'title subject')
                    .sort({ endTime: 1 }) // Oldest first
                    .skip(skip)
                    .limit(parseInt(limit)),
                QuizAttempt.countDocuments({
                    status: 'needs_manual_review'
                })
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
            logger.error('Get pending grading error:', error);
            next(error);
        }
    }

    /**
     * GET /api/grading/:attemptId
     * Get attempt details for grading (Trainer/Admin)
     */
    async getAttemptForGrading(req, res, next) {
        try {
            const { attemptId } = req.params;

            const attempt = await QuizAttempt.findById(attemptId)
                .populate('user', 'name email')
                .populate('quiz');

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            const quiz = attempt.quiz;

            // Get questions with student answers
            let questions;
            if (quiz.questionMode === 'fixed_list') {
                questions = await Question.find({
                    _id: { $in: quiz.questionIds }
                });
            } else {
                // Extract question IDs from rawAnswers
                const questionIds = attempt.rawAnswers.map(a => a.questionId);
                questions = await Question.find({
                    _id: { $in: questionIds }
                });
            }

            // Combine questions with student answers
            const questionsWithAnswers = questions.map(question => {
                const studentAnswer = attempt.rawAnswers.find(
                    a => a.questionId.toString() === question._id.toString()
                );

                const autoGrade = attempt.autoGradeResult?.[question._id.toString()];

                return {
                    question: question,
                    studentAnswer: studentAnswer?.answer,
                    autoGrade: autoGrade,
                    clientTimestamp: studentAnswer?.clientTimestamp,
                    serverTimestamp: studentAnswer?.serverTimestamp
                };
            });

            res.json({
                success: true,
                data: {
                    attempt: {
                        id: attempt._id,
                        status: attempt.status,
                        startTime: attempt.startTime,
                        endTime: attempt.endTime,
                        totalScore: attempt.totalScore,
                        maxScore: attempt.maxScore,
                        tabSwitches: attempt.tabSwitches,
                        flaggedReasons: attempt.flaggedReasons
                    },
                    student: attempt.user,
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        totalMarks: quiz.totalMarks,
                        passingMarks: quiz.passingMarks
                    },
                    questionsWithAnswers
                }
            });
        } catch (error) {
            logger.error('Get attempt for grading error:', error);
            next(error);
        }
    }

    /**
     * POST /api/grading/:attemptId
     * Grade a specific answer (Trainer/Admin)
     */
    async gradeAnswer(req, res, next) {
        try {
            const { attemptId } = req.params;
            const { questionId, score, feedback } = req.body;

            const attempt = await QuizAttempt.findById(attemptId);

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            // Get question to validate score
            const question = await Question.findById(questionId);
            if (!question) {
                return res.status(404).json({
                    success: false,
                    error: 'Question not found'
                });
            }

            if (score > question.marks) {
                return res.status(400).json({
                    success: false,
                    error: `Score cannot exceed ${question.marks} marks`
                });
            }

            // Update autoGradeResult with manual grade
            if (!attempt.autoGradeResult) {
                attempt.autoGradeResult = {};
            }

            attempt.autoGradeResult[questionId] = {
                score,
                feedback,
                manuallyGraded: true,
                gradedBy: req.user._id,
                gradedAt: new Date()
            };

            // Recalculate total score
            const totalScore = Object.values(attempt.autoGradeResult).reduce(
                (sum, result) => sum + (result.score || 0),
                0
            );

            attempt.totalScore = totalScore;

            await attempt.save();

            logger.info(`Answer graded: attempt ${attemptId}, question ${questionId} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'Answer graded successfully',
                data: {
                    questionId,
                    score,
                    totalScore: attempt.totalScore,
                    maxScore: attempt.maxScore
                }
            });
        } catch (error) {
            logger.error('Grade answer error:', error);
            next(error);
        }
    }

    /**
     * PATCH /api/grading/:attemptId/finalize
     * Finalize grading and release results (Trainer/Admin)
     */
    async finalizeGrading(req, res, next) {
        try {
            const { attemptId } = req.params;

            const attempt = await QuizAttempt.findById(attemptId);

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            if (attempt.status !== 'needs_manual_review' && attempt.status !== 'flagged') {
                return res.status(400).json({
                    success: false,
                    error: 'Attempt is not pending review'
                });
            }

            // Verify all questions are graded
            const quiz = await Quiz.findById(attempt.quiz);
            const expectedQuestionCount = quiz.questionMode === 'fixed_list'
                ? quiz.questionIds.length
                : quiz.questionPoolFilter.count;

            const gradedCount = Object.keys(attempt.autoGradeResult || {}).length;

            if (gradedCount < expectedQuestionCount) {
                return res.status(400).json({
                    success: false,
                    error: 'Not all questions have been graded',
                    gradedCount,
                    expectedCount: expectedQuestionCount
                });
            }

            attempt.status = 'auto_graded'; // Finalized status
            await attempt.save();

            logger.info(`Grading finalized: attempt ${attemptId} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'Grading finalized and results released',
                data: {
                    attemptId: attempt._id,
                    totalScore: attempt.totalScore,
                    maxScore: attempt.maxScore,
                    status: attempt.status
                }
            });
        } catch (error) {
            logger.error('Finalize grading error:', error);
            next(error);
        }
    }

    /**
     * POST /api/audit/event
     * Log anti-cheat audit events
     */
    async logAuditEvent(req, res, next) {
        try {
            const { attemptId, eventType, meta } = req.body;
            const userId = req.user._id;

            // Verify attempt belongs to user
            const attempt = await QuizAttempt.findOne({
                _id: attemptId,
                user: userId,
                status: 'in_progress'
            });

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Active attempt not found'
                });
            }

            // Create audit log
            const auditLog = new AuditLog({
                attemptId,
                userId,
                eventType,
                meta,
                timestamp: new Date()
            });

            await auditLog.save();

            // Update attempt counters for specific events
            if (eventType === 'tab_switch') {
                attempt.tabSwitches += 1;

                // Check threshold and flag if exceeded
                if (attempt.tabSwitches >= config.antiCheat.tabSwitchWarning) {
                    logger.warn(`High tab switches detected: ${attempt.tabSwitches} for attempt ${attemptId}`);
                }

                await attempt.save();
            }

            res.json({
                success: true,
                message: 'Event logged',
                tabSwitches: attempt.tabSwitches
            });
        } catch (error) {
            logger.error('Log audit event error:', error);
            next(error);
        }
    }

    /**
     * GET /api/audit/:attemptId
     * Get audit log for an attempt (Trainer/Admin)
     */
    async getAuditLog(req, res, next) {
        try {
            const { attemptId } = req.params;

            const attempt = await QuizAttempt.findById(attemptId);

            if (!attempt) {
                return res.status(404).json({
                    success: false,
                    error: 'Attempt not found'
                });
            }

            const auditLogs = await AuditLog.find({
                attemptId
            }).sort({ timestamp: 1 });

            // Group events by type for summary
            const summary = auditLogs.reduce((acc, log) => {
                if (!acc[log.eventType]) {
                    acc[log.eventType] = 0;
                }
                acc[log.eventType] += 1;
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    attemptId,
                    summary,
                    events: auditLogs,
                    totalEvents: auditLogs.length
                }
            });
        } catch (error) {
            logger.error('Get audit log error:', error);
            next(error);
        }
    }

    /**
     * Utility: Shuffle array (Fisher-Yates)
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

module.exports = new AttemptsController();