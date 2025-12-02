// routes/quizzes.routes.js
const express = require('express');
const quizzesController = require('../controllers/quizzes.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // simple disk storage, you can customize

const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

// GET /api/quizzes
router.get('/', quizzesController.listQuizzes);

// GET /api/quizzes/:id
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
    })
,
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


//Quize Question Management Routes

//!Get Questions of a Quiz
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
// POST /api/quizzes/:id/questions
// → Attach an existing question (from question bank) to this quiz
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
// → Remove a question from this quiz
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

//Bulk upload question

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



//! Start Quize 
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
                    ).required()
                })
            ).required()
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


module.exports = router;



