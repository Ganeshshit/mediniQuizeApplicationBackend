// routes/questions.routes.js
const express = require('express');
const questionsController = require('../controllers/questions.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

// GET /api/questions
router.get('/',
    authMiddleware,
    questionsController.listQuestions
);

// GET /api/questions/:id
router.get('/:id',
    authMiddleware,
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    questionsController.getQuestion
);

// POST /api/questions (Trainer/Admin)
router.post('/',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            subject: validationSchemas.objectId.required(),
            type: Joi.string().valid('mcq_single', 'mcq_multi', 'short_answer', 'numeric').required(),
            prompt: Joi.string().min(5).required(),
            choices: Joi.array().items(
                Joi.object({
                    id: Joi.string().required(),
                    text: Joi.string().required()
                })
            ),
            correct: Joi.alternatives().try(
                Joi.array().items(Joi.string()),
                Joi.string(),
                Joi.number(),
                Joi.any().valid(null)
            ),
            marks: Joi.number().min(0).default(1),
            metadata: Joi.object()
        })
    }),
    questionsController.createQuestion
);

// PUT /api/questions/:id (Trainer/Admin)
router.put('/:id',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            subject: validationSchemas.objectId,
            type: Joi.string().valid('mcq_single', 'mcq_multi', 'short_answer', 'numeric'),
            prompt: Joi.string().min(5),
            choices: Joi.array().items(
                Joi.object({
                    id: Joi.string().required(),
                    text: Joi.string().required()
                })
            ),
            correct: Joi.alternatives().try(
                Joi.array().items(Joi.string()),
                Joi.string(),
                Joi.number(),
                Joi.any().valid(null)
            ),
            marks: Joi.number().min(0),
            metadata: Joi.object()
        })
    }),
    questionsController.updateQuestion
);

// DELETE /api/questions/:id (Admin)
router.delete('/:id',
    authMiddleware,
    authorize('admin', 'trainer'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    questionsController.deleteQuestion
);


module.exports = router;