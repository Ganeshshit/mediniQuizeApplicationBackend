// routes/quizzes.routes.js - FIXED VERSION
const express = require('express');
const quizzesController = require('../controllers/quizzes.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

//! Get all the enrolled quiz which enrolled by me 
// GET /api/quizzes/enrolled
// Get enrolled quizzes (Student only)
router.get('/enrolled',
    authMiddleware,
    authorize('student'),
    quizzesController.getMyEnrolledQuizzes
);

// GET /api/quizzes
router.get('/',
    authMiddleware,
    quizzesController.listQuizzes
);
// GET /api/quizzes/:id
// Get single quiz
router.get('/:id',
    authMiddleware,
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.getQuiz
);

// POST /api/quizzes (Trainer/Admin)
router.post('/',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            title: Joi.string().min(3).max(200).required(),
            description: Joi.string().max(1000),
            subject: validationSchemas.objectId.required(),

            questionMode: Joi.string().valid('pool_random', 'fixed_list').required(),
            questionIds: Joi.array().items(validationSchemas.objectId),

            questionPoolFilter: Joi.object({
                subject: validationSchemas.objectId,
                difficulty: Joi.array().items(Joi.string()),
                tags: Joi.array().items(Joi.string()),
                count: Joi.number().min(1)
            }),

            durationSeconds: Joi.number().min(60),
            attemptsAllowed: Joi.number().min(1).default(1),

            startTime: Joi.date().required(),
            endTime: Joi.date().required(),

            shuffleQuestions: Joi.boolean().default(true),
            shuffleChoices: Joi.boolean().default(true),

            totalMarks: Joi.number().min(1),
            passingMarks: Joi.number().min(0),

            showResultsImmediately: Joi.boolean(),
            showCorrectAnswers: Joi.boolean(),

            instructions: Joi.string(),

            targetAudience: Joi.object({
                semesters: Joi.array().items(Joi.number()),
                departments: Joi.array().items(Joi.string()),
                specificStudents: Joi.array().items(validationSchemas.objectId)
            }),

            antiCheatSettings: Joi.object({
                enableTabSwitchDetection: Joi.boolean(),
                maxTabSwitches: Joi.number(),
                trackIPAddress: Joi.boolean(),
                allowIPChange: Joi.boolean(),
                enableFullScreen: Joi.boolean(),
                disableCopyPaste: Joi.boolean(),
                randomizeQuestionOrder: Joi.boolean()
            })
        })
    }),
    quizzesController.createQuiz
);

// PUT /api/quizzes/:id (Trainer/Admin)
router.put('/:id',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.updateQuiz
);

// PATCH /api/quizzes/:id/publish (Trainer/Admin)
router.patch('/:id/publish',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.publishQuiz
);

// Quiz Question Management Routes

//! Get Questions of a Quiz
router.get('/:id/questions',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.getQuizQuestions
);

// POST /api/quizzes/:id/questions - Attach existing question
router.post('/:id/questions',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            questionId: validationSchemas.objectId.required()
        })
    }),
    quizzesController.addQuestionToQuiz
);

// DELETE /api/quizzes/:id/questions/:questionId
router.delete('/:id/questions/:questionId',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required(),
            questionId: validationSchemas.objectId.required()
        })
    }),
    quizzesController.removeQuestionFromQuiz
);

// Bulk upload questions
router.post('/:id/questions/bulk-upload',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    upload.single('file'),
    quizzesController.bulkUploadQuestions
);

// POST /api/quizzes/:id/questions/manual
router.post('/:id/questions/manual',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            prompt: Joi.string().min(5).required(),
            type: Joi.string().valid('mcq_single', 'mcq_multi').default('mcq_single'),
            marks: Joi.number().min(1).default(1),
            choices: Joi.array().items(
                Joi.object({
                    id: Joi.string().required(),
                    text: Joi.string().required(),
                    isCorrect: Joi.boolean().required()
                })
            ).min(2).required()
        })
    }),
    quizzesController.addManualQuestionToQuiz
);

// STUDENT ENROLLMENT ROUTE
// Enroll in quiz (Student only)
router.post('/:id/enroll',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.enrollInQuiz
);

//! Start Quiz 
router.post('/:id/start',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.startQuiz
);

// ✅ FIXED: Submit Quiz - Added clientFingerprint validation
// Submit quiz (Student only)
router.post('/:attemptId/submit',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            answers: Joi.array().items(
                Joi.object({
                    questionId: validationSchemas.objectId.required(),
                    answer: Joi.alternatives().try(
                        Joi.string(),
                        Joi.array().items(Joi.string())
                    ).required(),
                    clientTimestamp: Joi.date().optional()
                })
            ).required(),
            tabSwitches: Joi.number().min(0).default(0),
            timeSpentSeconds: Joi.number().min(0).optional(),
            isAutoSubmit: Joi.boolean().default(false),
            clientFingerprint: Joi.string().optional()
        })
    }),
    quizzesController.submitQuiz
);

// Get all attempt history for a quiz (student)
router.get('/:id/my-attempts',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    quizzesController.getMyAttemptsForQuiz
);

// Get a single attempt detail (student)
// Get single attempt detail (Student only - own attempts)
router.get('/attempts/:attemptId',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        })
    }),
    quizzesController.getMyAttemptDetail
);

// ✅ FIXED: Auto-save - Added clientTimestamp validation
router.post('/:attemptId/auto-save',
    authMiddleware,
    authorize('student'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            attemptId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            answers: Joi.array().items(
                Joi.object({
                    questionId: validationSchemas.objectId.required(),
                    answer: Joi.alternatives().try(
                        Joi.string(),
                        Joi.array().items(Joi.string())
                    ).allow(null),
                    clientTimestamp: Joi.date().optional()
                })
            ),
            tabSwitches: Joi.number().min(0).default(0)
        })
    }),
    quizzesController.autoSaveAnswers
);


// ============================================
// ENROLLMENT & ATTEMPT TRACKING (Trainer/Admin)
// ============================================
// Get all enrollments for a quiz (Trainer/Admin - with ownership check)
router.get('/:id/enrollments',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.QUERY]: Joi.object({
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(100).default(20),
            search: Joi.string().allow('').optional()
        })
    }),
    (req, res, next) => quizzesController.getQuizEnrollments(req, res, next)
);
// Get all attempts for a quiz (Trainer/Admin - with ownership check)
router.get('/:id/attempts',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.QUERY]: Joi.object({
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(100).default(20),
            status: Joi.string().valid(
                'in_progress', 'submitted', 'auto_graded', 'needs_manual_review',
                'manually_graded', 'flagged', 'timeout', 'abandoned'
            ).optional(),
            studentId: validationSchemas.objectId.optional(),
            search: Joi.string().allow('').optional()   // FIX 2 (explained below)
        })
    }),
    (req, res, next) => quizzesController.getQuizAttempts(req, res, next)
);
// Get detailed attempt (Trainer/Admin - with ownership check)
// Get detailed attempt (Trainer/Admin - with ownership check)
router.get('/:id/attempts/:attemptId/details',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required(),
            attemptId: validationSchemas.objectId.required()
        })
    }),
    (req, res, next) => quizzesController.getAttemptDetails(req, res, next)
);
// Quiz statistics
router.get('/:id/statistics',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    (req, res, next) => quizzesController.getQuizStatistics(req, res, next)
);


module.exports = router;