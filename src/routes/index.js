// routes/index.js
const express = require('express');
const authRoutes = require('./auth.routes');
// const usersRoutes = require('./users.routes');
const subjectsRoutes = require('./subjects.routes');
const questionsRoutes = require('./questions.routes');
const quizzesRoutes = require('./quizzes.routes');
const attemptsRoutes = require('./attempts.routes');

const router = express.Router();

router.use('/auth', authRoutes);
// router.use('/users', usersRoutes);
router.use('/subjects', subjectsRoutes);
router.use('/questions', questionsRoutes);
router.use('/quizzes', quizzesRoutes);
router.use('/attempts', attemptsRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = router;