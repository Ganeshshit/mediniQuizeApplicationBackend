// routes/subjects.routes.js
const express = require('express');
const subjectsController = require('../controllers/subjects.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

router.get('/', authMiddleware, subjectsController.listSubjects);

router.post('/',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.BODY]: Joi.object({
            name: Joi.string().min(2).max(100).required(),
            code: Joi.string().min(2).max(20).required(),
            description: Joi.string().max(500).allow(""),
            department: Joi.string().max(100).allow(""),
            semester: Joi.number().min(1).max(12),
            credits: Joi.number().min(1).max(10)
        })
    }),
    subjectsController.createSubject
);

router.put('/:id',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            name: Joi.string().min(2).max(100),
            description: Joi.string().max(500)
        })
    }),
    subjectsController.updateSubject
);

router.delete('/:id',
    authMiddleware,
    authorize('admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    subjectsController.deleteSubject
);

module.exports = router;
