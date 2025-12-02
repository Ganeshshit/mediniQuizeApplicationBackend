// routes/users.routes.js
const express = require('express');
const usersController = require('../controllers/users.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

// GET /api/users/me
router.get('/me', authMiddleware, usersController.getMe);

// PUT /api/users/me
router.put('/me',
    authMiddleware,
    validateRequest({
        [Segments.BODY]: Joi.object({
            name: Joi.string().min(2).max(100),
            email: validationSchemas.email
        })
    }),
    usersController.updateMe
);

// GET /api/users (Admin only)
router.get('/',
    authMiddleware,
    authorize('admin'),
    usersController.listUsers
);

// GET /api/users/:id (Admin/Trainer)
router.get('/:id',
    authMiddleware,
    authorize('admin', 'trainer'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        })
    }),
    usersController.getUser
);

// PUT /api/users/:id (Admin only)
router.put('/:id',
    authMiddleware,
    authorize('admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            id: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            name: Joi.string().min(2).max(100),
            role: Joi.string().valid('student', 'trainer', 'admin'),
            isActive: Joi.boolean()
        })
    }),
    usersController.updateUser
);

module.exports = router;