# Password Reset Implementation - Security Architecture

## Overview

Implemented a comprehensive, secure password reset and change password mechanism following industry best practices and security recommendations.

## Security Features Implemented

### 1. **Secure Token Storage**
- **Model**: Created `PasswordResetToken` model for secure token storage
- **Hashing**: Only store SHA-256 hash of tokens, never raw tokens
- **Single Use**: Tokens are marked as used after password reset
- **Expiration**: 15-minute token expiration with auto-cleanup
- **Invalidation**: Previous tokens automatically invalidated when new ones are created

### 2. **Cryptographic Security**
- **Token Generation**: 256-bit entropy using `crypto.randomBytes(32)`
- **Token Hashing**: SHA-256 hashing before database storage
- **Password Hashing**: bcrypt with 12 rounds for password storage
- **Session Invalidation**: `tokenVersion` field to invalidate JWTs after password changes

### 3. **Email Security**
- **Email Enumeration Prevention**: Always return same response whether email exists or not
- **Rate Limiting**: 5 requests per 15 minutes per IP for password reset endpoints
- **Secure Links**: Raw tokens only exist in email URLs, never in database or logs
- **Professional Templates**: HTML email templates with security warnings

### 4. **Authentication Security**
- **JWT Session Invalidation**: Token version checking in auth middleware
- **Password Strength Validation**: Comprehensive password requirements
- **Current Password Verification**: Required for password changes
- **Account Status Checks**: Verify account is active before allowing resets

## Architecture

### Database Models

#### User Model Updates
```javascript
// Added tokenVersion field for session invalidation
tokenVersion: {
    type: Number,
    default: 0
}
```

#### PasswordResetToken Model
```javascript
{
    user: ObjectId,           // Reference to User
    tokenHash: String,       // SHA-256 hash of raw token (unique)
    expiresAt: Date,         // 15-minute expiration
    usedAt: Date,            // Null until used
    ipAddress: String,       // Security auditing
    userAgent: String         // Security auditing
}
```

### Services Created

#### Password Reset Service (`password-reset.service.js`)
- `generateSecureToken()` - Generate 256-bit random token
- `hashToken()` - SHA-256 token hashing
- `createPasswordResetToken()` - Create and store secure token
- `validatePasswordResetToken()` - Validate token status
- `resetPassword()` - Reset password with token validation
- `changePassword()` - Change password for authenticated users
- `initiatePasswordReset()` - Start password reset process

#### Email Service (`email.service.js`)
- `sendPasswordResetEmail()` - Send password reset emails
- `sendVerificationEmail()` - Send email verification
- `sendPasswordChangeConfirmation()` - Send password change confirmation
- `createTransporter()` - Configure SMTP with fallback to mock

### API Endpoints

#### POST `/api/v1/auth/forgot-password`
- **Rate Limited**: 5 requests per 15 minutes
- **Security**: Prevents email enumeration
- **Process**: Validate email → Generate token → Send email

#### POST `/api/v1/auth/reset-password`
- **Rate Limited**: 5 requests per 15 minutes  
- **Validation**: Token validity, expiration, single-use check
- **Process**: Validate token → Update password → Invalidate sessions

#### POST `/api/v1/auth/change-password`
- **Authentication**: Required
- **Validation**: Current password verification, strength check
- **Process**: Verify current password → Update password → Invalidate sessions

### Security Middleware

#### JWT Middleware Updates
```javascript
// Check token version for session invalidation
if (decoded.tokenVersion !== user.tokenVersion) {
    return res.status(401).json({ 
        error: 'Session expired. Please log in again.' 
    });
}
```

#### Rate Limiting
- **Global**: 100 requests per 15 minutes
- **Password Reset**: 5 requests per 15 minutes (stricter)
- **IP-based**: Prevents abuse from single sources

## Configuration

### Environment Variables Required
```env
# Email Configuration
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
EMAIL_FROM=Quiz Application <noreply@quizapp.com>

# Frontend URL for reset links
FRONTEND_URL=http://localhost:3000

# Existing JWT Configuration
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

## Testing

### Comprehensive Test Suite
Created `password-reset.test.js` with 20+ test cases covering:

1. **Forgot Password Tests**
   - Valid email initiation
   - Non-existent email (security)
   - Email format validation
   - Token creation in database
   - Previous token invalidation

2. **Reset Password Tests**
   - Valid token reset
   - Invalid token rejection
   - Already used token rejection
   - Expired token rejection
   - Password strength validation
   - Token version increment
   - JWT session invalidation

3. **Change Password Tests**
   - Authenticated password change
   - Authentication requirement
   - Current password verification
   - Same password rejection
   - Password strength validation
   - Token version increment
   - JWT session invalidation

4. **Service Unit Tests**
   - Secure token generation
   - Consistent token hashing
   - Token validation
   - Previous token invalidation

5. **Rate Limiting Tests**
   - Forgot password rate limiting
   - Reset password rate limiting

## Security Checklist

✅ **Implemented Security Controls**

- [x] Random reset token (256-bit entropy)
- [x] Store token hash only (SHA-256)
- [x] Token expiration (15 minutes)
- [x] Single-use tokens
- [x] Invalidate old reset tokens
- [x] Generic forgot-password response (prevents enumeration)
- [x] Rate limiting (5 requests/15 minutes)
- [x] HTTPS ready (configuration provided)
- [x] Strong password hashing (bcrypt with 12 rounds)
- [x] Invalidate old sessions (tokenVersion)
- [x] Comprehensive audit logging
- [x] Don't log raw reset token
- [x] Don't email password
- [x] Professional email templates
- [x] Current password verification for changes
- [x] Account status validation
- [x] IP and user agent tracking

## Flow Diagrams

### Forgot Password Flow
```
User
 │
 │ POST /auth/forgot-password
 │ { email }
 ▼
Backend
 │
 ├── Normalize email
 ├── Find user (silent fail if not found)
 ├── Generate secure random token (256-bit)
 ├── Hash token (SHA-256)
 ├── Invalidate previous tokens
 ├── Store hash in database
 └── Send email with raw token
       │
       ▼
https://app.com/reset-password?token=RAW_TOKEN
```

### Reset Password Flow
```
User
 │
 │ POST /auth/reset-password
 │ { token, newPassword }
 ▼
Backend
 │
 ├── Hash incoming token
 ├── Find matching hash in database
 ├── Check token not used
 ├── Check token not expired
 ├── Validate password strength
 ├── Hash new password (bcrypt)
 ├── Update user password
 ├── Increment tokenVersion
 ├── Mark token as used
 └── Send confirmation email
```

### Change Password Flow
```
User (Authenticated)
 │
 │ POST /auth/change-password
 │ { currentPassword, newPassword }
 ▼
Backend
 │
 ├── Verify current password
 ├── Check new password != current
 ├── Validate password strength
 ├── Hash new password (bcrypt)
 ├── Increment tokenVersion
 └── Send confirmation email
```

### Session Invalidation Flow
```
Password Changed
 │
 ▼
User.tokenVersion++
 │
 ▼
Old JWT (tokenVersion: 0)
 │
 ▼
Auth Middleware Check
 │
 ├── JWT.tokenVersion (0)
 ├── DB.user.tokenVersion (1)
 └── Mismatch → Reject JWT
```

## Usage Examples

### Frontend Integration

#### Forgot Password
```javascript
// Request password reset
const response = await fetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com' })
});

// Always returns success for security
if (response.ok) {
    showMessage('If an account exists, a reset link has been sent to your email.');
}
```

#### Reset Password
```javascript
// Reset password with token from email
const response = await fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        token: urlParams.get('token'),
        newPassword: 'NewSecurePassword123!'
    })
});

if (response.ok) {
    redirect('/login');
}
```

#### Change Password
```javascript
// Change password (authenticated)
const response = await fetch('/api/v1/auth/change-password', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword456!'
    })
});

if (response.ok) {
    // Force logout since token is invalidated
    logout();
    redirect('/login');
}
```

## Deployment Considerations

### Production Setup
1. **SMTP Configuration**: Configure real SMTP server (Hostinger, SendGrid, etc.)
2. **Environment Variables**: Set all required environment variables
3. **HTTPS**: Ensure frontend uses HTTPS for secure token transmission
4. **Rate Limiting**: Configure Redis for distributed rate limiting if needed
5. **Monitoring**: Monitor failed reset attempts and rate limit hits
6. **Email Templates**: Customize email templates with your branding

### SMTP Configuration Examples

#### Hostinger SMTP
```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-smtp-password
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

#### Gmail (less recommended for production)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Monitoring and Logging

### Key Metrics to Monitor
- Password reset request rate (by IP, email)
- Failed reset attempts (invalid tokens, expired tokens)
- Successful password resets
- Password change requests
- Rate limit violations
- Email delivery failures

### Security Alerts
- Multiple reset requests for same email in short time
- High rate of invalid token attempts
- Unusual patterns in reset requests
- Email delivery failures

## Migration Notes

### Database Migration
If you have existing users, their `tokenVersion` will default to 0. Their existing JWT tokens will continue to work until they change their password.

### Existing Password Reset Tokens
The old `resetPasswordToken` and `resetPasswordExpiry` fields in the User model are still present for backward compatibility but are no longer used. Consider removing them in a future migration.

## Future Enhancements

### Optional Security Improvements
- **Argon2id**: Consider migrating from bcrypt to Argon2id for password hashing
- **SMS Backup**: Add SMS-based password reset as backup
- **Multi-Factor**: Require 2FA before password reset
- **Device Fingerprinting**: Add device tracking for reset requests
- **Behavioral Analysis**: ML-based detection of suspicious reset patterns
- **Redis Rate Limiting**: Distributed rate limiting for horizontal scaling

### UX Improvements
- **Password Strength Meter**: Real-time password strength feedback
- **Reset Link Preview**: Show partial reset link for verification
- **Multiple Email Methods**: Support both email and SMS
- **Password History**: Prevent reuse of recent passwords
- **Expiry Warnings**: Warn users before tokens expire

## Documentation References

- **API Documentation**: Update API docs with new endpoints
- **User Guide**: Add password reset instructions to user documentation
- **Security Policy**: Document password reset security measures
- **Incident Response**: Add password reset abuse handling procedures

## Support

For issues or questions about the password reset implementation:
1. Check the test suite for usage examples
2. Review the service implementation for logic details
3. Consult the security checklist for verification
4. Monitor logs for error patterns

## Summary

This implementation provides a production-ready, secure password reset mechanism that:
- Prevents email enumeration attacks
- Uses cryptographic best practices
- Invalidates sessions after password changes
- Includes comprehensive rate limiting
- Provides detailed audit logging
- Includes extensive test coverage
- Follows industry security standards

The system is ready for production deployment with proper SMTP configuration and environment variable setup.