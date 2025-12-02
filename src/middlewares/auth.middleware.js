// middlewares/auth.middleware.js
const JWTUtil = require('../utils/jwt');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Use your custom validator (checks issuer, audience, expiry)
        const decoded = JWTUtil.verifyAccessToken(token);

        const user = await User.findById(decoded.userId).select('-passwordHash');

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid or inactive user' });
        }

        req.user = user;
        req.userId = user._id;

        next();
    } catch (error) {
        return res.status(401).json({ error: error.message || 'Invalid token' });
    }
};

module.exports = authMiddleware;

