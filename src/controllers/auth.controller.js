// ============================================
// controllers/auth.controller.js
// ============================================

const crypto = require("crypto");
const User = require("../models/User");
const JWTUtil = require("../utils/jwt");
const PasswordUtil = require("../utils/password");
const passwordResetService = require("../services/password-reset.service");
const emailService = require("../services/email.service");
const config = require("../config");

// ==================================================
// REGISTER STUDENT
// POST /api/auth/register
// ==================================================
// exports.register = async (req, res) => {
//     try {
//         const {
//             name,
//             email,
//             password,

//             // Required student fields
//             rollNo,
//             registrationNo,
//             semester,
//             department,
//             batch,
//             softwareSkills,

//             // Optional fields
//             programmingLanguages,
//             phone,
//             gender,
//             dateOfBirth,
//             address,
//             cgpa,
//             previousEducation
//         } = req.body;

//         // -----------------------------------------
//         // Validate required fields
//         // -----------------------------------------
//         const missing = [];

//         if (!name) missing.push("name");
//         if (!email) missing.push("email");
//         if (!password) missing.push("password");
//         if (!rollNo) missing.push("rollNo");
//         if (!registrationNo) missing.push("registrationNo");
//         if (!semester) missing.push("semester");
//         if (!department) missing.push("department");
//         if (!batch) missing.push("batch");

//         if (!softwareSkills || !Array.isArray(softwareSkills) || softwareSkills.length === 0) {
//             missing.push("softwareSkills[] (at least 1 required)");
//         }

//         if (missing.length > 0) {
//             return res.status(400).json({
//                 error: "Missing required fields",
//                 missing
//             });
//         }

//         // -----------------------------------------
//         // Check existing user
//         // -----------------------------------------
//         const emailExists = await User.findOne({ email });
//         if (emailExists) {
//             return res.status(400).json({ error: "Email already registered" });
//         }

//         // -----------------------------------------
//         // Validate password strength
//         // -----------------------------------------
//         const passwordCheck = PasswordUtil.validate(password);
//         if (!passwordCheck.valid) {
//             return res.status(400).json({
//                 error: "Weak password",
//                 details: passwordCheck.errors
//             });
//         }

//         // -----------------------------------------
//         // Hash password
//         // -----------------------------------------
//         const passwordHash = await PasswordUtil.hash(password);

//         // -----------------------------------------
//         // Generate verification token
//         // -----------------------------------------
//         const verificationToken = crypto.randomBytes(32).toString("hex");
//         const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

//         // -----------------------------------------
//         // Create Student User
//         // -----------------------------------------
//         const user = await User.create({
//             email,
//             passwordHash,
//             name,
//             role: "student",       // FORCE ROLE ALWAYS STUDENT
//             rollNo,
//             registrationNo,
//             semester,
//             department,
//             batch,
//             softwareSkills,
//             programmingLanguages,
//             phone,
//             gender,
//             dateOfBirth,
//             address,
//             cgpa,
//             previousEducation,

//             isVerified: false,
//             verificationToken,
//             verificationTokenExpiry
//         });

//         // -----------------------------------------
//         // Send verification email
//         // -----------------------------------------
//         const verifyURL = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

//         await sendEmail(
//             email,
//             "Verify Your Account",
//             `
//                 <h2>Hello ${name}</h2>
//                 <p>Please verify your email:</p>
//                 <a href="${verifyURL}">${verifyURL}</a>
//             `
//         );

//         // -----------------------------------------
//         // Generate JWT
//         // -----------------------------------------
//         const tokens = JWTUtil.generateTokenPair(user._id, "student");

//         return res.status(201).json({
//             message: "Registration successful. Please verify your email.",
//             user: {
//                 _id: user._id,
//                 name: user.name,
//                 email: user.email,
//                 role: user.role,
//                 rollNo: user.rollNo,
//                 registrationNo: user.registrationNo,
//                 semester: user.semester,
//                 department: user.department,
//                 batch: user.batch,
//                 isVerified: user.isVerified
//             },
//             ...tokens
//         });

//     } catch (err) {
//         console.error("REGISTER ERROR:", err);
//         return res.status(500).json({
//             error: "Registration failed",
//             details: err.message
//         });
//     }
// };



exports.register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phoneNo,
            usn,
            collegeName
        } = req.body;

        // Required minimal fields
        const missing = [];
        if (!name) missing.push("name");
        if (!email) missing.push("email");
        if (!password) missing.push("password");
        if (!phoneNo) missing.push("phoneNo");
        if (!usn) missing.push("usn");
        if (!collegeName) missing.push("collegeName");

        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                missing
            });
        }

        // Name length validation
        if (name.length < 2 || name.length > 100) {
            return res.status(400).json({
                success: false,
                error: "Name must be between 2 and 100 characters"
            });
        }

        // Phone number validation
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phoneNo)) {
            return res.status(400).json({
                success: false,
                error: "Phone number must be 10 digits"
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: "Invalid email format"
            });
        }

        // Check if email exists
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ success: false, error: "Email already registered" });
        }

        // Password strength validation
        const passwordCheck = PasswordUtil.validate(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({
                success: false,
                error: "Weak password",
                details: passwordCheck.errors
            });
        }

        // Hash password
        const passwordHash = await PasswordUtil.hash(password);

        // Email verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

        // Create user
        const user = await User.create({
            name,
            email,
            passwordHash,
            role: "student",
            phoneNo,
            usn,
            collegeName,
            isVerified: false,
            verificationToken,
            verificationTokenExpiry
        });

        // Send verification email
        const verifyURL = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

        await emailService.sendVerificationEmail(email, verifyURL, name);

        // Create tokens with tokenVersion for session invalidation
        const tokens = JWTUtil.generateTokenPair(user._id, "student", user.tokenVersion);

        return res.status(201).json({
            success: true,
            message: "Registration successful. Please verify your email.",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phoneNo: user.phoneNo,
                    usn: user.usn,
                    collegeName: user.collegeName,
                    role: user.role,
                    isVerified: user.isVerified
                },
                ...tokens
            }
        });

    } catch (err) {
        console.error("REGISTER ERROR:", err);
        return res.status(500).json({
            success: false,
            error: "Registration failed",
            details: err.message
        });
    }
};

// ==================================================
// LOGIN STUDENT
// POST /api/auth/login
// ==================================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: "Email is required" });
        }
        if (!password) {
            return res.status(400).json({ success: false, error: "Password is required" });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: "Invalid email format" });
        }

        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) {
            return res.status(401).json({ success: false, error: "Invalid email or password" });
        }

        // Account locked?
        if (user.accountLockedUntil && user.accountLockedUntil > Date.now()) {
            const minutes = Math.ceil((user.accountLockedUntil - Date.now()) / 60000);
            return res.status(423).json({
                success: false,
                error: `Account locked. Try again in ${minutes} minutes.`
            });
        }

        // Check active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: "Account disabled. Contact support."
            });
        }

        // Validate password
        const validPassword = await PasswordUtil.compare(password, user.passwordHash);
        if (!validPassword) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;

            if (user.loginAttempts >= 5) {
                user.accountLockedUntil = Date.now() + 30 * 60 * 1000;
                await user.save();
                return res.status(423).json({
                    success: false,
                    error: "Too many attempts. Account locked for 30 min."
                });
            }

            await user.save();
            return res.status(401).json({ success: false, error: "Invalid email or password" });
        }

        // Reset failed attempts
        user.loginAttempts = 0;
        user.accountLockedUntil = undefined;
        user.lastLoginAt = new Date();
        user.lastLoginIP = req.ip;
        await user.save();

        // Generate tokens with tokenVersion for session invalidation
        const tokens = JWTUtil.generateTokenPair(user._id, user.role, user.tokenVersion);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    semester: user.semester,
                    department: user.department,
                    batch: user.batch,
                    rollNo: user.rollNo,
                    registrationNo: user.registrationNo,
                    profilePicture: user.profilePicture
                },
                ...tokens
            }
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ success: false, error: "Login failed" });
    }
};

// ==================================================
// REFRESH TOKEN
// ==================================================
exports.refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken)
            return res.status(400).json({ success: false, error: "Refresh token required" });

        const decoded = JWTUtil.verifyRefreshToken(refreshToken);

        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ success: false, error: "Invalid token" });

        // Generate new tokens with current tokenVersion
        const tokens = JWTUtil.generateTokenPair(user._id, user.role, user.tokenVersion);

        return res.status(200).json({
            success: true,
            message: "Token refreshed",
            data: {
                ...tokens
            }
        });

    } catch (err) {
        return res.status(401).json({ success: false, error: err.message });
    }
};

// ==================================================
// FORGOT PASSWORD (SECURE IMPLEMENTATION)
// ==================================================
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: "Email is required" 
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid email format" 
            });
        }

        // Get client metadata for security
        const metadata = {
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        };

        // Initiate password reset (always returns success to prevent email enumeration)
        const result = await passwordResetService.initiatePasswordReset(email, metadata);

        // If user exists and token was created, send email
        if (result.userExists && result.resetToken) {
            const resetURL = `${config.frontendUrl}/reset-password?token=${result.resetToken}`;
            
            await emailService.sendPasswordResetEmail(email, resetURL);
        }

        // Always return the same message for security
        res.json({ 
            success: true, 
            message: "If an account exists for this email, a password reset link has been sent." 
        });

    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        // Still return success to prevent email enumeration
        res.json({ 
            success: true, 
            message: "If an account exists for this email, a password reset link has been sent." 
        });
    }
};

// ==================================================
// RESET PASSWORD (SECURE IMPLEMENTATION)
// ==================================================
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token) {
            return res.status(400).json({ 
                success: false, 
                error: "Token is required" 
            });
        }
        if (!newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: "New password is required" 
            });
        }

        // Use the secure password reset service
        const result = await passwordResetService.resetPassword(token, newPassword);

        if (!result.success) {
            // Map specific error reasons to appropriate status codes
            const errorMap = {
                'invalid_token': { status: 400, message: 'Invalid reset link' },
                'already_used': { status: 400, message: 'Reset link has already been used' },
                'expired': { status: 400, message: 'Reset link has expired' },
                'account_inactive': { status: 403, message: 'Account is inactive' },
                'weak_password': { status: 400, message: 'Password does not meet requirements', details: result.details },
                'server_error': { status: 500, message: 'Server error occurred' }
            };

            const errorInfo = errorMap[result.reason] || { status: 400, message: 'Password reset failed' };
            
            return res.status(errorInfo.status).json({ 
                success: false, 
                error: errorInfo.message,
                ...(result.details && { details: result.details })
            });
        }

        // Send confirmation email
        try {
            // Get user email from the token validation
            const validation = await passwordResetService.validatePasswordResetToken(token);
            if (validation.valid && validation.user) {
                await emailService.sendPasswordChangeConfirmation(
                    validation.user.email,
                    validation.user.name
                );
            }
        } catch (emailError) {
            // Log but don't fail the reset if email fails
            console.error('Failed to send password change confirmation:', emailError);
        }

        res.json({ 
            success: true, 
            message: "Password reset successfully. Please log in with your new password." 
        });

    } catch (err) {
        console.error("RESET PASSWORD ERROR:", err);
        res.status(500).json({ 
            success: false, 
            error: "Password reset failed" 
        });
    }
};

// ==================================================
// VERIFY EMAIL
// ==================================================
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpiry: { $gt: Date.now() }
        });

        if (!user)
            return res.status(400).json({ error: "Invalid or expired token" });

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiry = undefined;
        await user.save();

        res.json({ message: "Email verified successfully" });

    } catch (err) {
        res.status(500).json({ error: "Verification failed" });
    }
};

// ==================================================
// RESEND VERIFICATION EMAIL
// ==================================================
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.isVerified)
            return res.status(400).json({ error: "Email already verified" });

        const newToken = crypto.randomBytes(32).toString("hex");
        user.verificationToken = newToken;
        user.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        const verifyURL = `${config.frontendUrl}/verify-email?token=${newToken}`;

        await emailService.sendVerificationEmail(email, verifyURL, user.name);

        res.json({ message: "Verification email sent." });

    } catch (err) {
        res.status(500).json({ error: "Failed to resend verification" });
    }
};

// ==================================================
// CHANGE PASSWORD (AUTHENTICATED USERS)
// ==================================================
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id;

        if (!currentPassword) {
            return res.status(400).json({ 
                success: false, 
                error: "Current password is required" 
            });
        }
        if (!newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: "New password is required" 
            });
        }

        // Use the secure password change service
        const result = await passwordResetService.changePassword(userId, currentPassword, newPassword);

        if (!result.success) {
            // Map specific error reasons to appropriate status codes
            const errorMap = {
                'user_not_found': { status: 404, message: 'User not found' },
                'invalid_current_password': { status: 401, message: 'Current password is incorrect' },
                'same_password': { status: 400, message: 'New password must be different from current password' },
                'weak_password': { status: 400, message: 'Password does not meet requirements', details: result.details },
                'server_error': { status: 500, message: 'Server error occurred' }
            };

            const errorInfo = errorMap[result.reason] || { status: 400, message: 'Password change failed' };
            
            return res.status(errorInfo.status).json({ 
                success: false, 
                error: errorInfo.message,
                ...(result.details && { details: result.details })
            });
        }

        // Send confirmation email
        try {
            await emailService.sendPasswordChangeConfirmation(req.user.email, req.user.name);
        } catch (emailError) {
            // Log but don't fail the change if email fails
            console.error('Failed to send password change confirmation:', emailError);
        }

        res.json({ 
            success: true, 
            message: "Password changed successfully. Please log in again." 
        });

    } catch (err) {
        console.error("CHANGE PASSWORD ERROR:", err);
        res.status(500).json({ 
            success: false, 
            error: "Password change failed" 
        });
    }
};
