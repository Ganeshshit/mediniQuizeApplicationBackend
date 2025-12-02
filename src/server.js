require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const connectDB = require('./db/mongoose');
// const initSocketHandlers = require('./sockets');

const server = http.createServer(app);

console.log("Mongo DB URL",process.env.MONGO_URI)
// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: config.corsOrigins,
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Attach io to app for access in routes/services
app.set('io', io);

// Initialize socket handlers
// initSocketHandlers(io);

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(() => {
        logger.info('HTTP server closed');
        io.close(() => {
            logger.info('Socket.IO server closed');
            process.exit(0);
        });
    });

    // Force shutdown after 10s
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
    try {
        await connectDB();
        logger.info('MongoDB connected successfully');

        server.listen(config.port, () => {
            logger.info(`Server running on port ${config.port} in ${config.env} mode`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();