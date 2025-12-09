// routes/quizzes.routes.js - FIXED VALIDATION
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
            // Required fields
            title: Joi.string().min(3).max(200).required(),

            // Optional fields - FIXED: Allow empty strings or null
            description: Joi.string().max(1000).allow('', null).optional(),
            subject: Joi.alternatives().try(
                validationSchemas.objectId,
                Joi.string().allow('', null)
            ).optional(),

            questionMode: Joi.string().valid('pool_random', 'fixed_list', 'none').default('none'),
            questionIds: Joi.array().items(validationSchemas.objectId).optional(),

            // FIXED: Allow empty subject in questionPoolFilter
            questionPoolFilter: Joi.object({
                subject: Joi.alternatives().try(
                    validationSchemas.objectId,
                    Joi.string().allow('', null)
                ).optional(),
                difficulty: Joi.array().items(Joi.string()).optional(),
                tags: Joi.array().items(Joi.string()).optional(),
                count: Joi.number().min(1).optional()
            }).optional(),

            durationMinutes: Joi.number().min(1).optional(),
            durationSeconds: Joi.number().min(60).optional(),
            attemptsAllowed: Joi.number().min(1).default(1),

            startTime: Joi.date().optional(),
            endTime: Joi.date().optional(),

            shuffleQuestions: Joi.boolean().default(true),
            shuffleChoices: Joi.boolean().default(true),

            totalMarks: Joi.number().min(0).optional(),
            passingMarks: Joi.number().min(0).optional(),

            showResultsImmediately: Joi.boolean().optional(),
            showCorrectAnswers: Joi.boolean().optional(),

            instructions: Joi.string().allow('', null).optional(),

            targetAudience: Joi.object({
                semesters: Joi.array().items(Joi.number()).optional(),
                departments: Joi.array().items(Joi.string()).optional(),
                specificStudents: Joi.array().items(validationSchemas.objectId).optional()
            }).optional(),

            antiCheatSettings: Joi.object({
                enableTabSwitchDetection: Joi.boolean().optional(),
                maxTabSwitches: Joi.number().optional(),
                trackIPAddress: Joi.boolean().optional(),
                allowIPChange: Joi.boolean().optional(),
                enableFullScreen: Joi.boolean().optional(),
                disableCopyPaste: Joi.boolean().optional(),
                randomizeQuestionOrder: Joi.boolean().optional()
            }).optional(),

            // FIXED: Additional fields allow empty strings
            status: Joi.string().valid('draft', 'ready', 'published').optional(),
            isDraft: Joi.boolean().default(true),
            tags: Joi.array().items(Joi.string()).optional(),
            category: Joi.string().allow('', null).optional()
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
        }),
        [Segments.BODY]: Joi.object({
            title: Joi.string().min(3).max(200).optional(),
            description: Joi.string().max(1000).allow('', null).optional(),
            subject: Joi.alternatives().try(
                validationSchemas.objectId,
                Joi.string().allow('', null)
            ).optional(),
            questionMode: Joi.string().valid('pool_random', 'fixed_list', 'none').optional(),
            questionIds: Joi.array().items(validationSchemas.objectId).optional(),
            questionPoolFilter: Joi.object({
                subject: Joi.alternatives().try(
                    validationSchemas.objectId,
                    Joi.string().allow('', null)
                ).optional(),
                difficulty: Joi.array().items(Joi.string()).optional(),
                tags: Joi.array().items(Joi.string()).optional(),
                count: Joi.number().min(1).optional()
            }).optional(),
            durationMinutes: Joi.number().min(1).optional(),
            totalMarks: Joi.number().min(0).optional(),
            passingMarks: Joi.number().min(0).optional(),
            attemptsAllowed: Joi.number().min(1).optional(),
            startTime: Joi.date().optional(),
            endTime: Joi.date().optional(),
            shuffleQuestions: Joi.boolean().optional(),
            shuffleChoices: Joi.boolean().optional(),
            showResultsImmediately: Joi.boolean().optional(),
            showCorrectAnswers: Joi.boolean().optional(),
            instructions: Joi.string().allow('', null).optional(),
            targetAudience: Joi.object({
                semesters: Joi.array().items(Joi.number()).optional(),
                departments: Joi.array().items(Joi.string()).optional(),
                specificStudents: Joi.array().items(validationSchemas.objectId).optional()
            }).optional(),
            antiCheatSettings: Joi.object({
                enableTabSwitchDetection: Joi.boolean().optional(),
                maxTabSwitches: Joi.number().optional(),
                trackIPAddress: Joi.boolean().optional(),
                allowIPChange: Joi.boolean().optional(),
                enableFullScreen: Joi.boolean().optional(),
                disableCopyPaste: Joi.boolean().optional(),
                randomizeQuestionOrder: Joi.boolean().optional()
            }).optional(),
            status: Joi.string().valid('draft', 'ready', 'published', 'archived').optional(),
            tags: Joi.array().items(Joi.string()).optional(),
            category: Joi.string().allow('', null).optional()
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

// Auto-save
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
            search: Joi.string().allow('').optional()
        })
    }),
    (req, res, next) => quizzesController.getQuizAttempts(req, res, next)
);
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