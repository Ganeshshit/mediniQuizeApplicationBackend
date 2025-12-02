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
            attemptId: validationSchemas.objectId.required()
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
    validateRequest({
        [Segments.BODY]: Joi.object({
            attemptId: validationSchemas.objectId.required(),
            eventType: Joi.string().valid('tab_switch', 'copy_paste', 'visibility_change', 'heartbeat').required(),
            meta: Joi.object()
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

module.exports = router;