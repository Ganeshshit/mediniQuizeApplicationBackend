const mongoose = require('mongoose');
const { Schema } = mongoose;

const quizEnrollmentSchema = new Schema({
    quiz: {
        type: Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    student: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    }
});

quizEnrollmentSchema.index({ quiz: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('QuizEnrollment', quizEnrollmentSchema);
