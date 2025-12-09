
// ============================================
// models/AuditLog.js
// ============================================

const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditSchema = new Schema({
    attemptId: {
        type: Schema.Types.ObjectId,
        ref: 'QuizAttempt'
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quizId: {
        type: Schema.Types.ObjectId,
        ref: 'Quiz'
    },

    // Event details
    eventType: {
        type: String,
        required: true,
        enum: [
            'tab_switch',
            'copy_paste',
            'fullscreen_exit',
            'window_blur',
            'window_focus',
            'right_click',
            'keyboard_shortcut',
            'answer_changed',
            'question_viewed',
            'login',
            'logout',
            'attempt_started',
            'attempt_submitted',
            'ip_changed',
            'suspicious_activity',
            'page_reload',
            'network_disconnected',
            'network_reconnected'
        ]
    },

    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },

    // Event metadata
    meta: {
        type: Schema.Types.Mixed,
        default: {}
    },

    // Network info
    ipAddress: String,
    userAgent: String,

    // Timing
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },

    // Additional context
    description: String,

    // For grouping related events
    sessionId: String
}, {
    timestamps: false // We use timestamp field instead
});

// Indexes for efficient querying
auditSchema.index({ attemptId: 1, eventType: 1 });
auditSchema.index({ userId: 1, timestamp: -1 });
auditSchema.index({ quizId: 1, eventType: 1 });
auditSchema.index({ timestamp: -1 });
auditSchema.index({ severity: 1, timestamp: -1 });

// TTL index - auto-delete logs older than 6 months (optional)
auditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 }); // 180 days

module.exports = mongoose.model('AuditLog', auditSchema);

