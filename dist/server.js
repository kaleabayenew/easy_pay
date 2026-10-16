"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const database_1 = require("./config/database");
const routes_1 = __importDefault(require("./routes"));
require("./models"); // Ensure associations are registered
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // disable CSP for pure API
    frameguard: { action: 'deny' },
    noSniff: true,
}));
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Signature',
        'X-Device-Id',
        'X-Timestamp',
    ],
}));
// Body parsing with size limit to prevent large payload attacks
app.use(express_1.default.json({ limit: '10kb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10kb' }));
// Health check (no auth)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});
// API Routes
app.use('/api/v1', routes_1.default);
// 404 handler for unknown routes
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});
// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});
let server;
const startServer = async () => {
    try {
        // Verify DB connection before sync
        await database_1.sequelize.authenticate();
        console.log('Database connection established');
        await database_1.sequelize.sync({ alter: true });
        console.log('Database synced successfully');
        server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server?.close(() => {
        console.log('HTTP server closed');
        database_1.sequelize
            .close()
            .then(() => {
            console.log('Database connection closed');
            process.exit(0);
        })
            .catch(() => process.exit(1));
    });
});
startServer();
exports.default = app;
