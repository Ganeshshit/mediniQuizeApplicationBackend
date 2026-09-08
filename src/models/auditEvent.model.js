// models/auditEvent.model.js - Enhanced Audit Event Model for Anti-Cheating

const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditEventSchema = new Schema(
    {
        attemptId: {
            type: Schema.Types.ObjectId,
            ref: 'QuizAttempt',
            required: true,
            index: true
        },

        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },

        quizId: {
            type: Schema.Types.ObjectId,
            ref: 'Quiz',
            required: true,
            index: true
        },

        eventType: {
            type: String,
            required: true,
            enum: [
                'quiz_started',

                'tab_switch',
                'visibility_change',

                'window_blur',
                'window_focus',

                'fullscreen_enter',
                'fullscreen_exit',

                'copy',
                'paste',
                'cut',

                'context_menu',

                'keyboard_shortcut',

                'heartbeat',

                'multiple_session',

                'ip_change',

                'suspicious_timing',

                'invalid_request',

                'quiz_submitted',
                'quiz_auto_submitted'
            ]
        },

        riskWeight: {
            type: Number,
            default: 0
        },

        meta: {
            type: Schema.Types.Mixed,
            default: {}
        },

        clientTimestamp: {
            type: Date
        },

        serverTimestamp: {
            type: Date,
            default: Date.now,
            index: true
        },

        ipAddress: String,

        userAgent: String
    },
    {
        timestamps: true
    }
);

// Compound indexes for efficient querying
auditEventSchema.index({
    attemptId: 1,
    serverTimestamp: 1
});

auditEventSchema.index({
    studentId: 1,
    eventType: 1
});

auditEventSchema.index({
    quizId: 1,
    eventType: 1
});

auditEventSchema.index({
    eventType: 1,
    serverTimestamp: -1
});

// TTL index - auto-delete logs older than 6 months (optional)
auditEventSchema.index({ serverTimestamp: 1 }, { expireAfterSeconds: 15552000 }); // 180 days

module.exports = mongoose.model('AuditEvent', auditEventSchema);
