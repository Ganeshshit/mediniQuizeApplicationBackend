// tests/integration/password-reset.test.js

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const PasswordResetToken = require('../../models/PasswordResetToken');
const passwordResetService = require('../../services/password-reset.service');
const emailService = require('../../services/email.service');

describe('Password Reset Integration Tests', () => {
    let testUser;
    let authToken;

    beforeAll(async () => {
        // Connect to test database
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quiz-test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Create a test user
        testUser = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            passwordHash: await require('../../utils/password').hash('TestPassword123!'),
            role: 'student',
            isVerified: true,
            isActive: true
        });

        // Get auth token
        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'TestPassword123!'
            });

        authToken = loginResponse.body.data.accessToken;
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        await PasswordResetToken.deleteMany({});
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clean up reset tokens before each test
        await PasswordResetToken.deleteMany({});
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        it('should initiate password reset for valid email', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'test@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('password reset link has been sent');
        });

        it('should return same message for non-existent email (security)', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'nonexistent@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('password reset link has been sent');
        });

        it('should validate email format', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'invalid-email'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('email');
        });

        it('should require email field', async () => {
            const response = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Email is required');
        });

        it('should create reset token in database', async () => {
            await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'test@example.com'
                });

            const resetTokens = await PasswordResetToken.find({ user: testUser._id });
            expect(resetTokens.length).toBe(1);
            expect(resetTokens[0].tokenHash).toBeDefined();
            expect(resetTokens[0].expiresAt).toBeDefined();
            expect(resetTokens[0].usedAt).toBeNull();
        });

        it('should invalidate previous reset tokens', async () => {
            // Create first reset token
            await passwordResetService.createPasswordResetToken(testUser._id);
            
            // Request new reset
            await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'test@example.com'
                });

            const resetTokens = await PasswordResetToken.find({ user: testUser._id });
            expect(resetTokens.length).toBe(2);
            
            // First token should be marked as used
            const firstToken = await PasswordResetToken.findOne({ user: testUser._id }).sort({ createdAt: 1 });
            expect(firstToken.usedAt).toBeDefined();
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        let validToken;

        beforeEach(async () => {
            // Create a valid reset token before each test
            const tokenData = await passwordResetService.createPasswordResetToken(testUser._id);
            validToken = tokenData.rawToken;
        });

        it('should reset password with valid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: 'NewSecurePassword456!'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Password reset successfully');
        });

        it('should reject invalid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: 'invalid-token-12345',
                    newPassword: 'NewSecurePassword456!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid reset link');
        });

        it('should reject already used token', async () => {
            // Use the token once
            await passwordResetService.resetPassword(validToken, 'FirstPassword123!');

            // Try to use it again
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: 'SecondPassword456!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('already been used');
        });

        it('should reject expired token', async () => {
            // Create an expired token
            const expiredTokenData = await passwordResetService.createPasswordResetToken(testUser._id);
            await PasswordResetToken.findByIdAndUpdate(expiredTokenData.tokenId, {
                expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
            });

            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: expiredTokenData.rawToken,
                    newPassword: 'NewSecurePassword456!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('expired');
        });

        it('should validate password strength', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: 'weak' // Too weak
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Weak password');
        });

        it('should require token field', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    newPassword: 'NewSecurePassword456!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Token is required');
        });

        it('should require newPassword field', async () => {
            const response = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: validToken
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('New password is required');
        });

        it('should increment tokenVersion after password reset', async () => {
            const oldTokenVersion = testUser.tokenVersion;

            await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: 'NewSecurePassword456!'
                });

            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.tokenVersion).toBe(oldTokenVersion + 1);
        });

        it('should invalidate previous JWT tokens after password reset', async () => {
            // Reset password
            await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: validToken,
                    newPassword: 'NewSecurePassword456!'
                });

            // Try to use old JWT token
            const response = await request(app)
                .get('/api/v1/quizzes')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Session expired');
        });
    });

    describe('POST /api/v1/auth/change-password', () => {
        it('should change password for authenticated user', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'TestPassword123!',
                    newPassword: 'NewSecurePassword789!'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Password changed successfully');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .send({
                    currentPassword: 'TestPassword123!',
                    newPassword: 'NewSecurePassword789!'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should reject incorrect current password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'WrongPassword123!',
                    newPassword: 'NewSecurePassword789!'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Current password is incorrect');
        });

        it('should reject same password as current', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'TestPassword123!',
                    newPassword: 'TestPassword123!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('must be different from current password');
        });

        it('should validate new password strength', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'TestPassword123!',
                    newPassword: 'weak'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Weak password');
        });

        it('should require currentPassword field', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    newPassword: 'NewSecurePassword789!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Current password is required');
        });

        it('should require newPassword field', async () => {
            const response = await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'TestPassword123!'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('New password is required');
        });

        it('should increment tokenVersion after password change', async () => {
            const oldTokenVersion = testUser.tokenVersion;

            await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'TestPassword123!',
                    newPassword: 'NewSecurePassword789!'
                });

            const updatedUser = await User.findById(testUser._id);
            expect(updatedUser.tokenVersion).toBe(oldTokenVersion + 1);
        });

        it('should invalidate current JWT token after password change', async () => {
            // Change password
            await request(app)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'TestPassword123!',
                    newPassword: 'NewSecurePassword789!'
                });

            // Try to use old JWT token
            const response = await request(app)
                .get('/api/v1/quizzes')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toContain('Session expired');
        });
    });

    describe('Password Reset Service Unit Tests', () => {
        it('should generate secure random token', () => {
            const token1 = passwordResetService.generateSecureToken();
            const token2 = passwordResetService.generateSecureToken();

            expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
            expect(token2).toHaveLength(64);
            expect(token1).not.toBe(token2); // Should be different
        });

        it('should hash token consistently', () => {
            const token = 'test-token-12345';
            const hash1 = passwordResetService.hashToken(token);
            const hash2 = passwordResetService.hashToken(token);

            expect(hash1).toBe(hash2);
            expect(hash1).not.toBe(token); // Hash should be different from original
        });

        it('should validate valid token', async () => {
            const tokenData = await passwordResetService.createPasswordResetToken(testUser._id);
            const validation = await passwordResetService.validatePasswordResetToken(tokenData.rawToken);

            expect(validation.valid).toBe(true);
            expect(validation.user).toBeDefined();
            expect(validation.user._id.toString()).toBe(testUser._id.toString());
        });

        it('should invalidate previous tokens when creating new one', async () => {
            const firstToken = await passwordResetService.createPasswordResetToken(testUser._id);
            await passwordResetService.createPasswordResetToken(testUser._id);

            const validation = await passwordResetService.validatePasswordResetToken(firstToken.rawToken);
            expect(validation.valid).toBe(false);
            expect(validation.reason).toBe('already_used');
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit forgot-password requests', async () => {
            const requests = Array(6).fill(null).map(() =>
                request(app)
                    .post('/api/v1/auth/forgot-password')
                    .send({ email: 'test@example.com' })
            );

            const responses = await Promise.all(requests);
            
            // First 5 should succeed
            responses.slice(0, 5).forEach(response => {
                expect(response.status).toBe(200);
            });

            // 6th should be rate limited
            expect(responses[5].status).toBe(429);
            expect(responses[5].body.error).toContain('Too many password reset attempts');
        });

        it('should rate limit reset-password requests', async () => {
            const tokenData = await passwordResetService.createPasswordResetToken(testUser._id);
            
            const requests = Array(6).fill(null).map(() =>
                request(app)
                    .post('/api/v1/auth/reset-password')
                    .send({ 
                        token: tokenData.rawToken,
                        newPassword: 'NewPassword123!' 
                    })
            );

            const responses = await Promise.all(requests);
            
            // First 5 should fail with invalid/used (but not rate limited)
            responses.slice(0, 5).forEach(response => {
                expect([400, 429]).toContain(response.status);
            });

            // Eventually should hit rate limit
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });
});