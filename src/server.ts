import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sequelize } from './config/database';
import routes from './routes';
import './models'; // Ensure associations are registered

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // disable CSP for pure API
    frameguard: { action: 'deny' },
    noSniff: true,
  } as Parameters<typeof helmet>[0])
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Signature',
      'X-Device-Id',
      'X-Timestamp',
    ],
  })
);

// Body parsing with size limit to prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'EasyPay SMS Monitor API',
    version: '1.0.0',
    description: 'REST API for authentication, device management, and SMS monitoring.',
    healthCheck: '/health',
    apiBase: '/api/v1',
    authentication: {
      bearerToken: 'Send protected requests with the Authorization: Bearer <token> header.',
      hmac: 'Device requests requiring HMAC use X-Signature, X-Device-Id, and X-Timestamp headers.',
    },
    endpoints: {
      auth: [
        'POST /api/v1/auth/login',
        'POST /api/v1/auth/register',
        'POST /api/v1/auth/change-pin',
        'POST /api/v1/auth/request-otp',
        'POST /api/v1/auth/verify-otp',
      ],
      sms: [
        'POST /api/v1/sms',
        'GET /api/v1/sms/logs/:deviceId',
        'POST /api/v1/sms/:id/retry',
        'DELETE /api/v1/sms/:id',
      ],
      devices: [
        'POST /api/v1/heartbeat',
        'GET /api/v1/devices',
        'GET /api/v1/devices/:deviceId',
        'POST /api/v1/devices/:deviceId/deactivate',
      ],
      superadmin: [
        'POST /api/v1/superadmin/login',
        'GET /api/v1/superadmin/verify-session',
        'GET /api/v1/superadmin/dashboard',
        'GET /api/v1/superadmin/otp-requests',
        'POST /api/v1/superadmin/otp-requests/:id/resend',
        'GET /api/v1/superadmin/blocked',
        'POST /api/v1/superadmin/blocked',
        'POST /api/v1/superadmin/blocked/:id/unblock',
        'GET /api/v1/superadmin/analysis/sms',
        'GET /api/v1/superadmin/owners',
        'POST /api/v1/superadmin/owners',
        'POST /api/v1/superadmin/owners/:id/suspend',
        'POST /api/v1/superadmin/owners/:id/reactivate',
        'GET /api/v1/superadmin/devices',
        'GET /api/v1/superadmin/devices/:id',
        'POST /api/v1/superadmin/devices/:id/revoke',
        'POST /api/v1/superadmin/devices/:id/wipe',
        'GET /api/v1/superadmin/whitelist',
        'POST /api/v1/superadmin/whitelist',
        'PUT /api/v1/superadmin/whitelist/:id',
        'DELETE /api/v1/superadmin/whitelist/:id',
        'GET /api/v1/superadmin/limits',
        'PUT /api/v1/superadmin/limits',
        'GET /api/v1/superadmin/audit-log',
        'GET /api/v1/superadmin/reports',
        'GET /api/v1/superadmin/settings/profile',
        'GET /api/v1/superadmin/settings/sessions',
        'DELETE /api/v1/superadmin/settings/sessions/:id',
        'GET /api/v1/superadmin/settings/notifications',
        'PUT /api/v1/superadmin/settings/notifications',
      ],
    },
  });
});

// Health check (no auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// API Routes
app.use('/api/v1', routes);

// 404 handler for unknown routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

let server: ReturnType<typeof app.listen>;

const startServer = async (): Promise<void> => {
  try {
    // Verify DB connection before sync
    await sequelize.authenticate();
    console.log('Database connection established');

    await sequelize.sync({ alter: true });
    console.log('Database synced successfully');

    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server?.close(() => {
    console.log('HTTP server closed');
    sequelize
      .close()
      .then(() => {
        console.log('Database connection closed');
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
});

startServer();

export default app;
