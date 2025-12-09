// models/QuizAttempt.js - Fixed Version

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Enhanced IP validation function that supports both IPv4 and IPv6
function isValidIP(ip) {
    if (!ip) return true; // Allow empty values

    // IPv4 regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

    // IPv6 regex (supports standard and compressed formats)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    // IPv6 shorthand formats (like ::1)
    if (ip.includes(':')) {
        return ipv6Regex.test(ip) || ip === '::1' || ip === '::';
    }

    // IPv4 validation
    if (ipv4Regex.test(ip)) {
        const parts = ip.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    return false;
}

const quizAttemptSchema = new Schema({
    quiz: {
        type: Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true,
        index: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Attempt identification
    attemptNumber: {
        type: Number,
        required: true,
        min: 1
    },
    attemptToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Timing (server authoritative)
    startTime: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    endTime: {
        type: Date,
        index: true
    },
    timeSpentSeconds: {
        type: Number,
        min: 0
    },

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
        default: 'in_progress',
        index: true
    },

    // Question data served to student
    selectedQuestions: [{
        question: {
            type: Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        prompt: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true,
            enum: ['mcq_single', 'mcq_multi', 'short_answer', 'numeric', 'true_false']
        },
        marks: {
            type: Number,
            required: true,
            min: 0
        },
        choices: [{
            id: {
                type: String,
                required: true
            },
            text: {
                type: String,
                required: true
            }
        }]
    }],

    // Questions metadata
    questionsServed: [{
        question: {
            type: Schema.Types.ObjectId,
            ref: 'Question'
        },
        orderIndex: Number,
        marks: Number,
        servedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Student's answers with timestamps
    rawAnswers: [{
        questionId: {
            type: Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        answer: Schema.Types.Mixed,
        clientTimestamp: Date,
        serverTimestamp: {
            type: Date,
            default: Date.now
        },
        timeSpentOnQuestion: Number // seconds
    }],

    // Auto-grading results
    autoGradeResult: [{
        questionId: {
            type: Schema.Types.ObjectId,
            ref: 'Question'
        },
        score: {
            type: Number,
            default: 0
        },
        maxScore: Number,
        isCorrect: Boolean,
        isPartial: Boolean,
        feedback: String,
        submittedAnswer: Schema.Types.Mixed,
        correctAnswer: Schema.Types.Mixed
    }],

    // Manual grading (if needed)
    manualGradeResult: [{
        questionId: {
            type: Schema.Types.ObjectId,
            ref: 'Question'
        },
        score: Number,
        maxScore: Number,
        feedback: String,
        gradedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        gradedAt: Date
    }],

    // Final scores
    totalScore: {
        type: Number,
        default: 0,
        min: 0
    },
    maxScore: {
        type: Number,
        required: true,
        min: 0
    },
    percentage: {
        type: Number,
        min: 0,
        max: 100
    },
    grade: String,
    passed: {
        type: Boolean,
        default: false
    },
    correctCount: {
        type: Number,
        default: 0,
        min: 0
    },
    wrongCount: {
        type: Number,
        default: 0,
        min: 0
    },
    partialCount: {
        type: Number,
        default: 0,
        min: 0
    },
    unansweredCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Anti-cheat tracking with FIXED IP validation
    ipAtStart: {
        type: String,
        validate: {
            validator: isValidIP,
            message: 'Invalid IP address format'
        }
    },
    ipAtEnd: {
        type: String,
        validate: {
            validator: isValidIP,
            message: 'Invalid IP address format'
        }
    },
    resumeIPs: [{
        type: String,
        validate: {
            validator: isValidIP,
            message: 'Invalid IP address format'
        }
    }],
    userAgentStart: String,
    userAgentEnd: String,
    clientFingerprint: String,

    tabSwitches: {
        type: Number,
        default: 0,
        min: 0
    },
    copyPasteEvents: {
        type: Number,
        default: 0,
        min: 0
    },
    fullScreenExits: {
        type: Number,
        default: 0,
        min: 0
    },
    suspiciousActivityCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // Resume tracking
    resumeCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastResumeTime: Date,

    // Flags and warnings
    isFlagged: {
        type: Boolean,
        default: false,
        index: true
    },
    flaggedReasons: [{
        reason: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        details: String
    }],

    // Manual review
    reviewStatus: {
        type: String,
        enum: ['pending', 'under_review', 'cleared', 'rejected'],
        default: 'pending',
        index: true
    },
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewNotes: String,
    reviewedAt: Date,

    // Browser/device info
    browserInfo: {
        userAgent: String,
        platform: String,
        name: String,
        version: String,
        os: String,
        device: String,
        screen: {
            width: Number,
            height: Number
        }
    },

    // Location (optional)
    location: {
        latitude: Number,
        longitude: Number,
        city: String,
        country: String,
        region: String
    },

    // Auto-submit flag
    isAutoSubmit: {
        type: Boolean,
        default: false
    },

    // Additional metadata
    metadata: {
        quizVersion: String,
        systemVersion: String,
        notes: String
    }
}, {
    timestamps: true
});

// Compound indexes for performance
quizAttemptSchema.index({ quiz: 1, user: 1 });
quizAttemptSchema.index({ user: 1, status: 1 });
quizAttemptSchema.index({ quiz: 1, status: 1 });
quizAttemptSchema.index({ isFlagged: 1, reviewStatus: 1 });
quizAttemptSchema.index({ createdAt: -1 });
quizAttemptSchema.index({ attemptToken: 1 }, { unique: true });

// Pre-save middleware
quizAttemptSchema.pre('save', function (next) {
    // Calculate percentage
    if (this.totalScore !== undefined && this.maxScore > 0) {
        this.percentage = (this.totalScore / this.maxScore) * 100;
    }

    // Auto-flag if needed
    if (this.tabSwitches > 10 || this.suspiciousActivityCount > 5) {
        this.isFlagged = true;
    }

    next();
});

// Instance methods
quizAttemptSchema.methods.calculateStats = function () {
    return {
        totalQuestions: this.selectedQuestions.length,
        answered: this.correctCount + this.wrongCount + this.partialCount,
        unanswered: this.unansweredCount,
        accuracy: this.selectedQuestions.length > 0
            ? ((this.correctCount / this.selectedQuestions.length) * 100).toFixed(2)
            : 0
    };
};

quizAttemptSchema.methods.isTimedOut = function (durationMinutes) {
    if (!this.startTime || this.status !== 'in_progress') return false;

    const elapsed = Date.now() - new Date(this.startTime).getTime();
    const allowed = durationMinutes * 60 * 1000;

    return elapsed > allowed;
};

quizAttemptSchema.methods.getRemainingTime = function (durationMinutes) {
    if (!this.startTime) return 0;

    const elapsed = Date.now() - new Date(this.startTime).getTime();
    const allowed = durationMinutes * 60 * 1000;

    return Math.max(0, Math.floor((allowed - elapsed) / 1000));
};

// Static methods
quizAttemptSchema.statics.getStudentStats = async function (userId, quizId = null) {
    const match = { user: userId };
    if (quizId) match.quiz = quizId;

    const stats = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalAttempts: { $sum: 1 },
                avgScore: { $avg: '$percentage' },
                highestScore: { $max: '$percentage' },
                lowestScore: { $min: '$percentage' },
                totalFlagged: {
                    $sum: { $cond: ['$isFlagged', 1, 0] }
                }
            }
        }
    ]);

    return stats[0] || {
        totalAttempts: 0,
        avgScore: 0,
        highestScore: 0,
        lowestScore: 0,
        totalFlagged: 0
    };
};

quizAttemptSchema.statics.getQuizStats = async function (quizId) {
    const stats = await this.aggregate([
        {
            $match: {
                quiz: mongoose.Types.ObjectId(quizId),
                status: { $in: ['submitted', 'auto_graded', 'manually_graded'] }
            }
        },
        {
            $group: {
                _id: null,
                totalAttempts: { $sum: 1 },
                uniqueStudents: { $addToSet: '$user' },
                avgScore: { $avg: '$percentage' },
                avgTimeSpent: { $avg: '$timeSpentSeconds' },
                passRate: {
                    $avg: { $cond: ['$passed', 1, 0] }
                },
                flaggedCount: {
                    $sum: { $cond: ['$isFlagged', 1, 0] }
                }
            }
        }
    ]);

    return stats[0] || {
        totalAttempts: 0,
        uniqueStudents: [],
        avgScore: 0,
        avgTimeSpent: 0,
        passRate: 0,
        flaggedCount: 0
    };
};

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);