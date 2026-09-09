const request = require('supertest');
const app = require('../../app');
const Quiz = require('../../models/Quiz');
const Question = require('../../models/Question');
const QuizEnrollment = require('../../models/QuizEnrollment');
const QuizAttempt = require('../../models/QuizAttempt');
const User = require('../../models/User');
const { createTestUser, generateToken, createTestSubject, createTestQuestion, createTestQuiz, createTestEnrollment, createTestAttempt, cleanCollections } = require('../helpers/test-helpers');

describe('Monitoring Endpoints', () => {
  let authToken;
  let trainerToken;
  let adminToken;
  let testSubject;
  let testQuestion;
  let testQuiz;

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
    testQuiz = await createTestQuiz(trainer._id, testSubject._id, { 
      status: 'published',
      questionIds: [testQuestion._id]
    });
  });

  describe('GET /api/v1/attempts/monitoring/overview', () => {
    it('should get monitoring overview as trainer', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/overview')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('overview');
    });

    it('should get monitoring overview as admin', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get monitoring overview as student', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get monitoring overview without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/overview')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/attempts/monitoring/suspicious', () => {
    it('should get suspicious attempts as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      await createTestAttempt(student._id, testQuiz._id, { 
        status: 'flagged',
        tabSwitches: 10
      });

      const response = await request(app)
        .get('/api/v1/attempts/monitoring/suspicious')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempts');
    });

    it('should get suspicious attempts as admin', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/suspicious')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get suspicious attempts as student', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/suspicious')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get suspicious attempts without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/suspicious')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array when no suspicious attempts', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/suspicious')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.attempts).toEqual([]);
    });
  });

  describe('GET /api/v1/attempts/monitoring/attempt/:attemptId/details', () => {
    it('should get attempt audit details as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/attempt/${attempt._id}/details`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('details');
    });

    it('should get attempt audit details as admin', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/attempt/${attempt._id}/details`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get attempt audit details as student', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/attempt/${attempt._id}/details`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get attempt audit details without authentication', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/attempt/${attempt._id}/details`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get attempt audit details with invalid ID', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/attempt/invalid-id/details')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get audit details for non-existent attempt', async () => {
      const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/attempt/${nonExistentId}/details`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/attempts/monitoring/quiz/:quizId/stats', () => {
    it('should get quiz monitoring stats as trainer', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/quiz/${testQuiz._id}/stats`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('stats');
    });

    it('should get quiz monitoring stats as admin', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/quiz/${testQuiz._id}/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get quiz monitoring stats as student', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/quiz/${testQuiz._id}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get quiz monitoring stats without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/quiz/${testQuiz._id}/stats`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get quiz monitoring stats with invalid quiz ID', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/quiz/invalid-id/stats')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get stats for non-existent quiz', async () => {
      const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/quiz/${nonExistentId}/stats`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return zero stats for quiz with no attempts', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/quiz/${testQuiz._id}/stats`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.stats.totalAttempts).toBe(0);
    });
  });

  describe('GET /api/v1/attempts/monitoring/student/:studentId/history', () => {
    it('should get student anti-cheat history as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/student/${student._id}/history`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('history');
    });

    it('should get student anti-cheat history as admin', async () => {
      const student = await User.findOne({ email: 'student@example.com' });

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/student/${student._id}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get student anti-cheat history as student', async () => {
      const student = await User.findOne({ email: 'student@example.com' });

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/student/${student._id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get student anti-cheat history without authentication', async () => {
      const student = await User.findOne({ email: 'student@example.com' });

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/student/${student._id}/history`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get history with invalid student ID', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/student/invalid-id/history')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get history for non-existent student', async () => {
      const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/student/${nonExistentId}/history`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array for student with no attempts', async () => {
      const student = await User.findOne({ email: 'student@example.com' });

      const response = await request(app)
        .get(`/api/v1/attempts/monitoring/student/${student._id}/history`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.history).toEqual([]);
    });
  });

  describe('GET /api/v1/attempts/monitoring/realtime', () => {
    it('should get real-time monitoring as trainer', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/realtime')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('realtime');
    });

    it('should get real-time monitoring as admin', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/realtime')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get real-time monitoring as student', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/realtime')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get real-time monitoring without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/realtime')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/attempts/monitoring/flagged', () => {
    it('should get flagged attempts as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      await createTestAttempt(student._id, testQuiz._id, { status: 'flagged' });

      const response = await request(app)
        .get('/api/v1/attempts/monitoring/flagged')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempts');
    });

    it('should get flagged attempts as admin', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/flagged')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get flagged attempts as student', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/flagged')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get flagged attempts without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/flagged')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array when no flagged attempts', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/flagged')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.attempts).toEqual([]);
    });
  });

  describe('GET /api/v1/attempts/monitoring/export', () => {
    it('should export monitoring data as trainer', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/export')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should export monitoring data as admin', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not export monitoring data as student', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not export monitoring data without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/export')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/attempts/monitoring/batch', () => {
    it('should get batch monitoring data as trainer', async () => {
      const quiz2 = await createTestQuiz(trainer._id, testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const batchData = {
        quizIds: [testQuiz._id, quiz2._id],
        includeRealTime: true,
        includeStats: true
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(batchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('batchData');
    });

    it('should get batch monitoring data as admin', async () => {
      const batchData = {
        quizIds: [testQuiz._id],
        includeRealTime: false,
        includeStats: true
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(batchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get batch monitoring data as student', async () => {
      const batchData = {
        quizIds: [testQuiz._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send(batchData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get batch monitoring data without authentication', async () => {
      const batchData = {
        quizIds: [testQuiz._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .send(batchData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get batch with missing quiz IDs', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get batch with empty quiz IDs array', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds: [] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get batch with quiz IDs below minimum', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds: [] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get batch with quiz IDs exceeding maximum', async () => {
      const quizIds = Array(21).fill(new require('mongoose').Types.ObjectId());

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get batch with invalid quiz ID', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds: ['invalid-id'] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle default values for optional fields', async () => {
      const batchData = {
        quizIds: [testQuiz._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(batchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle includeRealTime false', async () => {
      const batchData = {
        quizIds: [testQuiz._id],
        includeRealTime: false,
        includeStats: true
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(batchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle includeStats false', async () => {
      const batchData = {
        quizIds: [testQuiz._id],
        includeRealTime: true,
        includeStats: false
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/batch')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(batchData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/attempts/monitoring/trainer/dashboard', () => {
    it('should get trainer dashboard summary as trainer', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/trainer/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('dashboard');
    });

    it('should not get trainer dashboard as admin', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/trainer/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get trainer dashboard as student', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/trainer/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get trainer dashboard without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/attempts/monitoring/trainer/dashboard')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/attempts/monitoring/compare', () => {
    it('should get comparative analysis as trainer', async () => {
      const quiz2 = await createTestQuiz(trainer._id, testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const compareData = {
        quizIds: [testQuiz._id, quiz2._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(compareData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('comparison');
    });

    it('should get comparative analysis as admin', async () => {
      const compareData = {
        quizIds: [testQuiz._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(compareData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get comparative analysis as student', async () => {
      const compareData = {
        quizIds: [testQuiz._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${authToken}`)
        .send(compareData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get comparative analysis without authentication', async () => {
      const compareData = {
        quizIds: [testQuiz._id]
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .send(compareData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not compare with missing quiz IDs', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not compare with quiz IDs below minimum', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds: [testQuiz._id] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not compare with quiz IDs exceeding maximum', async () => {
      const quizIds = Array(11).fill(new require('mongoose').Types.ObjectId());

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not compare with invalid quiz ID', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ quizIds: [testQuiz._id, 'invalid-id'] })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle optional date range', async () => {
      const quiz2 = await createTestQuiz(trainer._id, testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const compareData = {
        quizIds: [testQuiz._id, quiz2._id],
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(compareData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle invalid date format', async () => {
      const quiz2 = await createTestQuiz(trainer._id, testSubject._id, { 
        status: 'published',
        questionIds: [testQuestion._id]
      });

      const compareData = {
        quizIds: [testQuiz._id, quiz2._id],
        startDate: 'invalid-date'
      };

      const response = await request(app)
        .post('/api/v1/attempts/monitoring/compare')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(compareData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Quiz Selection & Switching Endpoints', () => {
    describe('GET /api/v1/attempts/monitoring/quizzes/available', () => {
      it('should get available quizzes as trainer', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/available')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('quizzes');
      });

      it('should get available quizzes as admin', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/available')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not get available quizzes as student', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/available')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get available quizzes without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/available')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should return empty array when no quizzes available', async () => {
        await Quiz.deleteMany({});

        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/available')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.quizzes).toEqual([]);
      });
    });

    describe('GET /api/v1/attempts/monitoring/quizzes/subjects', () => {
      it('should get subjects for filter as trainer', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/subjects')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('subjects');
      });

      it('should get subjects for filter as admin', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/subjects')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not get subjects for filter as student', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/subjects')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get subjects for filter without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/subjects')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/attempts/monitoring/quizzes/switch', () => {
      it('should switch to quiz as trainer', async () => {
        const switchData = {
          quizId: testQuiz._id,
          includeRealTime: true,
          includeStats: true
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(switchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('quizData');
      });

      it('should switch to quiz as admin', async () => {
        const switchData = {
          quizId: testQuiz._id
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(switchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not switch to quiz as student', async () => {
        const switchData = {
          quizId: testQuiz._id
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${authToken}`)
          .send(switchData)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not switch to quiz without authentication', async () => {
        const switchData = {
          quizId: testQuiz._id
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .send(switchData)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not switch with missing quiz ID', async () => {
        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not switch with invalid quiz ID', async () => {
        const switchData = {
          quizId: 'invalid-id'
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(switchData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not switch to non-existent quiz', async () => {
        const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

        const switchData = {
          quizId: nonExistentId
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(switchData)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should handle default values for optional fields', async () => {
        const switchData = {
          quizId: testQuiz._id
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(switchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should handle includeRealTime false', async () => {
        const switchData = {
          quizId: testQuiz._id,
          includeRealTime: false,
          includeStats: true
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(switchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should handle includeStats false', async () => {
        const switchData = {
          quizId: testQuiz._id,
          includeRealTime: true,
          includeStats: false
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/switch')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(switchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('GET /api/v1/attempts/monitoring/quizzes/categories', () => {
      it('should get quiz categories as trainer', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/categories')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('categories');
      });

      it('should get quiz categories as admin', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not get quiz categories as student', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/categories')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get quiz categories without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/categories')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should return empty array when no categories', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/monitoring/quizzes/categories')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('POST /api/v1/attempts/monitoring/quizzes/search', () => {
      it('should search quizzes as trainer', async () => {
        const searchData = {
          query: 'test',
          filters: {}
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('quizzes');
      });

      it('should search quizzes as admin', async () => {
        const searchData = {
          query: 'test'
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not search quizzes as student', async () => {
        const searchData = {
          query: 'test'
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .set('Authorization', `Bearer ${authToken}`)
          .send(searchData)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not search quizzes without authentication', async () => {
        const searchData = {
          query: 'test'
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .send(searchData)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
    });

      it('should handle empty search', async () => {
        const searchData = {};

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should handle filters', async () => {
        const searchData = {
          query: 'test',
          filters: {
            subject: testSubject._id,
            status: 'published'
          }
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should return empty array for no matches', async () => {
        const searchData = {
          query: 'nonexistentquiz12345'
        };

        const response = await request(app)
          .post('/api/v1/attempts/monitoring/quizzes/search')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.quizzes).toEqual([]);
      });
    });
  });
});
