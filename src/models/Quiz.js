// ============================================
// models/Quiz.js
// ============================================
const mongoose = require('mongoose');
const { Schema } = mongoose;
const quizSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    subject: {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },

    // Question selection strategy
    questionMode: {
        type: String,
        enum: ['pool_random', 'fixed_list'],
        required: true,
        default: 'fixed_list'
    },

    // For fixed_list mode
    questionIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Question'
    }],

    // For pool_random mode
    questionPoolFilter: {
        subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
        difficulty: [String], // ['easy', 'medium']
        tags: [String],
        count: { type: Number, default: 10 } // Number of questions to pick
    },

    // Quiz configuration
    durationMinutes: {
        type: Number,
        required: true,
        min: 1
    },
    totalMarks: {
        type: Number,
        required: true
    },
    passingMarks: {
        type: Number,
        required: true
    },

    // Attempt rules
    attemptsAllowed: {
        type: Number,
        default: 1,
        min: 1
    },

    // Scheduling
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
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

    // Access control
    isPublished: {
        type: Boolean,
        default: false
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

    // Instructions
    instructions: String,

    // Metadata
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },

    // Statistics
    totalAttempts: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

quizSchema.index({ isPublished: 1, startTime: 1, endTime: 1 });
quizSchema.index({ subject: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ 'targetAudience.semesters': 1 });

// Virtual for duration in seconds
quizSchema.virtual('durationSeconds').get(function () {
    return this.durationMinutes * 60;
});

module.exports = mongoose.model('Quiz', quizSchema);
