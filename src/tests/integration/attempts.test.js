const request = require('supertest');
const app = require('../../app');
const Quiz = require('../../models/Quiz');
const Question = require('../../models/Question');
const QuizEnrollment = require('../../models/QuizEnrollment');
const QuizAttempt = require('../../models/QuizAttempt');
const User = require('../../models/User');
const { createTestUser, generateToken, createTestSubject, createTestQuestion, createTestQuiz, createTestEnrollment, createTestAttempt, cleanCollections } = require('../helpers/test-helpers');

describe('Attempts Endpoints', () => {
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

  describe('POST /api/v1/attempts/quizzes/:quizId/start', () => {
    it('should start attempt as enrolled student', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      await createTestEnrollment(student._id, testQuiz._id);

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempt');
      expect(response.body.data.attempt.status).toBe('in_progress');
    });

    it('should not start attempt without enrollment', async () => {
      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start attempt as trainer', async () => {
      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/start`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start attempt without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/start`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start attempt with invalid quiz ID', async () => {
      const response = await request(app)
        .post('/api/v1/attempts/quizzes/invalid-id/start')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start attempt for non-existent quiz', async () => {
      const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${nonExistentId}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not exceed maximum attempts', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      await createTestEnrollment(student._id, testQuiz._id);
      await createTestAttempt(student._id, testQuiz._id, { status: 'submitted' });

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not start attempt for draft quiz', async () => {
      const draftQuiz = await createTestQuiz(trainer._id, testSubject._id, { 
        status: 'draft',
        questionIds: [testQuestion._id]
      });

      const student = await User.findOne({ email: 'student@example.com' });
      await createTestEnrollment(student._id, draftQuiz._id);

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${draftQuiz._id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/attempts/quizzes/:quizId/save', () => {
    it('should save answers as student', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const saveData = {
        attemptId: attempt._id,
        sessionId: 'session-123',
        answers: [
          {
            questionId: testQuestion._id,
            answer: '2',
            clientTimestamp: new Date()
          }
        ]
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not save answers as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const saveData = {
        attemptId: attempt._id,
        sessionId: 'session-123',
        answers: []
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(saveData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not save answers without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not save with missing attempt ID', async () => {
      const saveData = {
        sessionId: 'session-123',
        answers: []
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not save with missing session ID', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const saveData = {
        attemptId: attempt._id,
        answers: []
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not save with missing answers', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const saveData = {
        attemptId: attempt._id,
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not save with invalid attempt ID', async () => {
      const saveData = {
        attemptId: 'invalid-id',
        sessionId: 'session-123',
        answers: []
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not save with invalid question ID', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const saveData = {
        attemptId: attempt._id,
        sessionId: 'session-123',
        answers: [
          {
            questionId: 'invalid-id',
            answer: '2'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/save`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(saveData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/attempts/quizzes/:quizId/submit', () => {
    it('should submit attempt as student', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const submitData = {
        attemptId: attempt._id,
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not submit attempt as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const submitData = {
        attemptId: attempt._id,
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/submit`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(submitData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit attempt without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/submit`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit with missing attempt ID', async () => {
      const submitData = {
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit with missing session ID', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const submitData = {
        attemptId: attempt._id
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not submit already submitted attempt', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'submitted' });

      const submitData = {
        attemptId: attempt._id,
        sessionId: 'session-123'
      };

      const response = await request(app)
        .post(`/api/v1/attempts/quizzes/${testQuiz._id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(submitData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/attempts/quizzes/:quizId/attempts/:attemptId', () => {
    it('should get attempt as student (own attempt)', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts/${attempt._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempt');
    });

    it('should not get attempt of another student', async () => {
      const otherStudent = await createTestUser({ role: 'student', email: 'other@example.com' });
      const attempt = await createTestAttempt(otherStudent._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts/${attempt._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should get attempt as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts/${attempt._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not get attempt without authentication', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts/${attempt._id}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get attempt with invalid quiz ID', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      const attempt = await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/invalid-id/attempts/${attempt._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get attempt with invalid attempt ID', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts/invalid-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get non-existent attempt', async () => {
      const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/attempts/quizzes/:quizId/attempts', () => {
    it('should list attempts as trainer', async () => {
      const student = await User.findOne({ email: 'student@example.com' });
      await createTestAttempt(student._id, testQuiz._id);

      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('attempts');
    });

    it('should list attempts as admin', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not list attempts as student', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not list attempts without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array when no attempts exist', async () => {
      const response = await request(app)
        .get(`/api/v1/attempts/quizzes/${testQuiz._id}/attempts`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.attempts).toEqual([]);
    });
  });

  describe('Grading Endpoints', () => {
    describe('GET /api/v1/attempts/grading/pending', () => {
      it('should get pending grading as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const response = await request(app)
          .get('/api/v1/attempts/grading/pending')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('attempts');
      });

      it('should get pending grading as admin', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/grading/pending')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not get pending grading as student', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/grading/pending')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get pending grading without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/grading/pending')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/v1/attempts/grading/:attemptId', () => {
      it('should get attempt for grading as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const response = await request(app)
          .get(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('attempt');
      });

      it('should not get attempt for grading as student', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get attempt for grading without authentication', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/grading/${attempt._id}`)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get attempt for grading with invalid ID', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/grading/invalid-id')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get non-existent attempt for grading', async () => {
        const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .get(`/api/v1/attempts/grading/${nonExistentId}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/v1/attempts/grading/:attemptId', () => {
      it('should grade answer as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const gradeData = {
          questionId: testQuestion._id,
          score: 1,
          feedback: 'Good answer'
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should grade answer as admin', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const gradeData = {
          questionId: testQuestion._id,
          score: 1
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(gradeData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not grade answer as student', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const gradeData = {
          questionId: testQuestion._id,
          score: 1
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(gradeData)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not grade answer without authentication', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .send({ questionId: testQuestion._id, score: 1 })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not grade with missing question ID', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const gradeData = {
          score: 1
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not grade with missing score', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const gradeData = {
          questionId: testQuestion._id
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not grade with negative score', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const gradeData = {
          questionId: testQuestion._id,
          score: -1
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not grade with invalid question ID', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const gradeData = {
          questionId: 'invalid-id',
          score: 1
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not grade with feedback exceeding max length', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const gradeData = {
          questionId: testQuestion._id,
          score: 1,
          feedback: 'A'.repeat(501)
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should handle optional feedback', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const gradeData = {
          questionId: testQuestion._id,
          score: 1
        };

        const response = await request(app)
          .post(`/api/v1/attempts/grading/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(gradeData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('PATCH /api/v1/attempts/grading/:attemptId/finalize', () => {
      it('should finalize grading as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const response = await request(app)
          .patch(`/api/v1/attempts/grading/${attempt._id}/finalize`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should finalize grading as admin', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'needs_manual_review' });

        const response = await request(app)
          .patch(`/api/v1/attempts/grading/${attempt._id}/finalize`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not finalize grading as student', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .patch(`/api/v1/attempts/grading/${attempt._id}/finalize`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not finalize grading without authentication', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .patch(`/api/v1/attempts/grading/${attempt._id}/finalize`)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not finalize with invalid attempt ID', async () => {
        const response = await request(app)
          .patch('/api/v1/attempts/grading/invalid-id/finalize')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not finalize non-existent attempt', async () => {
        const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .patch(`/api/v1/attempts/grading/${nonExistentId}/finalize`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not finalize already finalized attempt', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id, { status: 'manually_graded' });

        const response = await request(app)
          .patch(`/api/v1/attempts/grading/${attempt._id}/finalize`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Audit Event Endpoints', () => {
    describe('POST /api/v1/attempts/audit/event', () => {
      it('should log audit event as student', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventData = {
          attemptId: attempt._id,
          eventType: 'tab_switch',
          clientTimestamp: new Date(),
          meta: { tabCount: 1 }
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${authToken}`)
          .send(eventData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not log audit event as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventData = {
          attemptId: attempt._id,
          eventType: 'tab_switch'
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${trainerToken}`)
          .send(eventData)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not log audit event without authentication', async () => {
        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not log with missing attempt ID', async () => {
        const eventData = {
          eventType: 'tab_switch'
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${authToken}`)
          .send(eventData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not log with missing event type', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventData = {
          attemptId: attempt._id
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${authToken}`)
          .send(eventData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not log with invalid event type', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventData = {
          attemptId: attempt._id,
          eventType: 'invalid_event'
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${authToken}`)
          .send(eventData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should log all valid event types', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventTypes = ['tab_switch', 'visibility_change', 'window_blur', 'window_focus', 
                           'fullscreen_enter', 'fullscreen_exit', 'copy', 'paste', 'cut', 
                           'context_menu', 'keyboard_shortcut', 'heartbeat'];

        for (const eventType of eventTypes) {
          const eventData = {
            attemptId: attempt._id,
            eventType
          };

          const response = await request(app)
            .post('/api/v1/attempts/audit/event')
            .set('Authorization', `Bearer ${authToken}`)
            .send(eventData)
            .expect(200);

          expect(response.body).toHaveProperty('success', true);
        }
      });

      it('should handle optional meta field', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventData = {
          attemptId: attempt._id,
          eventType: 'tab_switch'
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${authToken}`)
          .send(eventData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should handle optional client timestamp', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const eventData = {
          attemptId: attempt._id,
          eventType: 'tab_switch'
        };

        const response = await request(app)
          .post('/api/v1/attempts/audit/event')
          .set('Authorization', `Bearer ${authToken}`)
          .send(eventData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('GET /api/v1/attempts/audit/:attemptId', () => {
      it('should get audit log as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/audit/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('auditLog');
      });

      it('should get audit log as admin', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/audit/${attempt._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not get audit log as student', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/audit/${attempt._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get audit log without authentication', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/audit/${attempt._id}`)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get audit log with invalid attempt ID', async () => {
        const response = await request(app)
          .get('/api/v1/attempts/audit/invalid-id')
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not get audit log for non-existent attempt', async () => {
        const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .get(`/api/v1/attempts/audit/${nonExistentId}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should return empty array for attempt with no audit events', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .get(`/api/v1/attempts/audit/${attempt._id}`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.auditLog).toEqual([]);
      });
    });

    describe('POST /api/v1/attempts/attempts/:attemptId/heartbeat', () => {
      it('should send heartbeat as student', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const heartbeatData = {
          sessionId: 'session-123'
        };

        const response = await request(app)
          .post(`/api/v1/attempts/attempts/${attempt._id}/heartbeat`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(heartbeatData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should not send heartbeat as trainer', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .post(`/api/v1/attempts/attempts/${attempt._id}/heartbeat`)
          .set('Authorization', `Bearer ${trainerToken}`)
          .send({ sessionId: 'session-123' })
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not send heartbeat without authentication', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .post(`/api/v1/attempts/attempts/${attempt._id}/heartbeat`)
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not send heartbeat with missing session ID', async () => {
        const student = await User.findOne({ email: 'student@example.com' });
        const attempt = await createTestAttempt(student._id, testQuiz._id);

        const response = await request(app)
          .post(`/api/v1/attempts/attempts/${attempt._id}/heartbeat`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not send heartbeat with invalid attempt ID', async () => {
        const response = await request(app)
          .post('/api/v1/attempts/attempts/invalid-id/heartbeat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ sessionId: 'session-123' })
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should not send heartbeat for non-existent attempt', async () => {
        const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .post(`/api/v1/attempts/attempts/${nonExistentId}/heartbeat`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ sessionId: 'session-123' })
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });
});
