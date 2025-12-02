// ============================================
// models/Question.js
// ============================================


const mongoose = require('mongoose');
const { Schema } = mongoose;
const questionSchema = new Schema({
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },

    // Question details
    type: {
        type: String,
        enum: ['mcq_single', 'mcq_multi', 'short_answer', 'numeric', 'true_false'],
        required: true
    },
    prompt: {
        type: String,
        required: true,
        trim: true
    },
    choices: [{
        id: {
            type: String,
            required: true
        },
        text: {
            type: String,
            required: true
        },
        isCorrect: {
            type: Boolean,
            default: false
        } // Hidden from students
    }],

    // Correct answer(s)
    correct: Schema.Types.Mixed, // Array of choice IDs, string, or number

    // Grading
    marks: {
        type: Number,
        default: 1,
        required: true
    },
    negativeMarks: {
        type: Number,
        default: 0
    },

    // Question metadata
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    tags: [String],
    topic: String,

    // Media attachments
    attachments: [{
        type: {
            type: String,
            enum: ['image', 'video', 'audio', 'document']
        },
        url: String,
        filename: String
    }],

    // Explanation for answers
    explanation: String,

    // Usage tracking
    timesUsed: {
        type: Number,
        default: 0
    },
    averageScore: {
        type: Number,
        default: 0
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

questionSchema.index({ subject: 1, difficulty: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ author: 1 });
questionSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Question', questionSchema);
