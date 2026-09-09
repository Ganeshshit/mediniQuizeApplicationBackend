// middlewares/validation.middleware.js
const { celebrate, Joi, Segments, errors } = require('celebrate');

const validateRequest = (schema) => {
    return celebrate(schema, { abortEarly: false });
};

// Celebrate error handler
const celebrateErrors = errors();

// Common validation schemas
const validationSchemas = {
    objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    email: Joi.string().email().lowercase(),
    password: Joi.string().min(8).max(128),
};

module.exports = { validateRequest, validationSchemas, Joi, Segments, celebrateErrors };