const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Subject = require('../../models/Subject');
const Quiz = require('../../models/Quiz');
const Question = require('../../models/Question');
const QuizEnrollment = require('../../models/QuizEnrollment');
const QuizAttempt = require('../../models/QuizAttempt');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key';

// Generate test token
const generateToken = (userId, role = 'student') => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { 
      expiresIn: '1h',
      issuer: 'quiz-app',
      audience: 'quiz-app-users'
    }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { 
      expiresIn: '7d',
      issuer: 'quiz-app',
      audience: 'quiz-app-users'
    }
  );
};

// Create test user
const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: await bcrypt.hash('Test@123', 10),
    phoneNo: '1234567890',
    usn: 'USN123',
    collegeName: 'Test College',
    role: 'student',
    semester: 1,
    department: 'Computer Science',
    isActive: true,
    ...overrides
  };

  if (overrides.email) {
    defaultUser.email = overrides.email;
  }

  const user = await User.create(defaultUser);
  return user;
};

// Create test subject
const createTestSubject = async (overrides = {}) => {
  const defaultSubject = {
    name: 'Test Subject',
    code: `TS${Date.now().toString().slice(-6)}`,
    description: 'Test subject description',
    department: 'Computer Science',
    semester: 1,
    credits: 3,
    ...overrides
  };

  const subject = await Subject.create(defaultSubject);
  return subject;
};

// Create test question
const createTestQuestion = async (subjectId, overrides = {}) => {
  const defaultQuestion = {
    subject: subjectId,
    type: 'mcq_single',
    prompt: 'What is 2 + 2?',
    choices: [
      { id: '1', text: '3' },
      { id: '2', text: '4' },
      { id: '3', text: '5' },
      { id: '4', text: '6' }
    ],
    correct: '2',
    marks: 1,
    metadata: { difficulty: 'easy' },
    ...overrides
  };

  const question = await Question.create(defaultQuestion);
  return question;
};

// Create test quiz
const createTestQuiz = async (trainerId, subjectId = null, overrides = {}) => {
  const defaultQuiz = {
    title: 'Test Quiz',
    description: 'Test quiz description',
    subject: subjectId,
    questionMode: 'fixed_list',
    questionIds: [],
    durationMinutes: 30,
    attemptsAllowed: 1,
    shuffleQuestions: true,
    shuffleChoices: true,
    totalMarks: 10,
    passingMarks: 5,
    showResultsImmediately: true,
    showCorrectAnswers: true,
    instructions: 'Read carefully',
    status: 'published',
    createdBy: trainerId,
    ...overrides
  };

  const quiz = await Quiz.create(defaultQuiz);
  return quiz;
};

// Create test enrollment
const createTestEnrollment = async (studentId, quizId, overrides = {}) => {
  const defaultEnrollment = {
    student: studentId,
    quiz: quizId,
    enrolledAt: new Date(),
    ...overrides
  };

  const enrollment = await QuizEnrollment.create(defaultEnrollment);
  return enrollment;
};

// Create test attempt
const createTestAttempt = async (studentId, quizId, overrides = {}) => {
  const defaultAttempt = {
    student: studentId,
    quiz: quizId,
    status: 'in_progress',
    answers: [],
    startTime: new Date(),
    endTime: null,
    tabSwitches: 0,
    timeSpentSeconds: 0,
    ...overrides
  };

  const attempt = await QuizAttempt.create(defaultAttempt);
  return attempt;
};

// Clean all collections
const cleanCollections = async () => {
  await User.deleteMany({});
  await Subject.deleteMany({});
  await Quiz.deleteMany({});
  await Question.deleteMany({});
  await QuizEnrollment.deleteMany({});
  await QuizAttempt.deleteMany({});
};

module.exports = {
  generateToken,
  generateRefreshToken,
  createTestUser,
  createTestSubject,
  createTestQuestion,
  createTestQuiz,
  createTestEnrollment,
  createTestAttempt,
  cleanCollections
};
