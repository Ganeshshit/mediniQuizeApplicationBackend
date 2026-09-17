// services/password-reset.service.js - Secure password reset service

const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const PasswordUtil = require('../utils/password');
const logger = require('../config/logger');

/**
 * Generate a cryptographically secure random token
 * @returns {string} 64-character hex string (256 bits of entropy)
 */
function generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 * @param {string} token - The raw token to hash
 * @returns {string} The hashed token
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a password reset token for a user
 * @param {string} userId - The user ID
 * @param {object} metadata - Optional metadata (IP, user agent)
 * @returns {Promise<object>} Object containing raw token and expiry
 */
async function createPasswordResetToken(userId, metadata = {}) {
    try {
        // Generate secure random token
        const rawToken = generateSecureToken();
        const tokenHash = hashToken(rawToken);
        
        // Set expiration (15 minutes from now)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        
        // Invalidate any previous unused tokens for this user
        await PasswordResetToken.invalidatePreviousTokens(userId);
        
        // Create new reset token record
        const resetToken = await PasswordResetToken.create({
            user: userId,
            tokenHash,
            expiresAt,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent
        });
        
        logger.info(`Password reset token created for user ${userId}`);
        
        return {
            rawToken, // Only returned once for email sending
            expiresAt,
            tokenId: resetToken._id
        };
    } catch (error) {
        logger.error('Error creating password reset token:', error);
        throw new Error('Failed to create reset token');
    }
}

/**
 * Validate a password reset token
 * @param {string} rawToken - The raw token from the email link
 * @returns {Promise<object>} Object containing validation result and user
 */
async function validatePasswordResetToken(rawToken) {
    try {
        // Hash the incoming token
        const tokenHash = hashToken(rawToken);
        
        // Find the token record
        const resetToken = await PasswordResetToken.findOne({
            tokenHash
        }).populate('user');
        
        if (!resetToken) {
            return {
                valid: false,
                reason: 'invalid_token'
            };
        }
        
        // Check if token is still valid
        if (!resetToken.isValid()) {
            if (resetToken.usedAt) {
                return {
                    valid: false,
                    reason: 'already_used'
                };
            }
            if (new Date() > resetToken.expiresAt) {
                return {
                    valid: false,
                    reason: 'expired'
                };
            }
        }
        
        // Check if user account is active
        if (!resetToken.user.isActive) {
            return {
                valid: false,
                reason: 'account_inactive'
            };
        }
        
        return {
            valid: true,
            user: resetToken.user,
            resetToken
        };
    } catch (error) {
        logger.error('Error validating password reset token:', error);
        return {
            valid: false,
            reason: 'validation_error'
        };
    }
}

/**
 * Reset user password using a valid token
 * @param {string} rawToken - The raw token from the email link
 * @param {string} newPassword - The new password
 * @returns {Promise<object>} Result of the password reset
 */
async function resetPassword(rawToken, newPassword) {
    try {
        // Validate the token first
        const validation = await validatePasswordResetToken(rawToken);
        
        if (!validation.valid) {
            return {
                success: false,
                reason: validation.reason
            };
        }
        
        const { user, resetToken } = validation;
        
        // Validate password strength
        const passwordCheck = PasswordUtil.validate(newPassword);
        if (!passwordCheck.valid) {
            return {
                success: false,
                reason: 'weak_password',
                details: passwordCheck.errors
            };
        }
        
        // Hash the new password
        const passwordHash = await PasswordUtil.hash(newPassword);
        
        // Update user password and increment token version
        await User.findByIdAndUpdate(user._id, {
            passwordHash,
            tokenVersion: user.tokenVersion + 1,
            resetPasswordToken: undefined,
            resetPasswordExpiry: undefined
        });
        
        // Mark the reset token as used
        await PasswordResetToken.findByIdAndUpdate(resetToken._id, {
            usedAt: new Date()
        });
        
        // Clean up any other reset tokens for this user
        await PasswordResetToken.cleanupUserTokens(user._id);
        
        logger.info(`Password reset successful for user ${user._id}`);
        
        return {
            success: true,
            message: 'Password reset successfully'
        };
    } catch (error) {
        logger.error('Error resetting password:', error);
        return {
            success: false,
            reason: 'server_error'
        };
    }
}

/**
 * Change password for authenticated user
 * @param {string} userId - The user ID
 * @param {string} currentPassword - The current password
 * @param {string} newPassword - The new password
 * @returns {Promise<object>} Result of the password change
 */
async function changePassword(userId, currentPassword, newPassword) {
    try {
        // Find user with password hash
        const user = await User.findById(userId).select('+passwordHash');
        
        if (!user) {
            return {
                success: false,
                reason: 'user_not_found'
            };
        }
        
        // Verify current password
        const isValidPassword = await PasswordUtil.compare(currentPassword, user.passwordHash);
        if (!isValidPassword) {
            return {
                success: false,
                reason: 'invalid_current_password'
            };
        }
        
        // Check if new password is same as current
        const isSamePassword = await PasswordUtil.compare(newPassword, user.passwordHash);
        if (isSamePassword) {
            return {
                success: false,
                reason: 'same_password'
            };
        }
        
        // Validate new password strength
        const passwordCheck = PasswordUtil.validate(newPassword);
        if (!passwordCheck.valid) {
            return {
                success: false,
                reason: 'weak_password',
                details: passwordCheck.errors
            };
        }
        
        // Hash the new password
        const passwordHash = await PasswordUtil.hash(newPassword);
        
        // Update password and increment token version
        await User.findByIdAndUpdate(userId, {
            passwordHash,
            tokenVersion: user.tokenVersion + 1
        });
        
        logger.info(`Password changed successfully for user ${userId}`);
        
        return {
            success: true,
            message: 'Password changed successfully'
        };
    } catch (error) {
        logger.error('Error changing password:', error);
        return {
            success: false,
            reason: 'server_error'
        };
    }
}

/**
 * Initiate password reset process
 * @param {string} email - The user's email
 * @param {object} metadata - Optional metadata (IP, user agent)
 * @returns {Promise<object>} Result of the initiation
 */
async function initiatePasswordReset(email, metadata = {}) {
    try {
        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();
        
        // Find user by email
        const user = await User.findOne({ email: normalizedEmail });
        
        // Always return success to prevent email enumeration
        // Even if user doesn't exist, we return the same message
        if (!user) {
            logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`);
            return {
                success: true,
                message: 'If an account exists for this email, a password reset link has been sent.',
                userExists: false
            };
        }
        
        // Check if account is active
        if (!user.isActive) {
            logger.info(`Password reset requested for inactive account: ${normalizedEmail}`);
            return {
                success: true,
                message: 'If an account exists for this email, a password reset link has been sent.',
                userExists: true,
                accountInactive: true
            };
        }
        
        // Create reset token
        const { rawToken, expiresAt } = await createPasswordResetToken(user._id, metadata);
        
        logger.info(`Password reset initiated for user ${user._id}`);
        
        return {
            success: true,
            message: 'If an account exists for this email, a password reset link has been sent.',
            userExists: true,
            resetToken: rawToken, // This should only be used for email sending
            expiresAt
        };
    } catch (error) {
        logger.error('Error initiating password reset:', error);
        // Still return success to prevent email enumeration
        return {
            success: true,
            message: 'If an account exists for this email, a password reset link has been sent.',
            userExists: false
        };
    }
}

module.exports = {
    generateSecureToken,
    hashToken,
    createPasswordResetToken,
    validatePasswordResetToken,
    resetPassword,
    changePassword,
    initiatePasswordReset
};