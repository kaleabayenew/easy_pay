import { Router } from 'express';
import { login, register, changePin, createOwner, checkUserExists, checkDeviceExists } from '../controllers/authController';
import { requestOtp, verifyOtp } from '../controllers/otpController';
import { receiveSms, getSmsLogs, retrySms, deleteSms } from '../controllers/smsController';
import { heartbeat, getDeviceStatus, listDevices, deactivateDevice, registerDevice } from '../controllers/deviceController';
import { verifyTransaction, getVerificationStatus } from '../controllers/transactionController';
import { authenticate, verifyHmac, requireAdmin } from '../middleware/auth';
import { loginRateLimit, smsRateLimit } from '../middleware/rateLimit';

import superadminRoutes from './superadminRoutes';
import creditRoutes from './creditRoutes';

const router = Router();

// Superadmin routes
router.use('/superadmin', superadminRoutes);

// Credit routes (no prefix, server.ts adds /api/v1)
router.use(creditRoutes);

// Auth & OTP routes
router.post('/auth/login', loginRateLimit, login);
router.post('/auth/register', register);
router.post('/auth/change-pin', authenticate, changePin);
router.post('/auth/create-owner', authenticate, requireAdmin, createOwner);
router.post('/auth/check-user', checkUserExists);
router.post('/auth/check-device', checkDeviceExists);
router.post('/auth/request-otp', requestOtp);
router.post('/auth/verify-otp', verifyOtp);

// SMS routes
router.post('/sms', verifyHmac, authenticate, smsRateLimit, receiveSms);
router.get('/sms/logs/:deviceId', authenticate, getSmsLogs);
router.post('/sms/:id/retry', authenticate, retrySms);
router.delete('/sms/:id', authenticate, deleteSms);

// Device / heartbeat routes
router.post('/heartbeat', verifyHmac, heartbeat);
router.post('/device/register', authenticate, registerDevice);
router.get('/devices', authenticate, listDevices);
router.get('/devices/:deviceId', authenticate, getDeviceStatus);
router.post('/devices/:deviceId/deactivate', authenticate, verifyHmac, deactivateDevice);

// Transaction verification routes (public with API key)
router.post('/verify-transaction', verifyTransaction);
router.get('/verify-transaction/:verificationId', getVerificationStatus);

export default router;
