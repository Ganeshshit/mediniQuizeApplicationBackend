// models/Quiz.js - Enhanced Version with Optional Fields
const mongoose = require('mongoose');
const { Schema } = mongoose;

const quizSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        trim: true
    },

    // ✅ CHANGED: Subject is now optional
    subject: {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
        required: false  // Made optional
    },

    // Question selection strategy
    questionMode: {
        type: String,
        enum: ['pool_random', 'fixed_list', 'none'],  // Added 'none'
        required: true,
        default: 'none'  // Changed default
    },

    // For fixed_list mode - now optional
    questionIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Question'
    }],

    // For pool_random mode - now optional
    questionPoolFilter: {
        subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
        difficulty: [String],
        tags: [String],
        count: { type: Number, default: 10 }
    },

    // Quiz configuration
    durationMinutes: {
        type: Number,
        required: true,
        min: 1,
        default: 60
    },

    totalMarks: {
        type: Number,
        required: false,  // Made optional - can be auto-calculated
        default: 0
    },

    passingMarks: {
        type: Number,
        required: false,  // Made optional
        default: 0
    },

    // Attempt rules
    attemptsAllowed: {
        type: Number,
        default: 1,
        min: 1
    },

    // Scheduling - now flexible
    startTime: {
        type: Date,
        required: false  // Made optional for draft quizzes
    },
    endTime: {
        type: Date,
        required: false  // Made optional for draft quizzes
    },

    // Display options
    shuffleQuestions: {
        type: Boolean,
        default: true
    },
    shuffleChoices: {
        type: Boolean,
        default: true
    },
    showResultsImmediately: {
        type: Boolean,
        default: false
    },
    showCorrectAnswers: {
        type: Boolean,
        default: false
    },

    // ✅ NEW: Quiz status tracking
    status: {
        type: String,
        enum: ['draft', 'ready', 'published', 'archived'],
        default: 'draft',
        index: true
    },

    // Access control
    isPublished: {
        type: Boolean,
        default: false,
        index: true
    },

    targetAudience: {
        semesters: [Number],
        departments: [String],
        specificStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },

    // Anti-cheat settings
    antiCheatSettings: {
        enableTabSwitchDetection: { type: Boolean, default: true },
        maxTabSwitches: { type: Number, default: 5 },
        trackIPAddress: { type: Boolean, default: true },
        allowIPChange: { type: Boolean, default: false },
        enableFullScreen: { type: Boolean, default: false },
        disableCopyPaste: { type: Boolean, default: true },
        randomizeQuestionOrder: { type: Boolean, default: true }
    },

    // Instructions - now optional
    instructions: {
        type: String,
        default: ''
    },

    // Metadata
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },

    // ✅ NEW: Collaboration features
    collaborators: [{
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['editor', 'viewer'], default: 'viewer' },
        addedAt: { type: Date, default: Date.now }
    }],

    // Statistics
    totalAttempts: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    },

    // ✅ NEW: Version control
    version: {
        type: Number,
        default: 1
    },
    previousVersions: [{
        version: Number,
        snapshot: Schema.Types.Mixed,
        modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        modifiedAt: Date
    }],

    // ✅ NEW: Tags for organization
    tags: [String],
    category: String,

    // ✅ NEW: Auto-save feature
    lastAutoSave: Date,
    isDraft: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for performance
quizSchema.index({ isPublished: 1, startTime: 1, endTime: 1 });
quizSchema.index({ subject: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ status: 1 });
quizSchema.index({ 'targetAudience.semesters': 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ category: 1 });

// Virtual for duration in seconds
quizSchema.virtual('durationSeconds').get(function () {
    return this.durationMinutes * 60;
});

// ✅ NEW: Check if quiz is ready to publish
quizSchema.methods.isReadyToPublish = function () {
    const errors = [];

    if (!this.title) errors.push('Title is required');
    if (!this.startTime) errors.push('Start time is required');
    if (!this.endTime) errors.push('End time is required');
    if (this.startTime >= this.endTime) errors.push('End time must be after start time');

    if (this.questionMode === 'fixed_list' && (!this.questionIds || this.questionIds.length === 0)) {
        errors.push('At least one question is required');
    }

    if (this.questionMode === 'pool_random' && !this.questionPoolFilter?.count) {
        errors.push('Question pool configuration is required');
    }

    if (this.totalMarks === 0 && this.questionMode !== 'none') {
        errors.push('Total marks must be set');
    }

    return {
        ready: errors.length === 0,
        errors
    };
};

// ✅ NEW: Calculate completion percentage
quizSchema.methods.getCompletionPercentage = function () {
    let completed = 0;
    const total = 8;

    if (this.title) completed++;
    if (this.subject) completed++;
    if (this.questionIds?.length > 0 || this.questionPoolFilter?.count > 0) completed++;
    if (this.durationMinutes) completed++;
    if (this.totalMarks > 0) completed++;
    if (this.startTime) completed++;
    if (this.endTime) completed++;
    if (this.instructions) completed++;

    return Math.round((completed / total) * 100);
};

module.exports = mongoose.model('Quiz', quizSchema);