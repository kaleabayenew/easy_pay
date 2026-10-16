import { Router } from 'express';
import {
  superadminLogin,
  verifySession,
  getDashboard,
  getOwners,
  createOwner,
  suspendOwner,
  reactivateOwner,
  getDevices,
  getDeviceDetail,
  revokeDevice,
  wipeDevice,
  getWhitelist,
  addWhitelist,
  updateWhitelist,
  deleteWhitelist,
  getLimits,
  updateLimits,
  getAuditLog,
  getReports,
  getProfile,
  getSessions,
  revokeSession,
  getNotifications,
  updateNotifications,
  getOtpRequests,
  resendOtpRequest,
  getBlockedList,
  unblockEntity,
  blockEntity,
  getSmsAnalysis,
} from '../controllers/superadminController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Auth routes (public login + session verify)
router.post('/login', superadminLogin);
router.get('/verify-session', verifySession);

// Protected routes (accepts both dev mock tokens and valid JWT tokens)
router.get('/dashboard', getDashboard);

// OTP Live Requests (For Superadmin to view & tell to user)
router.get('/otp-requests', getOtpRequests);
router.post('/otp-requests/:id/resend', resendOtpRequest);

// Blocked Management (15m cooldown & unblock)
router.get('/blocked', getBlockedList);
router.post('/blocked/:id/unblock', unblockEntity);
router.post('/blocked', blockEntity);

// Analysis (SMS Completed vs Failed API Breakdown)
router.get('/analysis/sms', getSmsAnalysis);

// Owners
router.get('/owners', getOwners);
router.post('/owners', createOwner);
router.post('/owners/:id/suspend', suspendOwner);
router.post('/owners/:id/reactivate', reactivateOwner);

// Devices
router.get('/devices', getDevices);
router.get('/devices/:id', getDeviceDetail);
router.post('/devices/:id/revoke', revokeDevice);
router.post('/devices/:id/wipe', wipeDevice);

// Whitelist
router.get('/whitelist', getWhitelist);
router.post('/whitelist', addWhitelist);
router.put('/whitelist/:id', updateWhitelist);
router.delete('/whitelist/:id', deleteWhitelist);

// Limits
router.get('/limits', getLimits);
router.put('/limits', updateLimits);

// Audit Log
router.get('/audit-log', getAuditLog);

// Reports
router.get('/reports', getReports);

// Settings
router.get('/settings/profile', getProfile);
router.get('/settings/sessions', getSessions);
router.delete('/settings/sessions/:id', revokeSession);
router.get('/settings/notifications', getNotifications);
router.put('/settings/notifications', updateNotifications);

export default router;
