// services/audit.service.js - Audit service for anti-cheating event logging

const AuditEvent = require('../models/auditEvent.model');
const QuizAttempt = require('../models/QuizAttempt');

const {
    getRiskWeight,
    getRiskLevel,
    isSuspicious
} = require('./riskEngine');

/**
 * Helper function to get client IP address from request
 * @param {object} req - Express request object
 * @returns {string} The client IP address
 */
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.socket.remoteAddress ||
           req.connection.remoteAddress ||
           req.ip;
}

/**
 * Create an audit event and update attempt risk score
 * @param {object} params - The parameters for creating an audit event
 * @param {object} params.attempt - The QuizAttempt document
 * @param {string} params.eventType - The type of event
 * @param {object} params.meta - Additional metadata for the event
 * @param {Date} params.clientTimestamp - The client-side timestamp (optional)
 * @param {object} params.req - The Express request object
 * @returns {Promise<object>} The created audit event
 */
async function createAuditEvent({
    attempt,
    eventType,
    meta = {},
    clientTimestamp,
    req
}) {
    const riskWeight = getRiskWeight(eventType);

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    const event = await AuditEvent.create({
        attemptId: attempt._id,
        studentId: attempt.user,
        quizId: attempt.quiz,

        eventType,

        riskWeight,

        meta,

        clientTimestamp,

        serverTimestamp: new Date(),

        ipAddress,

        userAgent
    });

    // Update attempt risk score if event has risk weight
    if (riskWeight > 0) {
        const updatedAttempt = await QuizAttempt.findByIdAndUpdate(
            attempt._id,
            {
                $inc: {
                    riskScore: riskWeight,
                    violationCount: 1
                }
            },
            {
                new: true
            }
        );

        if (updatedAttempt) {
            const riskLevel = getRiskLevel(updatedAttempt.riskScore);
            const suspicious = isSuspicious(updatedAttempt.riskScore);

            await QuizAttempt.findByIdAndUpdate(
                attempt._id,
                {
                    $set: {
                        riskLevel,
                        suspicious
                    }
                }
            );
        }
    }

    return event;
}

/**
 * Get audit events for a specific attempt
 * @param {string} attemptId - The attempt ID
 * @param {object} options - Query options
 * @param {string} options.eventType - Filter by event type (optional)
 * @param {number} options.limit - Limit number of results (optional)
 * @param {number} options.skip - Skip number of results (optional)
 * @returns {Promise<object>} Object containing events and summary
 */
async function getAuditEvents(attemptId, options = {}) {
    const { eventType, limit = 100, skip = 0 } = options;

    const query = { attemptId };
    if (eventType) {
        query.eventType = eventType;
    }

    const events = await AuditEvent.find(query)
        .sort({ serverTimestamp: 1 })
        .skip(skip)
        .limit(limit);

    // Calculate summary statistics
    const summary = events.reduce((acc, event) => {
        if (!acc[event.eventType]) {
            acc[event.eventType] = 0;
        }
        acc[event.eventType] += 1;
        acc.totalRisk += event.riskWeight || 0;
        return acc;
    }, { totalRisk: 0, totalEvents: events.length });

    return {
        events,
        summary,
        pagination: {
            limit,
            skip,
            total: await AuditEvent.countDocuments(query)
        }
    };
}

/**
 * Get risk summary for an attempt based on audit events
 * @param {string} attemptId - The attempt ID
 * @returns {Promise<object>} Risk summary object
 */
async function getRiskSummary(attemptId) {
    const events = await AuditEvent.find({ attemptId });

    const summary = events.reduce((acc, event) => {
        if (!acc[event.eventType]) {
            acc[event.eventType] = {
                count: 0,
                totalRisk: 0
            };
        }
        acc[event.eventType].count += 1;
        acc[event.eventType].totalRisk += event.riskWeight || 0;
        acc.totalRisk += event.riskWeight || 0;
        return acc;
    }, { totalRisk: 0, totalEvents: events.length });

    // Get attempt for current risk score
    const attempt = await QuizAttempt.findById(attemptId);

    if (attempt) {
        summary.riskScore = attempt.riskScore || 0;
        summary.riskLevel = attempt.riskLevel || 'low';
        summary.suspicious = attempt.suspicious || false;
    }

    return summary;
}

/**
 * Detect multiple sessions for an attempt
 * @param {string} attemptId - The attempt ID
 * @param {string} sessionId - The current session ID
 * @returns {Promise<boolean>} True if multiple sessions detected
 */
async function detectMultipleSessions(attemptId, sessionId) {
    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt || !attempt.sessionId) {
        return false;
    }

    // Check if the session ID matches
    if (attempt.sessionId !== sessionId) {
        // Log multiple session event
        await AuditEvent.create({
            attemptId,
            studentId: attempt.user,
            quizId: attempt.quiz,
            eventType: 'multiple_session',
            riskWeight: 5,
            meta: {
                existingSession: attempt.sessionId,
                newSession: sessionId
            },
            serverTimestamp: new Date()
        });

        return true;
    }

    return false;
}

/**
 * Detect IP change for an attempt
 * @param {string} attemptId - The attempt ID
 * @param {string} currentIp - The current IP address
 * @param {object} req - The Express request object
 * @returns {Promise<boolean>} True if IP change detected
 */
async function detectIpChange(attemptId, currentIp, req) {
    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt || !attempt.ipAtStart) {
        return false;
    }

    // Check if IP has changed
    if (attempt.ipAtStart !== currentIp) {
        // Log IP change event
        await createAuditEvent({
            attempt,
            eventType: 'ip_change',
            meta: {
                previousIp: attempt.ipAtStart,
                currentIp
            },
            req
        });

        return true;
    }

    return false;
}

module.exports = {
    createAuditEvent,
    getAuditEvents,
    getRiskSummary,
    detectMultipleSessions,
    detectIpChange,
    getClientIp
};
