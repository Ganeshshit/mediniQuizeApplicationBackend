// routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateRequest, validationSchemas, Joi, Segments } = require('../middlewares/validation.middleware');

const router = express.Router();

// POST /api/auth/register
// router.post(
//     "/register",
//     validateRequest({
//         [Segments.BODY]: Joi.object({
//             name: Joi.string().min(2).max(100).required(),
//             email: validationSchemas.email.required(),
//             password: validationSchemas.password.required(),

//             rollNo: Joi.string().required(),
//             registrationNo: Joi.string().required(),
//             semester: Joi.number().required(),
//             department: Joi.string().required(),
//             batch: Joi.string().required(),

//             softwareSkills: Joi.array().items(
//                 Joi.object({
//                     name: Joi.string().required(),
//                     proficiency: Joi.string().valid("beginner", "intermediate", "advanced", "expert")
//                 })
//             ).min(1).required(),

//             programmingLanguages: Joi.array().items(
//                 Joi.object({
//                     language: Joi.string().required(),
//                     experience: Joi.string().valid(
//                         "< 6 months",
//                         "6-12 months",
//                         "1-2 years",
//                         "2+ years"
//                     )
//                 })
//             ),

//             phone: Joi.string(),
//             gender: Joi.string().valid("male", "female", "other", "prefer_not_to_say"),
//             dateOfBirth: Joi.date(),

//             address: Joi.object({
//                 street: Joi.string(),
//                 city: Joi.string(),
//                 state: Joi.string(),
//                 zipCode: Joi.string(),
//                 country: Joi.string()
//             }),

//             cgpa: Joi.number(),

//             previousEducation: Joi.array().items(
//                 Joi.object({
//                     degree: Joi.string(),
//                     institution: Joi.string(),
//                     year: Joi.number(),
//                     percentage: Joi.number()
//                 })
//             )
//         }).unknown(true)
//     }),
//     authController.register
// );

// POST /api/auth/register
router.post(
    "/register",
    validateRequest({
        [Segments.BODY]: Joi.object({
            name: Joi.string().min(2).max(100).required(),
            email: validationSchemas.email.required(),
            password: validationSchemas.password.required(),
            department: Joi.string().required(),

            // Everything below is optional
            rollNo: Joi.string().optional(),
            registrationNo: Joi.string().optional(),
            semester: Joi.number().optional(),
            batch: Joi.string().optional(),
            softwareSkills: Joi.array().items(
                Joi.object({
                    name: Joi.string().required(),
                    proficiency: Joi.string().valid("beginner", "intermediate", "advanced", "expert")
                })
            ).optional(),
            programmingLanguages: Joi.array().items(
                Joi.object({
                    language: Joi.string().required(),
                    experience: Joi.string().valid(
                        "< 6 months",
                        "6-12 months",
                        "1-2 years",
                        "2+ years"
                    )
                })
            ).optional(),
            phone: Joi.string().optional(),
            gender: Joi.string().valid("male", "female", "other", "prefer_not_to_say").optional(),
            dateOfBirth: Joi.date().optional(),
            address: Joi.object({
                street: Joi.string().optional(),
                city: Joi.string().optional(),
                state: Joi.string().optional(),
                zipCode: Joi.string().optional(),
                country: Joi.string().optional()
            }).optional(),
            cgpa: Joi.number().optional(),
            previousEducation: Joi.array().items(
                Joi.object({
                    degree: Joi.string().optional(),
                    institution: Joi.string().optional(),
                    year: Joi.number().optional(),
                    percentage: Joi.number().optional()
                })
            ).optional()
        }).unknown(true)
    }),
    authController.register
);


// POST /api/auth/login
router.post('/login',
    validateRequest({
        [Segments.BODY]: Joi.object({
            email: validationSchemas.email.required(),
            password: Joi.string().required()
        })
    }),
    authController.login
);

// POST /api/auth/refresh
router.post('/refresh',
    validateRequest({
        [Segments.BODY]: Joi.object({
            refreshToken: Joi.string().required()
        })
    }),
    authController.refresh
);

// POST /api/auth/logout
// router.post('/logout', authMiddleware, authController.logout);

// POST /api/auth/forgot-password
router.post('/forgot-password',
    validateRequest({
        [Segments.BODY]: Joi.object({
            email: validationSchemas.email.required()
        })
    }),
    authController.forgotPassword
);

// POST /api/auth/reset-password
router.post('/reset-password',
    validateRequest({
        [Segments.BODY]: Joi.object({
            token: Joi.string().required(),
            newPassword: validationSchemas.password.required()
        })
    }),
    authController.resetPassword
);

module.exports = router;