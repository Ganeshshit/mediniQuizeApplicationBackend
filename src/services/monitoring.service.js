// services/monitoring.service.js - Anti-cheating monitoring and analytics service

const QuizAttempt = require('../models/QuizAttempt');
const AuditEvent = require('../models/auditEvent.model');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Subject = require('../models/Subject');

/**
 * Get overall anti-cheating statistics
 * @param {object} filters - Optional filters (date range, quiz, etc.)
 * @returns {Promise<object>} Overall statistics
 */
async function getOverallStats(filters = {}) {
    const { startDate, endDate, quizId } = filters;

    const matchQuery = {};
    if (startDate || endDate) {
        matchQuery.startTime = {};
        if (startDate) matchQuery.startTime.$gte = new Date(startDate);
        if (endDate) matchQuery.startTime.$lte = new Date(endDate);
    }
    if (quizId) {
        matchQuery.quiz = quizId;
    }

    const [
        totalAttempts,
        suspiciousAttempts,
        highRiskAttempts,
        criticalRiskAttempts,
        avgRiskScore,
        riskDistribution,
        eventDistribution
    ] = await Promise.all([
        QuizAttempt.countDocuments(matchQuery),
        QuizAttempt.countDocuments({ ...matchQuery, suspicious: true }),
        QuizAttempt.countDocuments({ ...matchQuery, riskLevel: 'high' }),
        QuizAttempt.countDocuments({ ...matchQuery, riskLevel: 'critical' }),
        QuizAttempt.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    avgRisk: { $avg: '$riskScore' }
                }
            }
        ]),
        QuizAttempt.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$riskLevel',
                    count: { $sum: 1 }
                }
            }
        ]),
        AuditEvent.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 },
                    totalRisk: { $sum: '$riskWeight' }
                }
            },
            { $sort: { count: -1 } }
        ])
    ]);

    return {
        totalAttempts,
        suspiciousAttempts,
        suspiciousRate: totalAttempts > 0 ? (suspiciousAttempts / totalAttempts * 100).toFixed(2) : 0,
        highRiskAttempts,
        criticalRiskAttempts,
        avgRiskScore: avgRiskScore[0]?.avgRisk || 0,
        riskDistribution: riskDistribution.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        eventDistribution: eventDistribution
    };
}

/**
 * Get attempts with suspicious activity
 * @param {object} options - Query options
 * @returns {Promise<object>} Suspicious attempts with pagination
 */
async function getSuspiciousAttempts(options = {}) {
    const { page = 1, limit = 20, quizId, riskLevel, minRiskScore } = options;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { suspicious: true };
    if (quizId) query.quiz = quizId;
    if (riskLevel) query.riskLevel = riskLevel;
    if (minRiskScore) query.riskScore = { $gte: parseInt(minRiskScore) };

    const [attempts, total] = await Promise.all([
        QuizAttempt.find(query)
            .populate('user', 'name email')
            .populate('quiz', 'title')
            .sort({ riskScore: -1, startTime: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        QuizAttempt.countDocuments(query)
    ]);

    return {
        attempts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    };
}

/**
 * Get detailed audit log for a specific attempt
 * @param {string} attemptId - The attempt ID
 * @returns {Promise<object>} Detailed audit information
 */
async function getAttemptAuditDetails(attemptId) {
    const attempt = await QuizAttempt.findById(attemptId)
        .populate('user', 'name email')
        .populate('quiz', 'title');

    if (!attempt) {
        throw new Error('Attempt not found');
    }

    const events = await AuditEvent.find({ attemptId })
        .sort({ serverTimestamp: 1 });

    // Calculate detailed statistics
    const eventStats = events.reduce((acc, event) => {
        if (!acc[event.eventType]) {
            acc[event.eventType] = {
                count: 0,
                totalRisk: 0,
                firstOccurrence: event.serverTimestamp,
                lastOccurrence: event.serverTimestamp,
                timestamps: []
            };
        }
        acc[event.eventType].count += 1;
        acc[event.eventType].totalRisk += event.riskWeight || 0;
        acc[event.eventType].lastOccurrence = event.serverTimestamp;
        acc[event.eventType].timestamps.push(event.serverTimestamp);
        return acc;
    }, {});

    // Calculate time patterns
    const timePatterns = analyzeTimePatterns(events);

    // Calculate IP consistency
    const ipAnalysis = analyzeIPConsistency(events);

    return {
        attempt: {
            id: attempt._id,
            student: attempt.user,
            quiz: attempt.quiz,
            startTime: attempt.startTime,
            endTime: attempt.endTime,
            duration: attempt.endTime ? 
                Math.floor((attempt.endTime - attempt.startTime) / 1000) : null,
            status: attempt.status,
            riskScore: attempt.riskScore,
            riskLevel: attempt.riskLevel,
            suspicious: attempt.suspicious,
            violationCount: attempt.violationCount,
            sessionId: attempt.sessionId,
            ipAtStart: attempt.ipAtStart,
            ipAtEnd: attempt.ipAtEnd
        },
        eventStats,
        timePatterns,
        ipAnalysis,
        totalEvents: events.length,
        eventTimeline: events
    };
}

/**
 * Analyze time patterns in events
 * @param {array} events - Array of audit events
 * @returns {object} Time pattern analysis
 */
function analyzeTimePatterns(events) {
    if (events.length === 0) return {};

    const sortedEvents = [...events].sort((a, b) => a.serverTimestamp - b.serverTimestamp);
    
    // Calculate time gaps between events
    const timeGaps = [];
    for (let i = 1; i < sortedEvents.length; i++) {
        const gap = sortedEvents[i].serverTimestamp - sortedEvents[i-1].serverTimestamp;
        timeGaps.push(gap);
    }

    // Find suspicious patterns (rapid successive events)
    const rapidEvents = timeGaps.filter(gap => gap < 1000).length; // Less than 1 second
    
    // Calculate event frequency (events per minute)
    const duration = sortedEvents[sortedEvents.length - 1].serverTimestamp - sortedEvents[0].serverTimestamp;
    const frequency = duration > 0 ? (events.length / (duration / 60000)).toFixed(2) : 0;

    return {
        totalDuration: duration,
        eventFrequency: parseFloat(frequency),
        rapidEventCount: rapidEvents,
        avgTimeBetweenEvents: timeGaps.length > 0 ? 
            (timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length).toFixed(0) : 0,
        suspiciousRapidActivity: rapidEvents > 10
    };
}

/**
 * Analyze IP consistency across events
 * @param {array} events - Array of audit events
 * @returns {object} IP analysis
 */
function analyzeIPConsistency(events) {
    const ipCounts = events.reduce((acc, event) => {
        if (event.ipAddress) {
            acc[event.ipAddress] = (acc[event.ipAddress] || 0) + 1;
        }
        return acc;
    }, {});

    const uniqueIPs = Object.keys(ipCounts);
    const ipChanges = uniqueIPs.length - 1;

    return {
        uniqueIPs,
        ipChanges,
        ipCounts,
        ipConsistent: ipChanges === 0
    };
}

/**
 * Get quiz-specific anti-cheating statistics
 * @param {string} quizId - The quiz ID
 * @returns {Promise<object>} Quiz-specific statistics
 */
async function getQuizStats(quizId) {
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        throw new Error('Quiz not found');
    }

    const attempts = await QuizAttempt.find({ quiz: quizId });
    const totalAttempts = attempts.length;

    if (totalAttempts === 0) {
        return {
            quiz: {
                id: quiz._id,
                title: quiz.title,
                antiCheatSettings: quiz.antiCheatSettings
            },
            totalAttempts: 0,
            statistics: {
                suspiciousRate: 0,
                avgRiskScore: 0,
                avgDuration: 0
            }
        };
    }

    const suspiciousAttempts = attempts.filter(a => a.suspicious).length;
    const avgRiskScore = attempts.reduce((sum, a) => sum + (a.riskScore || 0), 0) / totalAttempts;
    
    const completedAttempts = attempts.filter(a => a.endTime);
    const avgDuration = completedAttempts.length > 0 ?
        completedAttempts.reduce((sum, a) => sum + (a.endTime - a.startTime), 0) / completedAttempts.length : 0;

    // Risk level distribution
    const riskDistribution = attempts.reduce((acc, attempt) => {
        acc[attempt.riskLevel] = (acc[attempt.riskLevel] || 0) + 1;
        return acc;
    }, {});

    // Event type distribution
    const attemptIds = attempts.map(a => a._id);
    const eventDistribution = await AuditEvent.aggregate([
        { $match: { attemptId: { $in: attemptIds } } },
        {
            $group: {
                _id: '$eventType',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    return {
        quiz: {
            id: quiz._id,
            title: quiz.title,
            antiCheatSettings: quiz.antiCheatSettings
        },
        totalAttempts,
        statistics: {
            suspiciousRate: (suspiciousAttempts / totalAttempts * 100).toFixed(2),
            suspiciousAttempts,
            avgRiskScore: avgRiskScore.toFixed(2),
            avgDuration: Math.floor(avgDuration / 1000), // Convert to seconds
            riskDistribution,
            eventDistribution
        }
    };
}

/**
 * Get student-specific anti-cheating history
 * @param {string} studentId - The student ID
 * @returns {Promise<object>} Student anti-cheating history
 */
async function getStudentHistory(studentId) {
    const student = await User.findById(studentId);
    if (!student) {
        throw new Error('Student not found');
    }

    const attempts = await QuizAttempt.find({ user: studentId })
        .populate('quiz', 'title')
        .sort({ startTime: -1 });

    const totalAttempts = attempts.length;
    const suspiciousAttempts = attempts.filter(a => a.suspicious).length;
    const avgRiskScore = attempts.reduce((sum, a) => sum + (a.riskScore || 0), 0) / totalAttempts;

    // Risk trend over time
    const riskTrend = attempts.map(attempt => ({
        attemptId: attempt._id,
        quizTitle: attempt.quiz?.title,
        startTime: attempt.startTime,
        riskScore: attempt.riskScore,
        riskLevel: attempt.riskLevel,
        suspicious: attempt.suspicious
    }));

    return {
        student: {
            id: student._id,
            name: student.name,
            email: student.email
        },
        totalAttempts,
        suspiciousAttempts,
        suspiciousRate: totalAttempts > 0 ? (suspiciousAttempts / totalAttempts * 100).toFixed(2) : 0,
        avgRiskScore: avgRiskScore.toFixed(2),
        riskTrend
    };
}

/**
 * Get real-time monitoring data (active attempts)
 * @returns {Promise<object>} Real-time monitoring data
 */
async function getRealTimeMonitoring() {
    const activeAttempts = await QuizAttempt.find({
        status: 'in_progress',
        expiresAt: { $gt: new Date() }
    })
    .populate('user', 'name email')
    .populate('quiz', 'title')
    .sort({ startTime: -1 });

    const now = new Date();
    const monitoredAttempts = await Promise.all(activeAttempts.map(async (attempt) => {
        const recentEvents = await AuditEvent.find({
            attemptId: attempt._id,
            serverTimestamp: { $gte: new Date(now - 5 * 60 * 1000) } // Last 5 minutes
        }).sort({ serverTimestamp: -1 });

        const timeRemaining = attempt.expiresAt ? 
            Math.max(0, Math.floor((attempt.expiresAt - now) / 1000)) : 0;
        
        const lastHeartbeat = attempt.lastHeartbeatAt ?
            Math.floor((now - attempt.lastHeartbeatAt) / 1000) : null;

        return {
            attemptId: attempt._id,
            student: attempt.user,
            quiz: attempt.quiz,
            startTime: attempt.startTime,
            timeRemaining,
            riskScore: attempt.riskScore,
            riskLevel: attempt.riskLevel,
            lastHeartbeatSecondsAgo: lastHeartbeat,
            recentEventCount: recentEvents.length,
            recentEvents: recentEvents.slice(0, 5),
            heartbeatActive: lastHeartbeat !== null && lastHeartbeat < 60 // Active if heartbeat within 60 seconds
        };
    }));

    return {
        activeAttempts: monitoredAttempts,
        totalActive: monitoredAttempts.length,
        highRiskActive: monitoredAttempts.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length,
        timestamp: now
    };
}

/**
 * Get flagged attempts requiring review
 * @param {object} options - Query options
 * @returns {Promise<object>} Flagged attempts with pagination
 */
async function getFlaggedAttempts(options = {}) {
    const { page = 1, limit = 20, quizId, priority } = options;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { 
        status: { $in: ['flagged', 'needs_manual_review'] },
        suspicious: true
    };
    
    if (quizId) query.quiz = quizId;
    if (priority === 'critical') query.riskLevel = 'critical';
    if (priority === 'high') query.riskLevel = 'high';

    const [attempts, total] = await Promise.all([
        QuizAttempt.find(query)
            .populate('user', 'name email')
            .populate('quiz', 'title')
            .sort({ riskScore: -1, startTime: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        QuizAttempt.countDocuments(query)
    ]);

    return {
        attempts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    };
}

/**
 * Export monitoring data for analysis
 * @param {object} options - Export options
 * @returns {Promise<object>} Export data
 */
async function exportMonitoringData(options = {}) {
    const { startDate, endDate, quizId, format = 'json' } = options;

    const matchQuery = {};
    if (startDate || endDate) {
        matchQuery.startTime = {};
        if (startDate) matchQuery.startTime.$gte = new Date(startDate);
        if (endDate) matchQuery.startTime.$lte = new Date(endDate);
    }
    if (quizId) matchQuery.quiz = quizId;

    const attempts = await QuizAttempt.find(matchQuery)
        .populate('user', 'name email')
        .populate('quiz', 'title')
        .sort({ startTime: -1 });

    const exportData = attempts.map(attempt => ({
        attemptId: attempt._id,
        student: attempt.user?.name,
        studentEmail: attempt.user?.email,
        quiz: attempt.quiz?.title,
        startTime: attempt.startTime,
        endTime: attempt.endTime,
        duration: attempt.endTime ? 
            Math.floor((attempt.endTime - attempt.startTime) / 1000) : null,
        status: attempt.status,
        riskScore: attempt.riskScore,
        riskLevel: attempt.riskLevel,
        suspicious: attempt.suspicious,
        violationCount: attempt.violationCount,
        tabSwitches: attempt.tabSwitches,
        ipAtStart: attempt.ipAtStart,
        ipAtEnd: attempt.ipAtEnd,
        flaggedReasons: attempt.flaggedReasons
    }));

    return {
        format,
        data: exportData,
        metadata: {
            exportDate: new Date(),
            totalRecords: exportData.length,
            filters: { startDate, endDate, quizId }
        }
    };
}

/**
 * Get batch monitoring data for multiple quizzes
 * @param {object} options - Batch monitoring options
 * @returns {Promise<object>} Batch monitoring data
 */
async function getBatchMonitoringData(options = {}) {
    const { quizIds, includeRealTime = false, includeStats = true } = options;

    if (!quizIds || !Array.isArray(quizIds) || quizIds.length === 0) {
        throw new Error('quizIds array is required');
    }

    // Limit to prevent overwhelming the system
    const limitedQuizIds = quizIds.slice(0, 20); // Max 20 quizzes at once

    const results = {
        quizzes: {},
        summary: {
            totalQuizzes: limitedQuizIds.length,
            totalActiveAttempts: 0,
            totalSuspiciousAttempts: 0,
            avgRiskScore: 0,
            highRiskQuizzes: []
        },
        timestamp: new Date()
    };

    // Process each quiz in parallel for efficiency
    const quizPromises = limitedQuizIds.map(async (quizId) => {
        try {
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                return { quizId, error: 'Quiz not found' };
            }

            const quizData = {
                id: quiz._id,
                title: quiz.title,
                antiCheatSettings: quiz.antiCheatSettings
            };

            // Get basic quiz statistics
            if (includeStats) {
                const attempts = await QuizAttempt.find({ quiz: quizId });
                const totalAttempts = attempts.length;
                const suspiciousAttempts = attempts.filter(a => a.suspicious).length;
                const avgRiskScore = attempts.length > 0 ? 
                    attempts.reduce((sum, a) => sum + (a.riskScore || 0), 0) / attempts.length : 0;

                // Get active attempts for this quiz
                const activeAttempts = await QuizAttempt.find({
                    quiz: quizId,
                    status: 'in_progress',
                    expiresAt: { $gt: new Date() }
                }).populate('user', 'name email');

                quizData.statistics = {
                    totalAttempts,
                    suspiciousAttempts,
                    suspiciousRate: totalAttempts > 0 ? 
                        (suspiciousAttempts / totalAttempts * 100).toFixed(2) : 0,
                    avgRiskScore: avgRiskScore.toFixed(2),
                    activeAttempts: activeAttempts.length
                };

                // Add active attempts details if requested
                if (includeRealTime && activeAttempts.length > 0) {
                    const now = new Date();
                    quizData.activeAttemptsDetails = activeAttempts.map(attempt => ({
                        attemptId: attempt._id,
                        student: attempt.user,
                        startTime: attempt.startTime,
                        timeRemaining: attempt.expiresAt ? 
                            Math.max(0, Math.floor((attempt.expiresAt - now) / 1000)) : 0,
                        riskScore: attempt.riskScore,
                        riskLevel: attempt.riskLevel,
                        lastHeartbeatSecondsAgo: attempt.lastHeartbeatAt ?
                            Math.floor((now - attempt.lastHeartbeatAt) / 1000) : null
                    }));

                    results.summary.totalActiveAttempts += activeAttempts.length;
                }

                results.summary.totalSuspiciousAttempts += suspiciousAttempts;
                results.summary.avgRiskScore += avgRiskScore;

                // Track high-risk quizzes
                if (avgRiskScore >= 10 || suspiciousAttempts / totalAttempts > 0.15) {
                    results.summary.highRiskQuizzes.push({
                        quizId: quiz._id,
                        title: quiz.title,
                        avgRiskScore: avgRiskScore.toFixed(2),
                        suspiciousRate: quizData.statistics.suspiciousRate
                    });
                }
            }

            return { quizId, data: quizData };
        } catch (error) {
            return { quizId, error: error.message };
        }
    });

    const quizResults = await Promise.all(quizPromises);

    // Organize results
    quizResults.forEach(result => {
        if (result.error) {
            results.quizzes[result.quizId] = { error: result.error };
        } else {
            results.quizzes[result.quizId] = result.data;
        }
    });

    // Calculate summary averages
    if (limitedQuizIds.length > 0) {
        results.summary.avgRiskScore = (results.summary.avgRiskScore / limitedQuizIds.length).toFixed(2);
    }

    return results;
}

/**
 * Get trainer's dashboard summary (all their quizzes at once)
 * @param {string} trainerId - The trainer's user ID
 * @returns {Promise<object>} Trainer dashboard summary
 */
async function getTrainerDashboardSummary(trainerId) {
    // Get all quizzes created by this trainer
    const quizzes = await Quiz.find({ createdBy: trainerId });
    
    if (quizzes.length === 0) {
        return {
            trainerId,
            totalQuizzes: 0,
            quizzes: {},
            summary: {
                totalAttempts: 0,
                totalActive: 0,
                totalSuspicious: 0,
                avgRiskScore: 0,
                urgentAttention: []
            },
            timestamp: new Date()
        };
    }

    const quizIds = quizzes.map(q => q._id.toString());
    
    // Use batch monitoring for efficiency
    const batchData = await getBatchMonitoringData({
        quizIds,
        includeRealTime: true,
        includeStats: true
    });

    // Enhance with trainer-specific information
    const summary = batchData.summary;
    summary.urgentAttention = [];

    // Identify quizzes needing immediate attention
    Object.values(batchData.quizzes).forEach(quizData => {
        if (quizData.statistics) {
            if (quizData.statistics.suspiciousRate > 20) {
                summary.urgentAttention.push({
                    quizId: quizData.id,
                    title: quizData.title,
                    reason: 'High suspicious rate',
                    value: quizData.statistics.suspiciousRate + '%'
                });
            }
            if (quizData.statistics.activeAttempts > 0 && quizData.statistics.avgRiskScore > 15) {
                summary.urgentAttention.push({
                    quizId: quizData.id,
                    title: quizData.title,
                    reason: 'High-risk active attempts',
                    value: quizData.statistics.activeAttempts + ' attempts'
                });
            }
        }
    });

    return {
        trainerId,
        totalQuizzes: quizzes.length,
        quizzes: batchData.quizzes,
        summary,
        timestamp: new Date()
    };
}

/**
 * Get comparative analysis between multiple quizzes
 * @param {object} options - Comparison options
 * @returns {Promise<object>} Comparative analysis
 */
async function getComparativeAnalysis(options = {}) {
    const { quizIds, startDate, endDate } = options;

    if (!quizIds || !Array.isArray(quizIds) || quizIds.length < 2) {
        throw new Error('At least 2 quiz IDs required for comparison');
    }

    const limitedQuizIds = quizIds.slice(0, 10); // Max 10 quizzes for comparison

    const matchQuery = {
        quiz: { $in: limitedQuizIds }
    };

    if (startDate || endDate) {
        matchQuery.startTime = {};
        if (startDate) matchQuery.startTime.$gte = new Date(startDate);
        if (endDate) matchQuery.startTime.$lte = new Date(endDate);
    }

    const attempts = await QuizAttempt.find(matchQuery)
        .populate('quiz', 'title')
        .populate('user', 'name email');

    // Group by quiz
    const quizAnalysis = {};
    limitedQuizIds.forEach(quizId => {
        quizAnalysis[quizId] = {
            quizId,
            attempts: [],
            statistics: {
                totalAttempts: 0,
                suspiciousAttempts: 0,
                avgRiskScore: 0,
                avgDuration: 0,
                completionRate: 0
            }
        };
    });

    attempts.forEach(attempt => {
        const quizId = attempt.quiz._id.toString();
        if (quizAnalysis[quizId]) {
            quizAnalysis[quizId].attempts.push(attempt);
        }
    });

    // Calculate statistics for each quiz
    Object.values(quizAnalysis).forEach(analysis => {
        const quizAttempts = analysis.attempts;
        const totalAttempts = quizAttempts.length;

        if (totalAttempts > 0) {
            const suspiciousAttempts = quizAttempts.filter(a => a.suspicious).length;
            const avgRiskScore = quizAttempts.reduce((sum, a) => sum + (a.riskScore || 0), 0) / totalAttempts;
            
            const completedAttempts = quizAttempts.filter(a => a.endTime);
            const avgDuration = completedAttempts.length > 0 ?
                completedAttempts.reduce((sum, a) => sum + (a.endTime - a.startTime), 0) / completedAttempts.length : 0;

            analysis.statistics = {
                totalAttempts,
                suspiciousAttempts,
                suspiciousRate: (suspiciousAttempts / totalAttempts * 100).toFixed(2),
                avgRiskScore: avgRiskScore.toFixed(2),
                avgDuration: Math.floor(avgDuration / 1000), // Convert to seconds
                completionRate: (completedAttempts.length / totalAttempts * 100).toFixed(2)
            };
        }
    });

    // Find best and worst performing
    const quizStats = Object.values(quizAnalysis).map(q => q.statistics);
    const bestQuiz = Object.values(quizAnalysis)
        .filter(q => q.statistics.totalAttempts > 0)
        .sort((a, b) => parseFloat(a.statistics.suspiciousRate) - parseFloat(b.statistics.suspiciousRate))[0];
    
    const worstQuiz = Object.values(quizAnalysis)
        .filter(q => q.statistics.totalAttempts > 0)
        .sort((a, b) => parseFloat(b.statistics.suspiciousRate) - parseFloat(a.statistics.suspiciousRate))[0];

    return {
        comparison: quizAnalysis,
        summary: {
            totalQuizzes: limitedQuizIds.length,
            totalAttempts: attempts.length,
            bestQuiz: bestQuiz ? {
                quizId: bestQuiz.quizId,
                suspiciousRate: bestQuiz.statistics.suspiciousRate
            } : null,
            worstQuiz: worstQuiz ? {
                quizId: worstQuiz.quizId,
                suspiciousRate: worstQuiz.statistics.suspiciousRate
            } : null
        },
        timestamp: new Date()
    };
}

/**
 * Get available quizzes for monitoring with filtering
 * @param {object} options - Filter options
 * @returns {Promise<object>} Available quizzes with metadata
 */
async function getAvailableQuizzes(options = {}) {
    const { 
        userId, 
        role, 
        subject, 
        search, 
        status = 'published',
        page = 1, 
        limit = 50 
    } = options;

    const query = { isPublished: true };
    
    // Filter by user if trainer (only their own quizzes)
    if (role === 'trainer' && userId) {
        query.createdBy = userId;
    }
    
    // Filter by subject
    if (subject) {
        query.subject = subject;
    }
    
    // Search by title or description
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }
    
    // Filter by status
    if (status) {
        query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [quizzes, total] = await Promise.all([
        Quiz.find(query)
            .populate('subject', 'name')
            .select('title description subject durationMinutes totalMarks createdAt status antiCheatSettings')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Quiz.countDocuments(query)
    ]);

    // Add monitoring metadata for each quiz
    const quizzesWithMetadata = await Promise.all(quizzes.map(async (quiz) => {
        const attempts = await QuizAttempt.find({ quiz: quiz._id });
        const activeAttempts = await QuizAttempt.countDocuments({
            quiz: quiz._id,
            status: 'in_progress',
            expiresAt: { $gt: new Date() }
        });

        return {
            ...quiz.toObject(),
            monitoring: {
                totalAttempts: attempts.length,
                activeAttempts,
                suspiciousAttempts: attempts.filter(a => a.suspicious).length,
                avgRiskScore: attempts.length > 0 ? 
                    (attempts.reduce((sum, a) => sum + (a.riskScore || 0), 0) / attempts.length).toFixed(2) : 0,
                lastActivity: attempts.length > 0 ? 
                    new Date(Math.max(...attempts.map(a => new Date(a.startTime)))) : null
            }
        };
    }));

    return {
        quizzes: quizzesWithMetadata,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        },
        filters: { userId, role, subject, search, status }
    };
}

/**
 * Get subjects for filtering
 * @returns {Promise<object>} Available subjects
 */
async function getSubjectsForFilter() {
    const subjects = await Subject.find()
        .select('name description')
        .sort({ name: 1 });

    return {
        subjects: subjects.map(subject => ({
            id: subject._id,
            name: subject.name,
            description: subject.description
        }))
    };
}

/**
 * Switch to monitor a specific quiz
 * @param {string} quizId - The quiz ID to monitor
 * @param {object} options - Monitoring options
 * @returns {Promise<object>} Quiz monitoring data
 */
async function switchToQuiz(quizId, options = {}) {
    const { includeRealTime = true, includeStats = true } = options;

    const quiz = await Quiz.findById(quizId).populate('subject', 'name');
    if (!quiz) {
        throw new Error('Quiz not found');
    }

    // Get quiz statistics
    const quizStats = await getQuizStats(quizId);

    // Get real-time data if requested
    let realTimeData = null;
    if (includeRealTime) {
        const activeAttempts = await QuizAttempt.find({
            quiz: quizId,
            status: 'in_progress',
            expiresAt: { $gt: new Date() }
        }).populate('user', 'name email');

        const now = new Date();
        realTimeData = {
            activeAttempts: activeAttempts.map(attempt => ({
                attemptId: attempt._id,
                student: attempt.user,
                startTime: attempt.startTime,
                timeRemaining: attempt.expiresAt ? 
                    Math.max(0, Math.floor((attempt.expiresAt - now) / 1000)) : 0,
                riskScore: attempt.riskScore,
                riskLevel: attempt.riskLevel,
                lastHeartbeatSecondsAgo: attempt.lastHeartbeatAt ?
                    Math.floor((now - attempt.lastHeartbeatAt) / 1000) : null
            })),
            totalActive: activeAttempts.length,
            highRiskActive: activeAttempts.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length,
            timestamp: now
        };
    }

    return {
        quiz: {
            id: quiz._id,
            title: quiz.title,
            description: quiz.description,
            subject: quiz.subject,
            durationMinutes: quiz.durationMinutes,
            totalMarks: quiz.totalMarks,
            antiCheatSettings: quiz.antiCheatSettings,
            createdAt: quiz.createdAt
        },
        statistics: quizStats.statistics,
        realTime: realTimeData,
        timestamp: new Date()
    };
}

/**
 * Get quiz categories for advanced filtering
 * @returns {Promise<object>} Quiz categories and filters
 */
async function getQuizCategories() {
    const quizzes = await Quiz.find({ isPublished: true });
    
    // Extract unique values for filtering
    const subjects = await Subject.find().select('name');
    const durations = [...new Set(quizzes.map(q => q.durationMinutes))].sort((a, b) => a - b);
    const marksRanges = [
        { min: 0, max: 50, label: '0-50 marks' },
        { min: 51, max: 100, label: '51-100 marks' },
        { min: 101, max: 200, label: '101-200 marks' },
        { min: 201, max: Infinity, label: '200+ marks' }
    ];

    return {
        subjects: subjects.map(s => ({ id: s._id, name: s.name })),
        durations: durations.map(d => ({ value: d, label: `${d} minutes` })),
        marksRanges,
        antiCheatLevels: [
            { value: 'strict', label: 'Strict (all features)' },
            { value: 'moderate', label: 'Moderate (basic features)' },
            { value: 'lenient', label: 'Lenient (minimal features)' }
        ]
    };
}

/**
 * Search quizzes by multiple criteria
 * @param {object} searchCriteria - Search criteria
 * @returns {Promise<object>} Search results
 */
async function searchQuizzes(searchCriteria) {
    const {
        userId,
        role,
        title,
        subject,
        minDuration,
        maxDuration,
        minMarks,
        maxMarks,
        antiCheatLevel,
        createdAfter,
        createdBefore,
        page = 1,
        limit = 20
    } = searchCriteria;

    const query = { isPublished: true };
    
    // Role-based filtering
    if (role === 'trainer' && userId) {
        query.createdBy = userId;
    }
    
    // Text search
    if (title) {
        query.title = { $regex: title, $options: 'i' };
    }
    
    // Subject filter
    if (subject) {
        query.subject = subject;
    }
    
    // Duration range
    if (minDuration || maxDuration) {
        query.durationMinutes = {};
        if (minDuration) query.durationMinutes.$gte = parseInt(minDuration);
        if (maxDuration) query.durationMinutes.$lte = parseInt(maxDuration);
    }
    
    // Marks range
    if (minMarks || maxMarks) {
        query.totalMarks = {};
        if (minMarks) query.totalMarks.$gte = parseInt(minMarks);
        if (maxMarks) query.totalMarks.$lte = parseInt(maxMarks);
    }
    
    // Date range
    if (createdAfter || createdBefore) {
        query.createdAt = {};
        if (createdAfter) query.createdAt.$gte = new Date(createdAfter);
        if (createdBefore) query.createdAt.$lte = new Date(createdBefore);
    }
    
    // Anti-cheat level (based on settings)
    if (antiCheatLevel) {
        const antiCheatQuery = {};
        if (antiCheatLevel === 'strict') {
            antiCheatQuery['antiCheatSettings.enableTabSwitchDetection'] = true;
            antiCheatQuery['antiCheatSettings.trackIPAddress'] = true;
        } else if (antiCheatLevel === 'moderate') {
            antiCheatQuery['antiCheatSettings.enableTabSwitchDetection'] = true;
        }
        Object.assign(query, antiCheatQuery);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [quizzes, total] = await Promise.all([
        Quiz.find(query)
            .populate('subject', 'name')
            .select('title description subject durationMinutes totalMarks createdAt antiCheatSettings')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Quiz.countDocuments(query)
    ]);

    return {
        quizzes,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        },
        searchCriteria
    };
}

module.exports = {
    getOverallStats,
    getSuspiciousAttempts,
    getAttemptAuditDetails,
    getQuizStats,
    getStudentHistory,
    getRealTimeMonitoring,
    getFlaggedAttempts,
    exportMonitoringData,
    getBatchMonitoringData,
    getTrainerDashboardSummary,
    getComparativeAnalysis,
    getAvailableQuizzes,
    getSubjectsForFilter,
    switchToQuiz,
    getQuizCategories,
    searchQuizzes
};
