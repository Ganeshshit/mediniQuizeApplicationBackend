const request = require('supertest');
const app = require('../../app');
const Subject = require('../../models/Subject');
const mongoose = require('mongoose');
const { createTestUser, generateToken, createTestSubject, cleanCollections } = require('../helpers/test-helpers');

describe('Subjects Endpoints', () => {
  let authToken;
  let trainerToken;
  let adminToken;

  beforeEach(async () => {
    await cleanCollections();
    
    const student = await createTestUser({ role: 'student', email: 'student@example.com' });
    const trainer = await createTestUser({ role: 'trainer', email: 'trainer@example.com' });
    const admin = await createTestUser({ role: 'admin', email: 'admin@example.com' });

    authToken = generateToken(student._id, 'student');
    trainerToken = generateToken(trainer._id, 'trainer');
    adminToken = generateToken(admin._id, 'admin');
  });

  describe('GET /api/v1/subjects', () => {
    it('should list all subjects for authenticated user', async () => {
      await createTestSubject({ name: 'Mathematics' });
      await createTestSubject({ name: 'Physics' });

      const response = await request(app)
        .get('/api/v1/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('subjects');
      expect(response.body.data.subjects.length).toBeGreaterThanOrEqual(2);
    });

    it('should not list subjects without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/subjects')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not list subjects with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/subjects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return empty array when no subjects exist', async () => {
      const response = await request(app)
        .get('/api/v1/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.subjects).toEqual([]);
    });

    it('should handle malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/v1/subjects')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/subjects', () => {
    it('should create subject as trainer', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        description: 'Introduction to Computer Science',
        department: 'Engineering',
        semester: 1,
        credits: 3
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('subject');
      expect(response.body.data.subject.name).toBe(subjectData.name);
    });

    it('should create subject as admin', async () => {
      const subjectData = {
        name: 'Mathematics',
        code: 'MATH101',
        description: 'Calculus I'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(subjectData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not create subject as student', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subjectData)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject without authentication', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .send(subjectData)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with missing name', async () => {
      const subjectData = {
        code: 'CS101'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with missing code', async () => {
      const subjectData = {
        name: 'Computer Science'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with name shorter than 2 characters', async () => {
      const subjectData = {
        name: 'C',
        code: 'CS101'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with name longer than 100 characters', async () => {
      const subjectData = {
        name: 'A'.repeat(101),
        code: 'CS101'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with code shorter than 2 characters', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'C'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with code longer than 20 characters', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'C'.repeat(21)
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with description longer than 500 characters', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        description: 'A'.repeat(501)
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with invalid semester (less than 1)', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        semester: 0
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with invalid semester (greater than 12)', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        semester: 13
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with invalid credits (less than 1)', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        credits: 0
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not create subject with invalid credits (greater than 10)', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        credits: 11
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should create subject with empty description', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        description: ''
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should create subject with empty department', async () => {
      const subjectData = {
        name: 'Computer Science',
        code: 'CS101',
        department: ''
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not create duplicate subject with same code', async () => {
      await createTestSubject({ code: 'CS101' });

      const subjectData = {
        name: 'Different Name',
        code: 'CS101'
      };

      const response = await request(app)
        .post('/api/v1/subjects')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(subjectData)
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/v1/subjects/:id', () => {
    it('should update subject as trainer', async () => {
      const subject = await createTestSubject();

      const updateData = {
        name: 'Updated Subject Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.subject.name).toBe(updateData.name);
    });

    it('should update subject as admin', async () => {
      const subject = await createTestSubject();

      const updateData = {
        name: 'Updated Subject Name'
      };

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not update subject as student', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update subject without authentication', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .send({ name: 'Updated' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update subject with invalid ID', async () => {
      const response = await request(app)
        .put('/api/v1/subjects/invalid-id')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ name: 'Updated' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update non-existent subject', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/v1/subjects/${nonExistentId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update subject with invalid name length', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ name: 'A' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not update subject with invalid description length', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ description: 'A'.repeat(501) })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should update subject with partial data', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle empty update body', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .put(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/subjects/:id', () => {
    it('should delete subject as admin', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .delete(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      const deletedSubject = await Subject.findById(subject._id);
      expect(deletedSubject).toBeNull();
    });

    it('should not delete subject as trainer', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .delete(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete subject as student', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .delete(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete subject without authentication', async () => {
      const subject = await createTestSubject();

      const response = await request(app)
        .delete(`/api/v1/subjects/${subject._id}`)
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete subject with invalid ID', async () => {
      const response = await request(app)
        .delete('/api/v1/subjects/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not delete non-existent subject', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/v1/subjects/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle deletion of subject with associated questions', async () => {
      const subject = await createTestSubject();
      // Note: This test assumes cascade deletion or proper error handling
      // Adjust based on actual implementation

      const response = await request(app)
        .delete(`/api/v1/subjects/${subject._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});
