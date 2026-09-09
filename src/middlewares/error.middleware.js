// middlewares/error.middleware.js
const { isCelebrateError } = require('celebrate');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Celebrate validation error
    if (isCelebrateError(err)) {
        const errors = [];

        for (const [segment, joiError] of err.details.entries()) {
            errors.push(
                ...joiError.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    location: segment
                }))
            );
        }

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }

    // Handle specific error messages
    if (err && err.message) {
        if (err.message.includes('Quiz not found') || err.message.includes('Subject not found') || err.message.includes('Question not found') || err.message.includes('Enrollment not found')) {
            return res.status(404).json({
                success: false,
                error: err.message
            });
        }
        if (err.message.includes('Access denied') || err.message.includes('Authentication required') || err.message.includes('Forbidden')) {
            return res.status(403).json({
                success: false,
                error: err.message
            });
        }
        if (err.message.includes('Student not found') || err.message.includes('User not found')) {
            return res.status(404).json({
                success: false,
                error: err.message
            });
        }
    }

    // Handle Mongoose ValidationError
    if (err && err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    // Handle Mongoose CastError
    if (err && err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID format'
        });
    }

    // Handle duplicate key error
    if (err && err.code === 11000) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry',
            field: Object.keys(err.keyPattern)[0]
        });
    }

    // Default error response
    res.status(err && err.status ? err.status : 500).json({
        success: false,
        error: err && err.message ? err.message : 'Internal server error'
    });
};

const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
};

module.exports = { errorHandler, notFoundHandler };