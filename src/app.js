const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// ---------------------------------------------
// TRUST PROXY (Render + rate-limit)
// ---------------------------------------------
app.set("trust proxy", 1);

// ---------------------------------------------
// SECURITY HEADERS
// ---------------------------------------------
app.use(helmet());

// ---------------------------------------------
// FIX CORS COMPLETELY (Accept All Origins + All Headers)
// ---------------------------------------------
app.use(cors({
    origin: "*",  // allows localhost + LAN + any frontend
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"], // <-- FIXES x-request-id error
    exposedHeaders: ["*"],
}));

// Preflight support
app.options("*", cors());

// ---------------------------------------------
// SANITIZATION + COMPRESSION
// ---------------------------------------------
app.use(mongoSanitize());
app.use(compression());

// ---------------------------------------------
// BODY PARSING
// ---------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------
// RATE LIMITING (global)
// ---------------------------------------------
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// ---------------------------------------------
// REQUEST LOGGING
// ---------------------------------------------
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// ---------------------------------------------
// HEALTH CHECK
// ---------------------------------------------
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------
// API ROUTES
// ---------------------------------------------
app.use('/api/v1', routes);

// ---------------------------------------------
// ERROR HANDLERS (last)
// ---------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
