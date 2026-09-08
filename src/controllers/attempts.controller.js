
// controllers/attempts.controller.js
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AuditLog = require('../models/AuditLog');
const AuditEvent = require('../models/auditEvent.model');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const config = require('../config');
const gradingService = require('../services/grading.service');
const auditService = require('../services/audit.service');
const monitoringService = require('../services/monitoring.service');

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
            const crypto = require('crypto');
            const sessionId = crypto.randomUUID();
            const attemptToken = crypto.randomUUID();

            const attempt = new QuizAttempt({
                quiz: quizId,
                user: userId,
                startTime: now,
                status: 'in_progress',
                rawAnswers: [],
                attemptNumber: attemptCount + 1,
                attemptIndex: attemptCount + 1,
                attemptToken,
                maxScore,
                ipAtStart: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgentStart: req.headers['user-agent'],
                tabSwitches: 0,
                sessionId,
                expiresAt: new Date(now.getTime() + quiz.durationMinutes * 60 * 1000),
                riskScore: 0,
                violationCount: 0,
                suspicious: false,
                riskLevel: 'low'
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
                    sessionId: attempt.sessionId,
                    attemptToken: attempt.attemptToken,
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
                    expiresAt: attempt.expiresAt,
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
     * Save answers incrementally (autosave) with IP tracking
     */
    async saveAnswers(req, res, next) {
        try {
            const { quizId } = req.params;
            const { attemptId, answers, sessionId } = req.body;
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

            // Validate session ID
            if (sessionId && sessionId !== attempt.sessionId) {
                await auditService.createAuditEvent({
                    attempt,
                    eventType: 'multiple_session',
                    meta: {
                        expectedSession: attempt.sessionId,
                        providedSession: sessionId
                    },
                    req
                });

                return res.status(403).json({
                    success: false,
                    error: 'Invalid session detected'
                });
            }

            // Check if attempt has expired
            const quiz = await Quiz.findById(quizId);

            // Use expiresAt for server-side validation
            if (attempt.expiresAt && new Date() > attempt.expiresAt) {
                // Auto-submit if time expired
                attempt.status = 'submitted';
                attempt.endTime = attempt.expiresAt;
                await attempt.save();

                return res.status(400).json({
                    success: false,
                    error: 'Time limit exceeded. Attempt auto-submitted.',
                    attemptId: attempt._id
                });
            }

            // IP tracking if enabled
            const currentIp = auditService.getClientIp(req);
            if (quiz.antiCheatSettings?.trackIPAddress) {
                await auditService.detectIpChange(attemptId, currentIp, req);
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
     * Submit attempt for grading with server-side validation
     */
    async submitAttempt(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { attemptId, sessionId } = req.body;
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

            // Validate session ID
            if (sessionId && sessionId !== attempt.sessionId) {
                await auditService.createAuditEvent({
                    attempt,
                    eventType: 'multiple_session',
                    meta: {
                        expectedSession: attempt.sessionId,
                        providedSession: sessionId
                    },
                    req
                });

                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    error: 'Invalid session detected'
                });
            }

            const quiz = await Quiz.findById(quizId).session(session);
            const now = new Date();

            // Server-side time validation
            if (attempt.expiresAt && now > attempt.expiresAt) {
                // Auto-submit due to timeout
                attempt.endTime = attempt.expiresAt;
                attempt.status = 'timeout';

                // Log auto-submit event
                await auditService.createAuditEvent({
                    attempt,
                    eventType: 'quiz_auto_submitted',
                    meta: {
                        reason: 'time_limit_exceeded',
                        expiresAt: attempt.expiresAt,
                        submittedAt: now
                    },
                    req
                });
            } else {
                // Normal submission
                attempt.endTime = now;
                attempt.status = 'submitted';

                // Log submission event
                await auditService.createAuditEvent({
                    attempt,
                    eventType: 'quiz_submitted',
                    req
                });
            }

            attempt.ipAtEnd = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            attempt.userAgentEnd = req.headers['user-agent'];

            // Server-side violation counting from AuditEvent
            const tabSwitchCount = await AuditEvent.countDocuments({
                attemptId: attempt._id,
                eventType: 'tab_switch'
            });

            const fullscreenExitCount = await AuditEvent.countDocuments({
                attemptId: attempt._id,
                eventType: 'fullscreen_exit'
            });

            const copyCount = await AuditEvent.countDocuments({
                attemptId: attempt._id,
                eventType: 'copy'
            });

            const pasteCount = await AuditEvent.countDocuments({
                attemptId: attempt._id,
                eventType: 'paste'
            });

            // Update attempt with server-side counts
            attempt.tabSwitches = tabSwitchCount;
            attempt.fullScreenExits = fullscreenExitCount;
            attempt.copyPasteEvents = copyCount + pasteCount;

            // Check for suspicious activity based on server-side data
            const flaggedReasons = [];

            // Check tab switches using server-side count
            if (tabSwitchCount > (quiz.antiCheatSettings?.maxTabSwitches || 10)) {
                flaggedReasons.push(`Excessive tab switches: ${tabSwitchCount}`);
            }

            // Check IP change if tracking is enabled
            if (quiz.antiCheatSettings?.trackIPAddress &&
                !quiz.antiCheatSettings?.allowIPChange &&
                attempt.ipAtStart !== attempt.ipAtEnd) {
                flaggedReasons.push('IP address changed during attempt');
            }

            // Check time anomalies using server-side calculation
            const expectedMinTime = quiz.durationMinutes * 60 * 1000;
            const actualTime = attempt.endTime - attempt.startTime;

            if (actualTime < (expectedMinTime * 0.1)) {
                // Submitted too quickly (less than 10% of allowed time)
                flaggedReasons.push('Submitted suspiciously fast');
            }

            // Check risk score
            if (attempt.riskScore >= 15) {
                flaggedReasons.push(`High risk score: ${attempt.riskScore} (${attempt.riskLevel})`);
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
                    flaggedReasons: attempt.flaggedReasons,
                    riskScore: attempt.riskScore,
                    riskLevel: attempt.riskLevel
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
     * Log anti-cheat audit events with risk scoring and IP tracking
     */
    async logAuditEvent(req, res, next) {
        try {
            const { attemptId, eventType, meta, clientTimestamp } = req.body;
            const userId = req.user._id;

            // Verify attempt belongs to user and is active
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

            // Check if attempt has expired
            if (attempt.expiresAt && new Date() > attempt.expiresAt) {
                return res.status(400).json({
                    success: false,
                    error: 'Attempt has expired'
                });
            }

            // Validate session ID if provided
            const sessionId = req.headers['x-quiz-session'];
            if (sessionId && sessionId !== attempt.sessionId) {
                // Multiple session detected
                await auditService.createAuditEvent({
                    attempt,
                    eventType: 'multiple_session',
                    meta: {
                        expectedSession: attempt.sessionId,
                        providedSession: sessionId
                    },
                    req
                });

                return res.status(403).json({
                    success: false,
                    error: 'Invalid session detected'
                });
            }

            // IP tracking if enabled
            const quiz = await Quiz.findById(attempt.quiz);
            const currentIp = auditService.getClientIp(req);
            if (quiz?.antiCheatSettings?.trackIPAddress) {
                await auditService.detectIpChange(attemptId, currentIp, req);
            }

            // Create audit event using the new service
            const event = await auditService.createAuditEvent({
                attempt,
                eventType,
                meta,
                clientTimestamp,
                req
            });

            // Update legacy attempt counters for backward compatibility
            if (eventType === 'tab_switch') {
                attempt.tabSwitches += 1;
                await attempt.save();
            }

            res.json({
                success: true,
                message: 'Event logged',
                eventId: event._id,
                riskScore: attempt.riskScore,
                riskLevel: attempt.riskLevel
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

            // Use the new audit service to get events
            const auditData = await auditService.getAuditEvents(attemptId);

            res.json({
                success: true,
                data: {
                    attemptId,
                    summary: auditData.summary,
                    events: auditData.events,
                    totalEvents: auditData.summary.totalEvents,
                    pagination: auditData.pagination
                }
            });
        } catch (error) {
            logger.error('Get audit log error:', error);
            next(error);
        }
    }

    /**
     * POST /api/attempts/:attemptId/heartbeat
     * Heartbeat endpoint to keep attempt alive
     */
    async heartbeat(req, res, next) {
        try {
            const { attemptId } = req.params;
            const { sessionId } = req.body;
            const userId = req.user._id;

            // Verify attempt belongs to user and is active
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

            // Validate session ID
            if (sessionId !== attempt.sessionId) {
                // Multiple session detected
                await auditService.createAuditEvent({
                    attempt,
                    eventType: 'multiple_session',
                    meta: {
                        expectedSession: attempt.sessionId,
                        providedSession: sessionId
                    },
                    req
                });

                return res.status(403).json({
                    success: false,
                    error: 'Invalid session detected'
                });
            }

            // Check if attempt has expired
            if (attempt.expiresAt && new Date() > attempt.expiresAt) {
                return res.status(400).json({
                    success: false,
                    error: 'Attempt has expired'
                });
            }

            // Update last heartbeat timestamp
            attempt.lastHeartbeatAt = new Date();
            await attempt.save();

            // Log heartbeat event
            await auditService.createAuditEvent({
                attempt,
                eventType: 'heartbeat',
                req
            });

            res.json({
                success: true,
                serverTime: new Date(),
                expiresAt: attempt.expiresAt,
                riskScore: attempt.riskScore,
                riskLevel: attempt.riskLevel
            });
        } catch (error) {
            logger.error('Heartbeat error:', error);
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

    /**
     * GET /api/monitoring/overview
     * Get overall anti-cheating statistics (Trainer/Admin)
     */
    async getMonitoringOverview(req, res, next) {
        try {
            const { startDate, endDate, quizId } = req.query;

            const stats = await monitoringService.getOverallStats({
                startDate,
                endDate,
                quizId
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Get monitoring overview error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/suspicious
     * Get suspicious attempts (Trainer/Admin)
     */
    async getSuspiciousAttempts(req, res, next) {
        try {
            const { page, limit, quizId, riskLevel, minRiskScore } = req.query;

            const result = await monitoringService.getSuspiciousAttempts({
                page,
                limit,
                quizId,
                riskLevel,
                minRiskScore
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('Get suspicious attempts error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/attempt/:attemptId/details
     * Get detailed audit information for an attempt (Trainer/Admin)
     */
    async getAttemptAuditDetails(req, res, next) {
        try {
            const { attemptId } = req.params;

            const details = await monitoringService.getAttemptAuditDetails(attemptId);

            res.json({
                success: true,
                data: details
            });
        } catch (error) {
            logger.error('Get attempt audit details error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/quiz/:quizId/stats
     * Get quiz-specific anti-cheating statistics (Trainer/Admin)
     */
    async getQuizMonitoringStats(req, res, next) {
        try {
            const { quizId } = req.params;

            const stats = await monitoringService.getQuizStats(quizId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Get quiz monitoring stats error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/student/:studentId/history
     * Get student anti-cheating history (Trainer/Admin)
     */
    async getStudentAntiCheatHistory(req, res, next) {
        try {
            const { studentId } = req.params;

            const history = await monitoringService.getStudentHistory(studentId);

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            logger.error('Get student anti-cheat history error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/realtime
     * Get real-time monitoring data (Trainer/Admin)
     */
    async getRealTimeMonitoring(req, res, next) {
        try {
            const monitoringData = await monitoringService.getRealTimeMonitoring();

            res.json({
                success: true,
                data: monitoringData
            });
        } catch (error) {
            logger.error('Get real-time monitoring error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/flagged
     * Get flagged attempts requiring review (Trainer/Admin)
     */
    async getFlaggedAttempts(req, res, next) {
        try {
            const { page, limit, quizId, priority } = req.query;

            const result = await monitoringService.getFlaggedAttempts({
                page,
                limit,
                quizId,
                priority
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('Get flagged attempts error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/export
     * Export monitoring data (Trainer/Admin)
     */
    async exportMonitoringData(req, res, next) {
        try {
            const { startDate, endDate, quizId, format } = req.query;

            const exportData = await monitoringService.exportMonitoringData({
                startDate,
                endDate,
                quizId,
                format
            });

            res.json({
                success: true,
                data: exportData
            });
        } catch (error) {
            logger.error('Export monitoring data error:', error);
            next(error);
        }
    }

    /**
     * POST /api/monitoring/batch
     * Get batch monitoring data for multiple quizzes (Trainer/Admin)
     */
    async getBatchMonitoringData(req, res, next) {
        try {
            const { quizIds, includeRealTime, includeStats } = req.body;

            const batchData = await monitoringService.getBatchMonitoringData({
                quizIds,
                includeRealTime,
                includeStats
            });

            res.json({
                success: true,
                data: batchData
            });
        } catch (error) {
            logger.error('Get batch monitoring data error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/trainer/dashboard
     * Get trainer's complete dashboard summary (Trainer)
     */
    async getTrainerDashboardSummary(req, res, next) {
        try {
            const trainerId = req.user._id;

            const dashboardData = await monitoringService.getTrainerDashboardSummary(trainerId);

            res.json({
                success: true,
                data: dashboardData
            });
        } catch (error) {
            logger.error('Get trainer dashboard summary error:', error);
            next(error);
        }
    }

    /**
     * POST /api/monitoring/compare
     * Get comparative analysis between multiple quizzes (Trainer/Admin)
     */
    async getComparativeAnalysis(req, res, next) {
        try {
            const { quizIds, startDate, endDate } = req.body;

            const comparisonData = await monitoringService.getComparativeAnalysis({
                quizIds,
                startDate,
                endDate
            });

            res.json({
                success: true,
                data: comparisonData
            });
        } catch (error) {
            logger.error('Get comparative analysis error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/quizzes/available
     * Get available quizzes for monitoring with filtering (Trainer/Admin)
     */
    async getAvailableQuizzes(req, res, next) {
        try {
            const { subject, search, status, page, limit } = req.query;
            const userId = req.user._id;
            const role = req.user.role;

            const availableQuizzes = await monitoringService.getAvailableQuizzes({
                userId,
                role,
                subject,
                search,
                status,
                page,
                limit
            });

            res.json({
                success: true,
                data: availableQuizzes
            });
        } catch (error) {
            logger.error('Get available quizzes error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/quizzes/subjects
     * Get subjects for quiz filtering (Trainer/Admin)
     */
    async getSubjectsForFilter(req, res, next) {
        try {
            const subjects = await monitoringService.getSubjectsForFilter();

            res.json({
                success: true,
                data: subjects
            });
        } catch (error) {
            logger.error('Get subjects for filter error:', error);
            next(error);
        }
    }

    /**
     * POST /api/monitoring/quizzes/switch
     * Switch to monitor a specific quiz (Trainer/Admin)
     */
    async switchToQuiz(req, res, next) {
        try {
            const { quizId, includeRealTime, includeStats } = req.body;

            const quizData = await monitoringService.switchToQuiz(quizId, {
                includeRealTime,
                includeStats
            });

            res.json({
                success: true,
                data: quizData
            });
        } catch (error) {
            logger.error('Switch to quiz error:', error);
            next(error);
        }
    }

    /**
     * GET /api/monitoring/quizzes/categories
     * Get quiz categories for advanced filtering (Trainer/Admin)
     */
    async getQuizCategories(req, res, next) {
        try {
            const categories = await monitoringService.getQuizCategories();

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            logger.error('Get quiz categories error:', error);
            next(error);
        }
    }

    /**
     * POST /api/monitoring/quizzes/search
     * Search quizzes by multiple criteria (Trainer/Admin)
     */
    async searchQuizzes(req, res, next) {
        try {
            const searchCriteria = {
                ...req.body,
                userId: req.user._id,
                role: req.user.role
            };

            const searchResults = await monitoringService.searchQuizzes(searchCriteria);

            res.json({
                success: true,
                data: searchResults
            });
        } catch (error) {
            logger.error('Search quizzes error:', error);
            next(error);
        }
    }
}

module.exports = new AttemptsController();