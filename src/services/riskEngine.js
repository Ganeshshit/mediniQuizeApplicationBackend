// services/riskEngine.js - Risk calculation engine for anti-cheating

const RISK_WEIGHTS = {
    tab_switch: 3,

    visibility_change: 2,

    window_blur: 2,
    window_focus: 0,

    fullscreen_enter: 0,
    fullscreen_exit: 4,

    copy: 2,
    paste: 3,
    cut: 2,

    context_menu: 1,

    keyboard_shortcut: 2,

    heartbeat: 0,

    multiple_session: 5,

    ip_change: 5,

    suspicious_timing: 4,

    invalid_request: 10,

    quiz_started: 0,
    quiz_submitted: 0,
    quiz_auto_submitted: 10
};

/**
 * Get the risk weight for a specific event type
 * @param {string} eventType - The type of event
 * @returns {number} The risk weight for this event
 */
function getRiskWeight(eventType) {
    return RISK_WEIGHTS[eventType] ?? 0;
}

/**
 * Get the risk level based on the risk score
 * @param {number} score - The calculated risk score
 * @returns {string} The risk level: 'low', 'medium', 'high', or 'critical'
 */
function getRiskLevel(score) {
    if (score >= 25) return 'critical';
    if (score >= 15) return 'high';
    if (score >= 7) return 'medium';

    return 'low';
}

/**
 * Check if a risk score indicates suspicious activity
 * @param {number} score - The calculated risk score
 * @returns {boolean} True if the score indicates suspicious activity
 */
function isSuspicious(score) {
    return score >= 15;
}

/**
 * Get risk level details for a given score
 * @param {number} score - The calculated risk score
 * @returns {object} Object containing level, isSuspicious, and description
 */
function getRiskDetails(score) {
    const level = getRiskLevel(score);
    const suspicious = isSuspicious(score);

    const descriptions = {
        low: 'Normal activity detected',
        medium: 'Some suspicious activity detected',
        high: 'High level of suspicious activity',
        critical: 'Critical suspicious activity detected'
    };

    return {
        level,
        isSuspicious: suspicious,
        description: descriptions[level] || 'Unknown risk level'
    };
}

module.exports = {
    RISK_WEIGHTS,
    getRiskWeight,
    getRiskLevel,
    isSuspicious,
    getRiskDetails
};
