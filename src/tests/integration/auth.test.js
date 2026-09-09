const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { createTestUser, generateToken, cleanCollections } = require('../helpers/test-helpers');

describe('Authentication Endpoints', () => {
  beforeEach(async () => {
    await cleanCollections();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password@123',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should not register user with existing email', async () => {
      await createTestUser({ email: 'john@example.com' });

      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password@123',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not register user with invalid email format', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password@123',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not register user with weak password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not register user with invalid phone number', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password@123',
        phoneNo: '123',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not register user with missing required fields', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
        // Missing password, phoneNo, usn, collegeName
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not register user with name shorter than 2 characters', async () => {
      const userData = {
        name: 'J',
        email: 'john@example.com',
        password: 'Password@123',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not register user with name longer than 100 characters', async () => {
      const userData = {
        name: 'A'.repeat(101),
        email: 'john@example.com',
        password: 'Password@123',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should register user with additional fields', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password@123',
        phoneNo: '1234567890',
        usn: 'USN12345',
        collegeName: 'Test College',
        semester: 3,
        department: 'Computer Science'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = await createTestUser({ 
        email: 'john@example.com',
        passwordHash: await require('bcrypt').hash('Password@123', 10)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'john@example.com',
          password: 'Password@123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(user.email);
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password@123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not login with invalid password', async () => {
      await createTestUser({ 
        email: 'john@example.com',
        password: await require('bcrypt').hash('Password@123', 10)
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'john@example.com',
          password: 'WrongPassword@123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not login with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'Password@123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not login with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'john@example.com'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Password@123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not login with empty credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: '',
          password: ''
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const user = await createTestUser();
      const refreshToken = require('../helpers/test-helpers').generateRefreshToken(user._id.toString());

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should not refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not refresh with expired refresh token', async () => {
      const expiredToken = require('jsonwebtoken').sign(
        { userId: 'some-id' },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not refresh with missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not refresh with malformed token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-jwt-token' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should send reset email for valid email', async () => {
      await createTestUser({ email: 'john@example.com' });

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'john@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not reveal if email exists (security)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not send with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not send with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not send with empty email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const user = await createTestUser();
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000;
      await user.save();

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword@123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should not reset with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword@123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not reset with expired token', async () => {
      const user = await createTestUser();
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.resetPasswordExpiry = Date.now() - 60 * 60 * 1000; // Expired
      await user.save();

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword@123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not reset with weak password', async () => {
      const user = await createTestUser();
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000;
      await user.save();

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'weak'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not reset with missing token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          newPassword: 'NewPassword@123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not reset with missing new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'some-token'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should not reset with empty password', async () => {
      const user = await createTestUser();
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000;
      await user.save();

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: ''
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
