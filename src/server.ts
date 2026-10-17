/// <reference path="./types/express.d.ts" />
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sequelize } from './config/database';
import routes from './routes';
import './models'; // Ensure associations are registered
import { startVerificationCleanup } from './services/verificationCleanupService';

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

// ─── Request Logger Middleware ────────────────────────────────────────────────
const COLORS = {
  reset:   '\x1b[0m',
  bright:  '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
};

function getMethodColor(method: string): string {
  const map: Record<string, string> = {
    GET:    COLORS.green,
    POST:   COLORS.cyan,
    PUT:    COLORS.yellow,
    PATCH:  COLORS.magenta,
    DELETE: COLORS.red,
  };
  return map[method] ?? COLORS.white;
}

function getStatusColor(status: number): string {
  if (status < 300) return COLORS.green;
  if (status < 400) return COLORS.cyan;
  if (status < 500) return COLORS.yellow;
  return COLORS.red;
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  const methodColor = getMethodColor(method);

  // Log incoming request immediately
  console.log(
    `${COLORS.gray}[${formatTime()}]${COLORS.reset} ` +
    `${COLORS.bright}${methodColor}${method.padEnd(7)}${COLORS.reset} ` +
    `${COLORS.white}${originalUrl}${COLORS.reset} ` +
    `${COLORS.gray}← from ${ip ?? 'unknown'}${COLORS.reset}`
  );

  // Log body for non-GET requests (hide sensitive fields)
  if (method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    if (safeBody.pin)      safeBody.pin      = '****';
    if (safeBody.password) safeBody.password = '****';
    if (safeBody.otpCode)  safeBody.otpCode  = '****';
    if (safeBody.code)     safeBody.code     = '****';
    console.log(
      `${COLORS.gray}         body: ${JSON.stringify(safeBody)}${COLORS.reset}`
    );
  }

  // Intercept response to log status and duration
  const originalSend = res.send.bind(res);
  res.send = function (body: unknown) {
    const duration = Date.now() - start;
    const statusColor = getStatusColor(res.statusCode);
    const durationColor = duration > 1000 ? COLORS.red : duration > 500 ? COLORS.yellow : COLORS.green;

    console.log(
      `${COLORS.gray}[${formatTime()}]${COLORS.reset} ` +
      `${COLORS.bright}${methodColor}${method.padEnd(7)}${COLORS.reset} ` +
      `${COLORS.white}${originalUrl}${COLORS.reset} ` +
      `${COLORS.bright}${statusColor}${res.statusCode}${COLORS.reset} ` +
      `${durationColor}(${duration}ms)${COLORS.reset}`
    );
    return originalSend(body);
  };

  next();
});
// ─────────────────────────────────────────────────────────────────────────────



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
      transaction: [
        'POST /api/v1/verify-transaction',
        'GET /api/v1/verify-transaction/:verificationId',
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

function printStartupBanner(port: number | string): void {
  const env = process.env.NODE_ENV || 'development';
  console.log(`
${COLORS.cyan}${COLORS.bright}  ███████╗ █████╗ ███████╗██╗   ██╗    ██████╗  █████╗ ██╗   ██╗
  ██╔════╝██╔══██╗██╔════╝╚██╗ ██╔╝    ██╔══██╗██╔══██╗╚██╗ ██╔╝
  █████╗  ███████║███████╗ ╚████╔╝     ██████╔╝███████║ ╚████╔╝ 
  ██╔══╝  ██╔══██║╚════██║  ╚██╔╝      ██╔═══╝ ██╔══██║  ╚██╔╝  
  ███████╗██║  ██║███████║   ██║       ██║     ██║  ██║   ██║   
  ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝       ╚═╝     ╚═╝  ╚═╝   ╚═╝   ${COLORS.reset}
  ${COLORS.gray}─────────────────────────────────────────────────────────────${COLORS.reset}
  ${COLORS.green}●${COLORS.reset} ${COLORS.bright}EasyPay SMS Monitor API${COLORS.reset} ${COLORS.gray}v1.0.0${COLORS.reset}
  ${COLORS.cyan}➜${COLORS.reset}  ${COLORS.bright}Port:${COLORS.reset}        ${COLORS.green}${port}${COLORS.reset}
  ${COLORS.cyan}➜${COLORS.reset}  ${COLORS.bright}Database:${COLORS.reset}    ${COLORS.green}Connected & Synced${COLORS.reset}
  ${COLORS.cyan}➜${COLORS.reset}  ${COLORS.bright}Environment:${COLORS.reset} ${COLORS.yellow}${env}${COLORS.reset}
  ${COLORS.gray}─────────────────────────────────────────────────────────────${COLORS.reset}
`);
}

let server: ReturnType<typeof app.listen>;

const startServer = async (): Promise<void> => {
  try {
    // Verify DB connection before sync
    await sequelize.authenticate();
    console.log(`${COLORS.gray}[Database] Connection established${COLORS.reset}`);

    await sequelize.sync({ alter: true });
    console.log(`${COLORS.gray}[Database] Synced successfully${COLORS.reset}`);

    server = app.listen(PORT, () => {
      printStartupBanner(PORT);
    });

    // Start verification cleanup service
    startVerificationCleanup();
    console.log(`${COLORS.gray}[Cleanup] Verification cleanup service running${COLORS.reset}`);
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
