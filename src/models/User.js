// ============================================
// models/User.js
// ============================================
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    // Authentication fields
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    passwordHash: {
        type: String,
        required: true,
        select: false // Don't return in queries by default
    },

    // Basic Info
    name: {
        type: String,
        required: true,
        trim: true
    },

    // Role-based access
    role: {
        type: String,
        enum: ['student', 'trainer', 'admin'],
        default: 'student',
        required: true
    },

    // Student-specific fields
    usn: {
        type: String,
        sparse: true, // Allows null but ensures uniqueness when present
        trim: true,
        uppercase: true
    },
    collegeName: {
        type: String,
        trim: true
    },
    phoneNo: {
        type: String,
        trim: true,
        match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },

    // Account status
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpiry: Date,

    // Password reset
    resetPasswordToken: String,
    resetPasswordExpiry: Date,

    // Activity tracking
    lastLoginAt: Date,
    lastLoginIP: String,
    loginAttempts: {
        type: Number,
        default: 0
    },
    accountLockedUntil: Date,

    // Preferences
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            quizReminders: { type: Boolean, default: true },
            resultsPublished: { type: Boolean, default: true }
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'light'
        }
    },

    // Profile picture
    profilePicture: {
        url: String,
        publicId: String // For Cloudinary or similar
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ usn: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Virtual for full name formatting
userSchema.virtual('displayName').get(function () {
    return this.name;
});

// Pre-save middleware
userSchema.pre('save', function (next) {
    // Auto-uppercase USN
    if (this.usn) this.usn = this.usn.toUpperCase();
    next();
});

module.exports = mongoose.model('User', userSchema);