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

    // Student-specific fields (only for role: 'student')
    rollNo: {
        type: String,
        sparse: true, // Allows null but ensures uniqueness when present
        trim: true,
        uppercase: true
    },
    registrationNo: {
        type: String,
        sparse: true,
        trim: true,
        uppercase: true
    },
    semester: {
        type: Number,
        min: 1,
        max: 12 // Adjust based on your institution
    },
    department: {
        type: String,
        trim: true
    },
    batch: {
        type: String, // e.g., "2021-2025"
        trim: true
    },

    // Software/Skills knowledge
    softwareSkills: [{
        name: { type: String, required: true },
        proficiency: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced', 'expert'],
            default: 'beginner'
        }
    }],

    // Programming languages
    programmingLanguages: [{
        language: { type: String, required: true },
        experience: {
            type: String,
            enum: ['< 6 months', '6-12 months', '1-2 years', '2+ years']
        }
    }],

    // Additional profile info
    phone: {
        type: String,
        trim: true,
        match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: { type: String, default: 'India' }
    },

    // Academic info
    cgpa: {
        type: Number,
        min: 0,
        max: 10
    },
    previousEducation: [{
        degree: String,
        institution: String,
        year: Number,
        percentage: Number
    }],

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
userSchema.index({ rollNo: 1 });
userSchema.index({ registrationNo: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ semester: 1, department: 1 });

// Virtual for full name formatting
userSchema.virtual('displayName').get(function () {
    return this.name;
});

// Pre-save middleware
userSchema.pre('save', function (next) {
    // Auto-uppercase roll and registration numbers
    if (this.rollNo) this.rollNo = this.rollNo.toUpperCase();
    if (this.registrationNo) this.registrationNo = this.registrationNo.toUpperCase();
    next();
});

module.exports = mongoose.model('User', userSchema);