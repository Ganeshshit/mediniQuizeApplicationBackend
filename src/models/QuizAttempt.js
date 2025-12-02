// ============================================
// models/QuizAttempt.js
// ============================================

const mongoose = require('mongoose');
const { Schema } = mongoose;
const quizAttemptSchema = new Schema({
    quiz: {
        type: Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Attempt tracking
    attemptNumber: {
        type: Number,
        required: true,
        min: 1
    },

    // Timing (server authoritative)
    startTime: {
        type: Date,
        default: Date.now,
        required: true
    },
    endTime: Date,
    timeSpentSeconds: Number, // Calculated on submission

    // Status tracking
    status: {
        type: String,
        enum: [
            'in_progress',
            'submitted',
            'auto_graded',
            'needs_manual_review',
            'manually_graded',
            'flagged',
            'timeout',
            'abandoned'
        ],
        default: 'in_progress'
    },

    // Questions served to this student (snapshot)
    questionsServed: [{
        question: { type: Schema.Types.ObjectId, ref: 'Question' },
        orderIndex: Number,
        marks: Number
    }],

    // Student's answers
    rawAnswers: [{
        questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
        answer: Schema.Types.Mixed, // String, Number, or Array
        clientTimestamp: Date,
        timeSpentSeconds: Number
    }],

    // Grading results
    autoGradeResult: [{
        questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
        score: Number,
        maxScore: Number,
        isCorrect: Boolean,
        feedback: String
    }],

    manualGradeResult: [{
        questionId: { type: Schema.Types.ObjectId, ref: 'Question' },
        score: Number,
        maxScore: Number,
        feedback: String,
        gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        gradedAt: Date
    }],

    // Final scores
    totalScore: {
        type: Number,
        default: 0
    },
    maxScore: {
        type: Number,
        required: true
    },
    percentage: Number,
    grade: String, // A, B, C, etc.
    passed: Boolean,

    // Anti-cheat tracking
    ipAtStart: String,
    ipAtEnd: String,
    userAgentStart: String,
    userAgentEnd: String,

    tabSwitches: {
        type: Number,
        default: 0
    },
    copyPasteEvents: {
        type: Number,
        default: 0
    },
    fullScreenExits: {
        type: Number,
        default: 0
    },
    suspiciousActivityCount: {
        type: Number,
        default: 0
    },

    // Flags and warnings
    isFlagged: {
        type: Boolean,
        default: false
    },
    flaggedReasons: [{
        reason: String,
        timestamp: Date,
        severity: {
            type: String,
            enum: ['low', 'medium', 'high']
        }
    }],

    // Manual review
    reviewStatus: {
        type: String,
        enum: ['pending', 'under_review', 'cleared', 'rejected'],
        default: 'pending'
    },
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewNotes: String,
    reviewedAt: Date,

    // Browser/device info
    browserInfo: {
        name: String,
        version: String,
        os: String,
        device: String
    },

    // Location (optional)
    location: {
        latitude: Number,
        longitude: Number,
        city: String,
        country: String
    }
}, {
    timestamps: true
});

// Compound indexes
quizAttemptSchema.index({ quiz: 1, user: 1 });
quizAttemptSchema.index({ user: 1, status: 1 });
quizAttemptSchema.index({ quiz: 1, status: 1 });
quizAttemptSchema.index({ isFlagged: 1 });
quizAttemptSchema.index({ reviewStatus: 1 });

// Calculate percentage before saving
quizAttemptSchema.pre('save', function (next) {
    if (this.totalScore !== undefined && this.maxScore > 0) {
        this.percentage = (this.totalScore / this.maxScore) * 100;
    }
    next();
});

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);

