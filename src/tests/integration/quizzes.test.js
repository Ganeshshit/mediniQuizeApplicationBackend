const request = require('supertest');
const app = require('../../app');
const Quiz = require('../../models/Quiz');
const Question = require('../../models/Question');
const User = require('../../models/User');
const { createTestUser, generateToken, createTestSubject, createTestQuestion, createTestQuiz, cleanCollections } = require('../helpers/test-helpers');

describe('Quizzes Endpoints', () => {
  let authToken;
  let trainerToken;
  let adminToken;
  let testSubject;
  let testQuestion;

  beforeEach(async () => {
    await cleanCollections();
    
    const student = await createTestUser({ role: 'student', email: 'student@example.com' });
    const trainer = await createTestUser({ role: 'trainer', email: 'trainer@example.com' });
    const admin = await createTestUser({ role: 'admin', email: 'admin@example.com' });

    authToken = generateToken(student._id, 'student');
    trainerToken = generateToken(trainer._id, 'trainer');
    adminToken = generateToken(admin._id, 'admin');

    testSubject = await createTestSubject();
    testQuestion = await createTestQuestion(testSubject._id);
  });

  describe('GET /api/v1/quizzes', () => {
    it('should list all quizzes for authenticated user', async () => {
      await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { title: 'Quiz 1' });
      await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { title: 'Quiz 2' });

      const response = await request(app)
        .get('/api/v1/quizzes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('quizzes');
      expect(response.body.data.quizzes.length).toBeGreaterThanOrEqual(2);
    });

    it('should not list quizzes without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/quizzes')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not list quizzes with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/quizzes')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array when no quizzes exist', async () => {
      const response = await request(app)
        .get('/api/v1/quizzes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.quizzes).toEqual([]);
    });

    it('should filter quizzes by status', async () => {
      await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'published' });
      await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'draft' });

      const response = await request(app)
        .get('/api/v1/quizzes?status=published')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/quizzes/:id', () => {
    it('should get single quiz by ID', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .get(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('quiz');
      expect(response.body.data.quiz._id).toBe(quiz._id.toString());
    });

    it('should not get quiz without authentication', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .get(`/api/v1/quizzes/${quiz._id}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get quiz with invalid ID format', async () => {
      const response = await request(app)
        .get('/api/v1/quizzes/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get non-existent quiz', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/quizzes/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/quizzes/enrolled', () => {
    it('should get enrolled quizzes for student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);
      
      // Enroll student in quiz
      const QuizEnrollment = require('../../models/QuizEnrollment');
      const student = await User.findOne({ email: 'student@example.com' });
      await QuizEnrollment.create({
        student: student._id,
        quiz: quiz._id,
        enrolledAt: new Date()
      });

      const response = await request(app)
        .get('/api/v1/quizzes/enrolled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('quizzes');
    });

    it('should not get enrolled quizzes as trainer', async () => {
      const response = await request(app)
        .get('/api/v1/quizzes/enrolled')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get enrolled quizzes without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/quizzes/enrolled')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/quizzes', () => {
    it('should create quiz as trainer', async () => {
      const quizData = {
        title: 'Test Quiz',
        description: 'Test quiz description',
        subject: testSubject._id,
        questionMode: 'fixed_list',
        questionIds: [testQuestion._id],
        durationMinutes: 30,
        attemptsAllowed: 1,
        shuffleQuestions: true,
        shuffleChoices: true,
        totalMarks: 10,
        passingMarks: 5,
        showResultsImmediately: true,
        showCorrectAnswers: true,
        instructions: 'Read carefully',
        status: 'draft'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('quiz');
      expect(response.body.data.quiz.title).toBe(quizData.title);
    });

    it('should create quiz as admin', async () => {
      const quizData = {
        title: 'Admin Quiz',
        subject: testSubject._id
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not create quiz as student', async () => {
      const quizData = {
        title: 'Student Quiz'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(quizData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz without authentication', async () => {
      const quizData = {
        title: 'Test Quiz'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .send(quizData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz with missing title', async () => {
      const quizData = {
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz with title shorter than 3 characters', async () => {
      const quizData = {
        title: 'Qz'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz with title longer than 200 characters', async () => {
      const quizData = {
        title: 'A'.repeat(201)
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz with invalid question mode', async () => {
      const quizData = {
        title: 'Test Quiz',
        questionMode: 'invalid_mode'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz with invalid duration', async () => {
      const quizData = {
        title: 'Test Quiz',
        durationMinutes: 0
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create quiz with invalid attempts allowed', async () => {
      const quizData = {
        title: 'Test Quiz',
        attemptsAllowed: 0
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should create quiz with default values', async () => {
      const quizData = {
        title: 'Test Quiz'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.quiz.attemptsAllowed).toBe(1);
    });

    it('should create quiz with empty description', async () => {
      const quizData = {
        title: 'Test Quiz',
        description: ''
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should create quiz with null description', async () => {
      const quizData = {
        title: 'Test Quiz',
        description: null
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should create quiz with anti-cheat settings', async () => {
      const quizData = {
        title: 'Test Quiz',
        antiCheatSettings: {
          enableTabSwitchDetection: true,
          maxTabSwitches: 3,
          trackIPAddress: true,
          enableFullScreen: true,
          disableCopyPaste: true
        }
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should create quiz with target audience', async () => {
      const quizData = {
        title: 'Test Quiz',
        targetAudience: {
          semesters: [1, 2, 3],
          departments: ['CS', 'IT'],
          specificStudents: []
        }
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not create quiz with invalid status', async () => {
      const quizData = {
        title: 'Test Quiz',
        status: 'invalid_status'
      };

      const response = await request(app)
        .post('/api/v1/quizzes')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(quizData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/v1/quizzes/:id', () => {
    it('should update quiz as trainer', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const updateData = {
        title: 'Updated Quiz Title',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.quiz.title).toBe(updateData.title);
    });

    it('should update quiz as admin', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const updateData = {
        title: 'Updated Quiz Title'
      };

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not update quiz as student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated' })
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update quiz without authentication', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .send({ title: 'Updated' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update quiz with invalid ID', async () => {
      const response = await request(app)
        .put('/api/v1/quizzes/invalid-id')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ title: 'Updated' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update non-existent quiz', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .put(`/api/v1/quizzes/${nonExistentId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update quiz with invalid title length', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ title: 'Qz' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update quiz with partial data', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ durationMinutes: 45 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle empty update body', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not update quiz with invalid status', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .put(`/api/v1/quizzes/${quiz._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PATCH /api/v1/quizzes/:id/publish', () => {
    it('should publish quiz as trainer', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'draft' });

      const response = await request(app)
        .patch(`/api/v1/quizzes/${quiz._id}/publish`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.quiz.status).toBe('published');
    });

    it('should publish quiz as admin', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'draft' });

      const response = await request(app)
        .patch(`/api/v1/quizzes/${quiz._id}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not publish quiz as student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'draft' });

      const response = await request(app)
        .patch(`/api/v1/quizzes/${quiz._id}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not publish quiz without authentication', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'draft' });

      const response = await request(app)
        .patch(`/api/v1/quizzes/${quiz._id}/publish`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not publish quiz with invalid ID', async () => {
      const response = await request(app)
        .patch('/api/v1/quizzes/invalid-id/publish')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not publish non-existent quiz', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .patch(`/api/v1/quizzes/${nonExistentId}/publish`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/quizzes/:id/enroll', () => {
    it('should enroll in quiz as student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'published' });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not enroll in quiz as trainer', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'published' });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not enroll in quiz without authentication', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'published' });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not enroll in draft quiz', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'draft' });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not enroll twice in same quiz', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { status: 'published' });

      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not enroll in non-existent quiz', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .post(`/api/v1/quizzes/${nonExistentId}/enroll`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/quizzes/:id/start', () => {
    it('should start quiz as enrolled student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      // Enroll first
      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempt');
    });

    it('should not start quiz without enrollment', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start quiz as trainer', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start quiz without authentication', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not exceed maximum attempts', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id],
        attemptsAllowed: 1
      });

      // Enroll and start once
      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);
      
      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to start again
      const response = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/quizzes/:attemptId/submit', () => {
    it('should submit quiz as student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      // Enroll and start
      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const startResponse = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      const attemptId = startResponse.body.data.attempt._id;

      const submitData = {
        answers: [
          {
            questionId: testQuestion._id,
            answer: '2',
            clientTimestamp: new Date()
          }
        ],
        tabSwitches: 0,
        timeSpentSeconds: 60,
        isAutoSubmit: false
      };

      const response = await request(app)
        .post(`/api/v1/quizzes/${attemptId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not submit quiz as trainer', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes/some-attempt-id/submit')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit quiz without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes/some-attempt-id/submit')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit with missing answers', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes/some-attempt-id/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit with invalid question ID', async () => {
      const submitData = {
        answers: [
          {
            questionId: 'invalid-id',
            answer: '2'
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/quizzes/some-attempt-id/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle auto-submit', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const startResponse = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      const attemptId = startResponse.body.data.attempt._id;

      const submitData = {
        answers: [],
        isAutoSubmit: true
      };

      const response = await request(app)
        .post(`/api/v1/quizzes/${attemptId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/quizzes/:id/my-attempts', () => {
    it('should get my attempts for quiz as student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      // Enroll and start
      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);
      
      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get(`/api/v1/quizzes/${quiz._id}/my-attempts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempts');
    });

    it('should not get attempts as trainer', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .get(`/api/v1/quizzes/${quiz._id}/my-attempts`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get attempts without authentication', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

      const response = await request(app)
        .get(`/api/v1/quizzes/${quiz._id}/my-attempts`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Quiz Question Management', () => {
    describe('GET /api/v1/quizzes/:id/questions', () => {
      it('should get quiz questions as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, {
          questionIds: [testQuestion._id]
        });

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/questions`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('questions');
      });

      it('should not get quiz questions as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/questions`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/quizzes/:id/questions', () => {
      it('should add question to quiz as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send({ questionId: testQuestion._id })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not add question as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ questionId: testQuestion._id })
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not add question with invalid ID', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send({ questionId: 'invalid-id' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('DELETE /api/v1/quizzes/:id/questions/:questionId', () => {
      it('should remove question from quiz as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, {
          questionIds: [testQuestion._id]
        });

        const response = await request(app)
          .delete(`/api/v1/quizzes/${quiz._id}/questions/${testQuestion._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not remove question as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, {
          questionIds: [testQuestion._id]
        });

        const response = await request(app)
          .delete(`/api/v1/quizzes/${quiz._id}/questions/${testQuestion._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/quizzes/:id/questions/manual', () => {
      it('should add manual question as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const questionData = {
          prompt: 'What is 2 + 2?',
          type: 'mcq_single',
          marks: 1,
          choices: [
            { id: '1', text: '3', isCorrect: false },
            { id: '2', text: '4', isCorrect: true },
            { id: '3', text: '5', isCorrect: false }
          ]
        };

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions/manual`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(questionData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not add manual question as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions/manual`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ prompt: 'Test?' })
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
    });

      it('should not add manual question with short prompt', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions/manual`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send({ prompt: 'Q?' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not add manual question with less than 2 choices', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const questionData = {
          prompt: 'What is 2 + 2?',
          choices: [
            { id: '1', text: '4', isCorrect: true }
          ]
        };

        const response = await request(app)
          .post(`/api/v1/quizzes/${quiz._id}/questions/manual`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(questionData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Trainer/Admin Quiz Management', () => {
    describe('GET /api/v1/quizzes/:id/enrollments', () => {
      it('should get quiz enrollments as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/enrollments`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('enrollments');
      });

      it('should not get enrollments as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/enrollments`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/v1/quizzes/:id/attempts', () => {
      it('should get quiz attempts as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/attempts`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('attempts');
      });

      it('should filter attempts by status', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/attempts?status=submitted`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not get attempts as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/attempts`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/v1/quizzes/:id/statistics', () => {
      it('should get quiz statistics as trainer', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/statistics`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('statistics');
      });

      it('should not get statistics as student', async () => {
        const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id);

        const response = await request(app)
          .get(`/api/v1/quizzes/${quiz._id}/statistics`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('POST /api/v1/quizzes/:attemptId/auto-save', () => {
    it('should auto-save answers as student', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const startResponse = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      const attemptId = startResponse.body.data.attempt._id;

      const saveData = {
        answers: [
          {
            questionId: testQuestion._id,
            answer: '2',
            clientTimestamp: new Date()
          }
        ],
        tabSwitches: 0
      };

      const response = await request(app)
        .post(`/api/v1/quizzes/${attemptId}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not auto-save as trainer', async () => {
      const response = await request(app)
        .post('/api/v1/quizzes/some-attempt-id/auto-save')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle null answers in auto-save', async () => {
      const quiz = await createTestQuiz(trainerToken.userId || trainerToken.split('.')[0], testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/enroll`)
        .set('Authorization', `Bearer ${authToken}`);
      
      const startResponse = await request(app)
        .post(`/api/v1/quizzes/${quiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      const attemptId = startResponse.body.data.attempt._id;

      const saveData = {
        answers: [
          {
            questionId: testQuestion._id,
            answer: null
          }
        ]
      };

      const response = await request(app)
        .post(`/api/v1/quizzes/${attemptId}/auto-save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
