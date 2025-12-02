class TimeUtil {
    /**
     * Get current server timestamp (authoritative)
     */
    now() {
        return new Date();
    }

    /**
     * Check if current time is within window
     */
    isWithinWindow(startTime, endTime) {
        const now = this.now();
        const start = new Date(startTime);
        const end = new Date(endTime);

        return now >= start && now <= end;
    }

    /**
     * Calculate time remaining (in seconds)
     */
    getTimeRemaining(startTime, durationSeconds) {
        const now = this.now();
        const start = new Date(startTime);
        const elapsed = Math.floor((now - start) / 1000);
        const remaining = durationSeconds - elapsed;

        return Math.max(0, remaining);
    }

    /**
     * Check if attempt has expired
     */
    isExpired(startTime, durationSeconds) {
        return this.getTimeRemaining(startTime, durationSeconds) <= 0;
    }

    /**
     * Validate client timestamp (anti-cheat)
     * Returns true if client time is suspiciously different from server
     */
    isClientTimeSuspicious(clientTimestamp, toleranceSeconds = 5) {
        const serverTime = this.now().getTime();
        const clientTime = new Date(clientTimestamp).getTime();
        const diff = Math.abs(serverTime - clientTime) / 1000;

        return diff > toleranceSeconds;
    }

    /**
     * Format duration in human-readable form
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(' ');
    }

    /**
     * Add duration to a date
     */
    addSeconds(date, seconds) {
        const result = new Date(date);
        result.setSeconds(result.getSeconds() + seconds);
        return result;
    }

    /**
     * Get end time from start + duration
     */
    calculateEndTime(startTime, durationSeconds) {
        return this.addSeconds(startTime, durationSeconds);
    }
}

module.exports = new TimeUtil();