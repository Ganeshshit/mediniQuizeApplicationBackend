require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 5000,

    // Database
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/quiz-app',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // JWT
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'your-access-secret-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d'
    },

    // CORS
    corsOrigins: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:5173'],

    // Email (example with SendGrid/Nodemailer)
    email: {
        from: process.env.EMAIL_FROM || 'noreply@quizapp.com',
        sendgridApiKey: process.env.SENDGRID_API_KEY,
        // Or SMTP config
        smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    },

    // App config
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,

    // Anti-cheat thresholds
    antiCheat: {
        maxTabSwitches: 5,
        tabSwitchWarning: 3,
        maxIpChanges: 1
    }
};

// Validate critical config
const requiredEnvVars = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.env === 'production') {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

module.exports = config;