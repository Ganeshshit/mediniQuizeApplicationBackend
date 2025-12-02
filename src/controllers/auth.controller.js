// ============================================
// controllers/auth.controller.js
// ============================================

const crypto = require("crypto");
const User = require("../models/User");
const JWTUtil = require("../utils/jwt");
const PasswordUtil = require("../utils/password");

// --------------------------------------------------
// Mock email sender (replace with nodemailer later)
// --------------------------------------------------
const sendEmail = async (to, subject, html) => {
    console.log("---- EMAIL SENT ----");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("HTML:", html);
    console.log("--------------------");
    return true;
};

// ==================================================
// REGISTER STUDENT
// POST /api/auth/register
// ==================================================
exports.register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,

            // Required student fields
            rollNo,
            registrationNo,
            semester,
            department,
            batch,
            softwareSkills,

            // Optional fields
            programmingLanguages,
            phone,
            gender,
            dateOfBirth,
            address,
            cgpa,
            previousEducation
        } = req.body;

        // -----------------------------------------
        // Validate required fields
        // -----------------------------------------
        const missing = [];

        if (!name) missing.push("name");
        if (!email) missing.push("email");
        if (!password) missing.push("password");
        if (!rollNo) missing.push("rollNo");
        if (!registrationNo) missing.push("registrationNo");
        if (!semester) missing.push("semester");
        if (!department) missing.push("department");
        if (!batch) missing.push("batch");

        if (!softwareSkills || !Array.isArray(softwareSkills) || softwareSkills.length === 0) {
            missing.push("softwareSkills[] (at least 1 required)");
        }

        if (missing.length > 0) {
            return res.status(400).json({
                error: "Missing required fields",
                missing
            });
        }

        // -----------------------------------------
        // Check existing user
        // -----------------------------------------
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ error: "Email already registered" });
        }

        // -----------------------------------------
        // Validate password strength
        // -----------------------------------------
        const passwordCheck = PasswordUtil.validate(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({
                error: "Weak password",
                details: passwordCheck.errors
            });
        }

        // -----------------------------------------
        // Hash password
        // -----------------------------------------
        const passwordHash = await PasswordUtil.hash(password);

        // -----------------------------------------
        // Generate verification token
        // -----------------------------------------
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

        // -----------------------------------------
        // Create Student User
        // -----------------------------------------
        const user = await User.create({
            email,
            passwordHash,
            name,
            role: "student",       // FORCE ROLE ALWAYS STUDENT
            rollNo,
            registrationNo,
            semester,
            department,
            batch,
            softwareSkills,
            programmingLanguages,
            phone,
            gender,
            dateOfBirth,
            address,
            cgpa,
            previousEducation,

            isVerified: false,
            verificationToken,
            verificationTokenExpiry
        });

        // -----------------------------------------
        // Send verification email
        // -----------------------------------------
        const verifyURL = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        await sendEmail(
            email,
            "Verify Your Account",
            `
                <h2>Hello ${name}</h2>
                <p>Please verify your email:</p>
                <a href="${verifyURL}">${verifyURL}</a>
            `
        );

        // -----------------------------------------
        // Generate JWT
        // -----------------------------------------
        const tokens = JWTUtil.generateTokenPair(user._id, "student");

        return res.status(201).json({
            message: "Registration successful. Please verify your email.",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                rollNo: user.rollNo,
                registrationNo: user.registrationNo,
                semester: user.semester,
                department: user.department,
                batch: user.batch,
                isVerified: user.isVerified
            },
            ...tokens
        });

    } catch (err) {
        console.error("REGISTER ERROR:", err);
        return res.status(500).json({
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

        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Account locked?
        if (user.accountLockedUntil && user.accountLockedUntil > Date.now()) {
            const minutes = Math.ceil((user.accountLockedUntil - Date.now()) / 60000);
            return res.status(423).json({
                error: `Account locked. Try again in ${minutes} minutes.`
            });
        }

        // Check active
        if (!user.isActive) {
            return res.status(403).json({
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
                    error: "Too many attempts. Account locked for 30 min."
                });
            }

            await user.save();
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Reset failed attempts
        user.loginAttempts = 0;
        user.accountLockedUntil = undefined;
        user.lastLoginAt = new Date();
        user.lastLoginIP = req.ip;
        await user.save();

        // Generate tokens
        const tokens = JWTUtil.generateTokenPair(user._id, user.role);

        return res.status(200).json({
            message: "Login successful",
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
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ error: "Login failed" });
    }
};

// ==================================================
// REFRESH TOKEN
// POST /api/auth/refresh
// ==================================================
exports.refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken)
            return res.status(400).json({ error: "Refresh token required" });

        const decoded = JWTUtil.verifyRefreshToken(refreshToken);

        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ error: "Invalid token" });

        const tokens = JWTUtil.generateTokenPair(user._id, user.role);

        return res.status(200).json({
            message: "Token refreshed",
            ...tokens
        });

    } catch (err) {
        return res.status(401).json({ error: err.message });
    }
};

// ==================================================
// FORGOT PASSWORD
// ==================================================
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user)
            return res.status(200).json({ message: "Reset link sent if email exists." });

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save();

        const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        await sendEmail(
            email,
            "Password Reset",
            `<p>Click to reset password:</p>
             <a href="${resetURL}">${resetURL}</a>`
        );

        res.json({ message: "Reset link sent to email if exists." });

    } catch (err) {
        res.status(500).json({ error: "Error processing request" });
    }
};

// ==================================================
// RESET PASSWORD
// ==================================================
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const hashed = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashed,
            resetPasswordExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        const strength = PasswordUtil.validate(newPassword);
        if (!strength.valid) {
            return res.status(400).json({ error: "Weak password", details: strength.errors });
        }

        user.passwordHash = await PasswordUtil.hash(newPassword);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();

        await sendEmail(
            user.email,
            "Password Reset Successful",
            `<p>Your password has been updated.</p>`
        );

        res.json({ message: "Password reset successfully." });

    } catch (err) {
        res.status(500).json({ error: "Reset failed" });
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

        const verifyURL = `${process.env.FRONTEND_URL}/verify-email?token=${newToken}`;

        await sendEmail(
            email,
            "Verify Email",
            `<p>Click link to verify:</p>
             <a href="${verifyURL}">${verifyURL}</a>`
        );

        res.json({ message: "Verification email sent." });

    } catch (err) {
        res.status(500).json({ error: "Failed to resend verification" });
    }
};
