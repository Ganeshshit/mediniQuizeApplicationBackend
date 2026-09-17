// ============================================
// models/PasswordResetToken.js
// ============================================

const mongoose = require('mongoose');
const { Schema } = mongoose;

const passwordResetTokenSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Store the HASH of the token, never the raw token
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Token expiration (default 15 minutes)
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    
    // Track when token was used (for single-use enforcement)
    usedAt: {
        type: Date,
        default: null
    },
    
    // IP address of the requester for security auditing
    ipAddress: String,
    
    // User agent for security auditing
    userAgent: String
}, {
    timestamps: true
});

// Compound indexes for performance and cleanup
passwordResetTokenSchema.index({ user: 1, usedAt: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 }, { 
    expireAfterSeconds: 0 // Auto-delete expired documents
});

// Instance method to check if token is valid
passwordResetTokenSchema.methods.isValid = function() {
    // Check if already used
    if (this.usedAt) {
        return false;
    }
    
    // Check if expired
    if (new Date() > this.expiresAt) {
        return false;
    }
    
    return true;
};

// Static method to clean up expired/used tokens for a user
passwordResetTokenSchema.statics.cleanupUserTokens = async function(userId) {
    return this.deleteMany({
        user: userId,
        $or: [
            { usedAt: { $ne: null } },
            { expiresAt: { $lt: new Date() } }
        ]
    });
};

// Static method to invalidate all previous unused tokens for a user
passwordResetTokenSchema.statics.invalidatePreviousTokens = async function(userId) {
    return this.updateMany(
        {
            user: userId,
            usedAt: null
        },
        {
            usedAt: new Date()
        }
    );
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);