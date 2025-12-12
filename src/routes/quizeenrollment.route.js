const express = require('express');
const quizEnrollmentController = require('../controllers/quizeenrollment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

// ============================================
// TRAINER ENROLLMENT MANAGEMENT
// ============================================

// GET /api/enrollments/available-students
router.get(
    '/available-students',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.QUERY]: Joi.object({
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(100).default(20),
            search: Joi.string().allow('').optional(),
            semester: Joi.number().min(1).max(12).optional(),
            department: Joi.string().allow('').optional(),
            registeredFrom: Joi.date().optional(),
            registeredTo: Joi.date().optional(),
            sortBy: Joi.string().valid('name', 'email', 'registrationNo', 'createdAt').default('createdAt'),
            sortOrder: Joi.string().valid('asc', 'desc').default('desc')
        })
    }),
    quizEnrollmentController.getAvailableStudents.bind(quizEnrollmentController)
);

// GET /api/enrollments/quiz/:quizId/enrolled
router.get(
    '/quiz/:quizId/enrolled',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.QUERY]: Joi.object({
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(100).default(20),
            search: Joi.string().allow('').optional()
        })
    }),
    quizEnrollmentController.getEnrolledStudents.bind(quizEnrollmentController)
);

// GET /api/enrollments/quiz/:quizId/not-enrolled
router.get(
    '/quiz/:quizId/not-enrolled',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.QUERY]: Joi.object({
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(100).default(20),
            search: Joi.string().allow('').optional(),
            semester: Joi.number().min(1).max(12).optional(),
            department: Joi.string().allow('').optional(),
            registeredFrom: Joi.date().optional(),
            registeredTo: Joi.date().optional()
        })
    }),
    quizEnrollmentController.getNotEnrolledStudents.bind(quizEnrollmentController)
);

// POST /api/enrollments/quiz/:quizId/enroll-single
router.post(
    '/quiz/:quizId/enroll-single',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            studentId: validationSchemas.objectId.required()
        })
    }),
    quizEnrollmentController.enrollSingleStudent.bind(quizEnrollmentController)
);

// POST /api/enrollments/quiz/:quizId/enroll-multiple
router.post(
    '/quiz/:quizId/enroll-multiple',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            studentIds: Joi.array()
                .items(validationSchemas.objectId)
                .min(1)
                .max(100)
                .required()
        })
    }),
    quizEnrollmentController.enrollMultipleStudents.bind(quizEnrollmentController)
);

// POST /api/enrollments/quiz/:quizId/enroll-by-criteria
router.post(
    '/quiz/:quizId/enroll-by-criteria',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            semester: Joi.number().min(1).max(12).optional(),
            department: Joi.string().optional(),
            registeredFrom: Joi.date().optional(),
            registeredTo: Joi.date().optional(),
            enrollAll: Joi.boolean().default(false)
        })
    }),
    quizEnrollmentController.enrollByCriteria.bind(quizEnrollmentController)
);

// DELETE /api/enrollments/quiz/:quizId/unenroll-single
router.delete(
    '/quiz/:quizId/unenroll-single',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            studentId: validationSchemas.objectId.required()
        })
    }),
    quizEnrollmentController.unenrollSingleStudent.bind(quizEnrollmentController)
);

// DELETE /api/enrollments/quiz/:quizId/unenroll-multiple
router.delete(
    '/quiz/:quizId/unenroll-multiple',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        }),
        [Segments.BODY]: Joi.object({
            studentIds: Joi.array()
                .items(validationSchemas.objectId)
                .min(1)
                .max(100)
                .required()
        })
    }),
    quizEnrollmentController.unenrollMultipleStudents.bind(quizEnrollmentController)
);

// GET /api/enrollments/quiz/:quizId/statistics
router.get(
    '/quiz/:quizId/statistics',
    authMiddleware,
    authorize('trainer', 'admin'),
    validateRequest({
        [Segments.PARAMS]: Joi.object({
            quizId: validationSchemas.objectId.required()
        })
    }),
    quizEnrollmentController.getEnrollmentStatistics.bind(quizEnrollmentController)
);

module.exports = router;
