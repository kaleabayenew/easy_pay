import { Router } from 'express';
import { login, register, changePin } from '../controllers/authController';
import { receiveSms, getSmsLogs, retrySms, deleteSms } from '../controllers/smsController';
import { heartbeat, getDeviceStatus, listDevices, deactivateDevice } from '../controllers/deviceController';
import { authenticate, verifyHmac } from '../middleware/auth';
import { loginRateLimit, smsRateLimit } from '../middleware/rateLimit';

const router = Router();

// Auth routes
router.post('/auth/login', loginRateLimit, login);
router.post('/auth/register', register);
router.post('/auth/change-pin', authenticate, changePin);

// SMS routes
router.post('/sms', verifyHmac, authenticate, smsRateLimit, receiveSms);
router.get('/sms/logs/:deviceId', authenticate, getSmsLogs);
router.post('/sms/:id/retry', authenticate, retrySms);
router.delete('/sms/:id', authenticate, deleteSms);

// Device / heartbeat routes
router.post('/heartbeat', verifyHmac, heartbeat);
router.get('/devices', authenticate, listDevices);
router.get('/devices/:deviceId', authenticate, getDeviceStatus);
router.post('/devices/:deviceId/deactivate', authenticate, verifyHmac, deactivateDevice);

export default router;
