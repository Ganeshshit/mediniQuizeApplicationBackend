// routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for password reset endpoints (stricter than global)
const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many password reset attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip if testing environment
        return process.env.NODE_ENV === 'test';
    }
});

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/refresh
router.post('/refresh', authController.refresh);

// POST /api/auth/logout
// router.post('/logout', authMiddleware, authController.logout);

// POST /api/auth/forgot-password (with rate limiting)
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);

// POST /api/auth/reset-password (with rate limiting)
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

// POST /api/auth/change-password (authenticated only)
router.post('/change-password', authMiddleware, authController.changePassword);

// POST /api/auth/verify-email
router.post('/verify-email', authController.verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', authController.resendVerification);

module.exports = router;



