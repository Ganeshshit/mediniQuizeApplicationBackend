// routes/attempts.routes.js
const express = require('express');
const attemptsController = require('../controllers/attempts.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

// POST /api/quizzes/:quizId/start (Student)
router.post('/quizzes/:quizId/start',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.startAttempt
);

// POST /api/quizzes/:quizId/save (Student)
router.post('/quizzes/:quizId/save',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            attemptId: validationSchemas.objectId.required(),
            sessionId: Joi.string().required(),
            answers: Joi.array().items(
                Joi.object({
                    questionId: validationSchemas.objectId.required(),
                    answer: Joi.alternatives().try(
                        Joi.string(),
                        Joi.number(),
                        Joi.array().items(Joi.string())
                    ),
                    clientTimestamp: Joi.date()
                })
            ).required()
        })
    }),
    attemptsController.saveAnswers
);

// POST /api/quizzes/:quizId/submit (Student)
router.post('/quizzes/:quizId/submit',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            attemptId: validationSchemas.objectId.required(),
            sessionId: Joi.string().required()
        })
    }),
    attemptsController.submitAttempt
);

// GET /api/quizzes/:quizId/attempts/:attemptId (Student)
router.get('/quizzes/:quizId/attempts/:attemptId',
    authMiddleware,
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required(),
            attemptId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.getAttempt
);

// GET /api/quizzes/:quizId/attempts (Trainer)
router.get('/quizzes/:quizId/attempts',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.listAttempts
);

// GET /api/grading/pending (Trainer)
router.get('/grading/pending',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getPendingGrading
);

// GET /api/grading/:attemptId (Trainer)
router.get('/grading/:attemptId',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.getAttemptForGrading
);

// POST /api/grading/:attemptId (Trainer)
router.post('/grading/:attemptId',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            questionId: validationSchemas.objectId.required(),
            score: Joi.number().min(0).required(),
            feedback: Joi.string().max(500)
        })
    }),
    attemptsController.gradeAnswer
);

// PATCH /api/grading/:attemptId/finalize (Trainer)
router.patch('/grading/:attemptId/finalize',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.finalizeGrading
);

// POST /api/audit/event (Student - Anti-cheat)
router.post('/audit/event',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            attemptId: validationSchemas.objectId.required(),
            eventType: Joi.string()
                .valid(
                    'tab_switch',
                    'visibility_change',

                    'window_blur',
                    'window_focus',

                    'fullscreen_enter',
                    'fullscreen_exit',

                    'copy',
                    'paste',
                    'cut',

                    'context_menu',

                    'keyboard_shortcut',

                    'heartbeat'
                )
                .required(),
            clientTimestamp: Joi.date().optional(),
            meta: Joi.object().optional()
        })
    }),
    attemptsController.logAuditEvent
);

// GET /api/audit/:attemptId (Trainer/Admin)
router.get('/audit/:attemptId',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.getAuditLog
);

// POST /api/attempts/:attemptId/heartbeat (Student)
router.post('/attempts/:attemptId/heartbeat',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            sessionId: Joi.string().required()
        })
    }),
    attemptsController.heartbeat
);

// ============ MONITORING ENDPOINTS (Trainer/Admin) ============

// GET /api/monitoring/overview
router.get('/monitoring/overview',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getMonitoringOverview
);

// GET /api/monitoring/suspicious
router.get('/monitoring/suspicious',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getSuspiciousAttempts
);

// GET /api/monitoring/attempt/:attemptId/details
router.get('/monitoring/attempt/:attemptId/details',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.getAttemptAuditDetails
);

// GET /api/monitoring/quiz/:quizId/stats
router.get('/monitoring/quiz/:quizId/stats',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.getQuizMonitoringStats
);

// GET /api/monitoring/student/:studentId/history
router.get('/monitoring/student/:studentId/history',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            studentId: validationSchemas.objectId.required()
        })
    }),
    attemptsController.getStudentAntiCheatHistory
);

// GET /api/monitoring/realtime
router.get('/monitoring/realtime',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getRealTimeMonitoring
);

// GET /api/monitoring/flagged
router.get('/monitoring/flagged',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getFlaggedAttempts
);

// GET /api/monitoring/export
router.get('/monitoring/export',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.exportMonitoringData
);

// ============ BATCH MONITORING ENDPOINTS (Trainer/Admin) ============

// POST /api/monitoring/batch
router.post('/monitoring/batch',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            quizIds: Joi.array().items(validationSchemas.objectId).min(1).max(20).required(),
            includeRealTime: Joi.boolean().default(false),
            includeStats: Joi.boolean().default(true)
        })
    }),
    attemptsController.getBatchMonitoringData
);

// GET /api/monitoring/trainer/dashboard
router.get('/monitoring/trainer/dashboard',
    authMiddleware,
    authorize('trainer'),
    attemptsController.getTrainerDashboardSummary
);

// POST /api/monitoring/compare
router.post('/monitoring/compare',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            quizIds: Joi.array().items(validationSchemas.objectId).min(2).max(10).required(),
            startDate: Joi.date().optional(),
            endDate: Joi.date().optional()
        })
    }),
    attemptsController.getComparativeAnalysis
);

// ============ QUIZ SELECTION & SWITCHING ENDPOINTS (Trainer/Admin) ============

// GET /api/monitoring/quizzes/available
router.get('/monitoring/quizzes/available',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getAvailableQuizzes
);

// GET /api/monitoring/quizzes/subjects
router.get('/monitoring/quizzes/subjects',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getSubjectsForFilter
);

// POST /api/monitoring/quizzes/switch
router.post('/monitoring/quizzes/switch',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            quizId: validationSchemas.objectId.required(),
            includeRealTime: Joi.boolean().default(true),
            includeStats: Joi.boolean().default(true)
        })
    }),
    attemptsController.switchToQuiz
);

// GET /api/monitoring/quizzes/categories
router.get('/monitoring/quizzes/categories',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.getQuizCategories
);

// POST /api/monitoring/quizzes/search
router.post('/monitoring/quizzes/search',
    authMiddleware,
    authorize('trainer', 'admin'),
    attemptsController.searchQuizzes
);

module.exports = router;