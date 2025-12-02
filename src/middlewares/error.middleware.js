// middlewares/error.middleware.js
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'Invalid ID format'
        });
    }

    if (err.code === 11000) {
        return res.status(409).json({
            error: 'Duplicate entry',
            field: Object.keys(err.keyPattern)[0]
        });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
};

const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Route not found'
    });
};

module.exports = { errorHandler, notFoundHandler };
