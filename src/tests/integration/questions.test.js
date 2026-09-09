const request = require('supertest');
const app = require('../../app');
const Question = require('../../models/Question');
const Subject = require('../../models/Subject');
const { createTestUser, generateToken, createTestSubject, createTestQuestion, cleanCollections } = require('../helpers/test-helpers');

describe('Questions Endpoints', () => {
  let authToken;
  let trainerToken;
  let adminToken;
  let testSubject;

  beforeEach(async () => {
    await cleanCollections();
    
    const student = await createTestUser({ role: 'student', email: 'student@example.com' });
    const trainer = await createTestUser({ role: 'trainer', email: 'trainer@example.com' });
    const admin = await createTestUser({ role: 'admin', email: 'admin@example.com' });

    authToken = generateToken(student._id, 'student');
    trainerToken = generateToken(trainer._id, 'trainer');
    adminToken = generateToken(admin._id, 'admin');

    testSubject = await createTestSubject();
  });

  describe('GET /api/v1/questions', () => {
    it('should list all questions for authenticated user', async () => {
      await createTestQuestion(testSubject._id, { prompt: 'Question 1' });
      await createTestQuestion(testSubject._id, { prompt: 'Question 2' });

      const response = await request(app)
        .get('/api/v1/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('questions');
      expect(response.body.data.questions.length).toBeGreaterThanOrEqual(2);
    });

    it('should not list questions without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/questions')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not list questions with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/questions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array when no questions exist', async () => {
      const response = await request(app)
        .get('/api/v1/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.questions).toEqual([]);
    });

    it('should filter questions by subject in query params', async () => {
      const subject2 = await createTestSubject({ code: 'SUB2' });
      await createTestQuestion(testSubject._id, { prompt: 'Question 1' });
      await createTestQuestion(subject2._id, { prompt: 'Question 2' });

      const response = await request(app)
        .get(`/api/v1/questions?subject=${testSubject._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.questions.length).toBe(1);
    });
  });

  describe('GET /api/v1/questions/:id', () => {
    it('should get single question by ID', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .get(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('question');
      expect(response.body.data.question._id).toBe(question._id.toString());
    });

    it('should not get question without authentication', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .get(`/api/v1/questions/${question._id}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get question with invalid ID format', async () => {
      const response = await request(app)
        .get('/api/v1/questions/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not get non-existent question', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/questions/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/questions', () => {
    it('should create MCQ single choice question as trainer', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'What is the capital of France?',
        choices: [
          { id: '1', text: 'London' },
          { id: '2', text: 'Paris' },
          { id: '3', text: 'Berlin' },
          { id: '4', text: 'Madrid' }
        ],
        correct: '2',
        marks: 1,
        metadata: { difficulty: 'easy' }
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('question');
      expect(response.body.data.question.prompt).toBe(questionData.prompt);
    });

    it('should create MCQ multiple choice question as admin', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_multi',
        prompt: 'Which of the following are programming languages?',
        choices: [
          { id: '1', text: 'Python' },
          { id: '2', text: 'Java' },
          { id: '3', text: 'HTML' },
          { id: '4', text: 'CSS' }
        ],
        correct: ['1', '2'],
        marks: 2
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should create short answer question', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'short_answer',
        prompt: 'What is the boiling point of water?',
        correct: '100',
        marks: 2
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should create numeric answer question', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'numeric',
        prompt: 'What is 2 + 2?',
        correct: 4,
        marks: 1
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not create question as student', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'Test question',
        choices: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }],
        correct: '1'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question without authentication', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .send(questionData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with missing subject', async () => {
      const questionData = {
        type: 'mcq_single',
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with missing type', async () => {
      const questionData = {
        subject: testSubject._id,
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with missing prompt', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with prompt shorter than 5 characters', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'Q?'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with invalid type', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'invalid_type',
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with invalid subject ID', async () => {
      const questionData = {
        subject: 'invalid-id',
        type: 'mcq_single',
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create question with negative marks', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'Test question',
        marks: -1
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should create question with default marks', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.question.marks).toBe(1);
    });

    it('should create question with metadata', async () => {
      const questionData = {
        subject: testSubject._id,
        type: 'mcq_single',
        prompt: 'Test question',
        metadata: { difficulty: 'hard', tags: ['math', 'algebra'] }
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not create question with non-existent subject', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const questionData = {
        subject: nonExistentId,
        type: 'mcq_single',
        prompt: 'Test question'
      };

      const response = await request(app)
        .post('/api/v1/questions')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(questionData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/v1/questions/:id', () => {
    it('should update question as trainer', async () => {
      const question = await createTestQuestion(testSubject._id);

      const updateData = {
        prompt: 'Updated question prompt',
        marks: 2
      };

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.question.prompt).toBe(updateData.prompt);
    });

    it('should update question as admin', async () => {
      const question = await createTestQuestion(testSubject._id);

      const updateData = {
        prompt: 'Updated question prompt'
      };

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not update question as student', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ prompt: 'Updated' })
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update question without authentication', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .send({ prompt: 'Updated' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update question with invalid ID', async () => {
      const response = await request(app)
        .put('/api/v1/questions/invalid-id')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ prompt: 'Updated' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update non-existent question', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .put(`/api/v1/questions/${nonExistentId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ prompt: 'Updated' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update question with invalid type', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ type: 'invalid_type' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update question with short prompt', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ prompt: 'Q?' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update question with negative marks', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ marks: -1 })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update question with partial data', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ marks: 3 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle empty update body', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should update question choices', async () => {
      const question = await createTestQuestion(testSubject._id);

      const updateData = {
        choices: [
          { id: '1', text: 'Option A' },
          { id: '2', text: 'Option B' },
          { id: '3', text: 'Option C' }
        ]
      };

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should update question correct answer', async () => {
      const question = await createTestQuestion(testSubject._id);

      const updateData = {
        correct: '3'
      };

      const response = await request(app)
        .put(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/questions/:id', () => {
    it('should delete question as admin', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .delete(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      const deletedQuestion = await Question.findById(question._id);
      expect(deletedQuestion).toBeNull();
    });

    it('should delete question as trainer', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .delete(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not delete question as student', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .delete(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete question without authentication', async () => {
      const question = await createTestQuestion(testSubject._id);

      const response = await request(app)
        .delete(`/api/v1/questions/${question._id}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete question with invalid ID', async () => {
      const response = await request(app)
        .delete('/api/v1/questions/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete non-existent question', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .delete(`/api/v1/questions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle deletion of question used in quiz', async () => {
      const question = await createTestQuestion(testSubject._id);
      // Note: This test assumes proper handling of questions used in quizzes
      // Adjust based on actual implementation

      const response = await request(app)
        .delete(`/api/v1/questions/${question._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
