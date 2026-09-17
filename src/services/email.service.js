// services/email.service.js - Email service using Nodemailer

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Create email transporter based on configuration
 * @returns {object} Nodemailer transporter
 */
function createTransporter() {
    // Check if SMTP configuration is available
    if (config.email.smtp.host && config.email.smtp.user && config.email.smtp.pass) {
        return nodemailer.createTransport({
            host: config.email.smtp.host,
            port: config.email.smtp.port || 587,
            secure: config.email.smtp.port === 465, // true for 465, false for other ports
            auth: {
                user: config.email.smtp.user,
                pass: config.email.smtp.pass
            }
        });
    }
    
    // Fallback to mock for development
    logger.warn('SMTP configuration not found, using mock email service');
    return createMockTransporter();
}

/**
 * Create mock transporter for development/testing
 * @returns {object} Mock nodemailer transporter
 */
function createMockTransporter() {
    return {
        sendMail: async (mailOptions) => {
            logger.info('---- MOCK EMAIL SENT ----');
            logger.info('To:', mailOptions.to);
            logger.info('Subject:', mailOptions.subject);
            logger.info('HTML:', mailOptions.html);
            
            // Extract reset URL from HTML for easier testing
            const urlMatch = mailOptions.html.match(/href="([^"]*reset-password[^"]*)"/);
            if (urlMatch) {
                logger.info('RESET URL (for testing):', urlMatch[1]);
            }
            
            logger.info('-------------------------');
            return { messageId: 'mock-message-id' };
        }
    };
}

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetUrl - Password reset URL
 * @param {string} userName - User's name (optional)
 * @returns {Promise<object>} Send result
 */
async function sendPasswordResetEmail(to, resetUrl, userName = '') {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"${config.email.from || 'Quiz Application'}" <${config.email.smtp.user || 'noreply@quizapp.com'}>`,
            to,
            subject: 'Reset Your Password',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background-color: #f9f9f9;
                            padding: 30px;
                            border-radius: 5px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #007bff;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .button:hover {
                            background-color: #0056b3;
                        }
                        .warning {
                            color: #856404;
                            background-color: #fff3cd;
                            padding: 10px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            font-size: 12px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Password Reset Request</h2>
                        
                        ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
                        
                        <p>We received a request to reset your password for your Quiz Application account.</p>
                        
                        <p>
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </p>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
                        
                        <div class="warning">
                            <strong>Important:</strong> This link will expire in 15 minutes for your security.
                        </div>
                        
                        <p>If you did not request this password reset, please ignore this email. Your account remains secure.</p>
                        
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>© ${new Date().getFullYear()} Quiz Application. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Password reset email sent to ${to}: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        logger.error('Error sending password reset email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send email verification email
 * @param {string} to - Recipient email
 * @param {string} verifyUrl - Email verification URL
 * @param {string} userName - User's name (optional)
 * @returns {Promise<object>} Send result
 */
async function sendVerificationEmail(to, verifyUrl, userName = '') {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"${config.email.from || 'Quiz Application'}" <${config.email.smtp.user || 'noreply@quizapp.com'}>`,
            to,
            subject: 'Verify Your Email Address',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verification</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background-color: #f9f9f9;
                            padding: 30px;
                            border-radius: 5px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #28a745;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .button:hover {
                            background-color: #218838;
                        }
                        .warning {
                            color: #856404;
                            background-color: #fff3cd;
                            padding: 10px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            font-size: 12px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Verify Your Email Address</h2>
                        
                        ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
                        
                        <p>Thank you for registering with Quiz Application. Please verify your email address to complete your registration.</p>
                        
                        <p>
                            <a href="${verifyUrl}" class="button">Verify Email</a>
                        </p>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #28a745;">${verifyUrl}</p>
                        
                        <div class="warning">
                            <strong>Important:</strong> This link will expire in 24 hours.
                        </div>
                        
                        <p>If you did not create an account with Quiz Application, please ignore this email.</p>
                        
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>© ${new Date().getFullYear()} Quiz Application. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Verification email sent to ${to}: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        logger.error('Error sending verification email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send password change confirmation email
 * @param {string} to - Recipient email
 * @param {string} userName - User's name (optional)
 * @returns {Promise<object>} Send result
 */
async function sendPasswordChangeConfirmation(to, userName = '') {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"${config.email.from || 'Quiz Application'}" <${config.email.smtp.user || 'noreply@quizapp.com'}>`,
            to,
            subject: 'Password Changed Successfully',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Changed</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .container {
                            background-color: #f9f9f9;
                            padding: 30px;
                            border-radius: 5px;
                        }
                        .success {
                            color: #155724;
                            background-color: #d4edda;
                            padding: 15px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .warning {
                            color: #856404;
                            background-color: #fff3cd;
                            padding: 10px;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px solid #ddd;
                            font-size: 12px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Password Changed Successfully</h2>
                        
                        ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
                        
                        <div class="success">
                            <strong>Success:</strong> Your password has been changed successfully.
                        </div>
                        
                        <p>If you did not make this change, please contact support immediately.</p>
                        
                        <div class="warning">
                            <strong>Security Notice:</strong> For your protection, all existing sessions have been invalidated. You will need to log in again.
                        </div>
                        
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>© ${new Date().getFullYear()} Quiz Application. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Password change confirmation sent to ${to}: ${info.messageId}`);
        
        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        logger.error('Error sending password change confirmation:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendPasswordResetEmail,
    sendVerificationEmail,
    sendPasswordChangeConfirmation,
    createTransporter
};