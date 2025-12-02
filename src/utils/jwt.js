const jwt = require('jsonwebtoken');
const config = require('../config');

class JWTUtil {
    /**
     * Generate access token
     */
    generateAccessToken(payload) {
        return jwt.sign(payload, config.jwt.accessSecret, {
            expiresIn: config.jwt.accessExpiresIn,
            issuer: 'quiz-app',
            audience: 'quiz-app-users'
        });
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(payload) {
        return jwt.sign(payload, config.jwt.refreshSecret, {
            expiresIn: config.jwt.refreshExpiresIn,
            issuer: 'quiz-app',
            audience: 'quiz-app-users'
        });
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, config.jwt.accessSecret, {
                issuer: 'quiz-app',
                audience: 'quiz-app-users'
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Access token expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid access token');
            }
            throw error;
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, config.jwt.refreshSecret, {
                issuer: 'quiz-app',
                audience: 'quiz-app-users'
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Refresh token expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid refresh token');
            }
            throw error;
        }
    }

    /**
     * Decode token without verification (for debugging)
     */
    decode(token) {
        return jwt.decode(token, { complete: true });
    }

    /**
     * Generate token pair
     */
    generateTokenPair(userId, role) {
        const payload = { userId, role };

        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload)
        };
    }
}

module.exports = new JWTUtil();