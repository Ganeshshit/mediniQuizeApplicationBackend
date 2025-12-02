const QuizAttempt = require('../models/QuizAttempt');
const logger = require('../config/logger');

class AttemptRepository {
    /**
     * Find attempts by quiz and user
     */
    async findByQuizAndUser(quizId, userId, options = {}) {
        try {
            const query = QuizAttempt.find({ quiz: quizId, user: userId });

            if (options.sort) query.sort(options.sort);
            if (options.limit) query.limit(options.limit);
            if (options.populate) query.populate(options.populate);

            return await query.exec();
        } catch (error) {
            logger.error('Error finding attempts:', error);
            throw error;
        }
    }

    /**
     * Count user attempts for a quiz
     */
    async countUserAttempts(quizId, userId, status = null) {
        try {
            const filter = { quiz: quizId, user: userId };
            if (status) filter.status = status;

            return await QuizAttempt.countDocuments(filter);
        } catch (error) {
            logger.error('Error counting attempts:', error);
            throw error;
        }
    }

    /**
     * Create new attempt with transaction
     */
    async createAttempt(attemptData, session = null) {
        try {
            const options = session ? { session } : {};
            const attempt = new QuizAttempt(attemptData);
            return await attempt.save(options);
        } catch (error) {
            logger.error('Error creating attempt:', error);
            throw error;
        }
    }

    /**
     * Update attempt (save answers, submit, grade)
     */
    async updateAttempt(attemptId, updateData, session = null) {
        try {
            const options = { new: true, runValidators: true };
            if (session) options.session = session;

            return await QuizAttempt.findByIdAndUpdate(
                attemptId,
                updateData,
                options
            );
        } catch (error) {
            logger.error('Error updating attempt:', error);
            throw error;
        }
    }

    /**
     * Find active (in_progress) attempt
     */
    async findActiveAttempt(quizId, userId) {
        try {
            return await QuizAttempt.findOne({
                quiz: quizId,
                user: userId,
                status: 'in_progress'
            })
                .populate('quiz', 'title durationSeconds')
                .exec();
        } catch (error) {
            logger.error('Error finding active attempt:', error);
            throw error;
        }
    }

    /**
     * Get attempts needing manual review
     */
    async findNeedingReview(quizId = null, limit = 50) {
        try {
            const filter = { status: 'needs_manual_review' };
            if (quizId) filter.quiz = quizId;

            return await QuizAttempt.find(filter)
                .populate('user', 'name email')
                .populate('quiz', 'title')
                .limit(limit)
                .sort({ createdAt: 1 })
                .exec();
        } catch (error) {
            logger.error('Error finding attempts needing review:', error);
            throw error;
        }
    }

    /**
     * Bulk update (for batch grading)
     */
    async bulkUpdateAttempts(updates) {
        try {
            const bulkOps = updates.map(({ attemptId, updateData }) => ({
                updateOne: {
                    filter: { _id: attemptId },
                    update: updateData
                }
            }));

            return await QuizAttempt.bulkWrite(bulkOps);
        } catch (error) {
            logger.error('Error bulk updating attempts:', error);
            throw error;
        }
    }

    /**
     * Increment tab switch counter
     */
    async incrementTabSwitches(attemptId) {
        try {
            return await QuizAttempt.findByIdAndUpdate(
                attemptId,
                { $inc: { tabSwitches: 1 } },
                { new: true }
            );
        } catch (error) {
            logger.error('Error incrementing tab switches:', error);
            throw error;
        }
    }

    /**
     * Add flagged reason
     */
    async addFlaggedReason(attemptId, reason) {
        try {
            return await QuizAttempt.findByIdAndUpdate(
                attemptId,
                {
                    $push: { flaggedReasons: reason },
                    status: 'flagged'
                },
                { new: true }
            );
        } catch (error) {
            logger.error('Error adding flagged reason:', error);
            throw error;
        }
    }

    /**
     * Get attempt statistics for a quiz
     */
    async getQuizStats(quizId) {
        try {
            return await QuizAttempt.aggregate([
                { $match: { quiz: quizId, status: { $in: ['submitted', 'auto_graded'] } } },
                {
                    $group: {
                        _id: null,
                        totalAttempts: { $sum: 1 },
                        avgScore: { $avg: '$totalScore' },
                        maxScore: { $max: '$totalScore' },
                        minScore: { $min: '$totalScore' },
                        avgTabSwitches: { $avg: '$tabSwitches' }
                    }
                }
            ]);
        } catch (error) {
            logger.error('Error getting quiz stats:', error);
            throw error;
        }
    }
}

module.exports = new AttemptRepository();