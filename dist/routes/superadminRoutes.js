"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const superadminController_1 = require("../controllers/superadminController");
const router = (0, express_1.Router)();
// Auth routes (public login + session verify)
router.post('/login', superadminController_1.superadminLogin);
router.get('/verify-session', superadminController_1.verifySession);
// Protected routes (accepts both dev mock tokens and valid JWT tokens)
router.get('/dashboard', superadminController_1.getDashboard);
// OTP Live Requests (For Superadmin to view & tell to user)
router.get('/otp-requests', superadminController_1.getOtpRequests);
router.post('/otp-requests/:id/resend', superadminController_1.resendOtpRequest);
// Blocked Management (15m cooldown & unblock)
router.get('/blocked', superadminController_1.getBlockedList);
router.post('/blocked/:id/unblock', superadminController_1.unblockEntity);
router.post('/blocked', superadminController_1.blockEntity);
// Analysis (SMS Completed vs Failed API Breakdown)
router.get('/analysis/sms', superadminController_1.getSmsAnalysis);
// Owners
router.get('/owners', superadminController_1.getOwners);
router.post('/owners', superadminController_1.createOwner);
router.post('/owners/:id/suspend', superadminController_1.suspendOwner);
router.post('/owners/:id/reactivate', superadminController_1.reactivateOwner);
// Devices
router.get('/devices', superadminController_1.getDevices);
router.get('/devices/:id', superadminController_1.getDeviceDetail);
router.post('/devices/:id/revoke', superadminController_1.revokeDevice);
router.post('/devices/:id/wipe', superadminController_1.wipeDevice);
// Whitelist
router.get('/whitelist', superadminController_1.getWhitelist);
router.post('/whitelist', superadminController_1.addWhitelist);
router.put('/whitelist/:id', superadminController_1.updateWhitelist);
router.delete('/whitelist/:id', superadminController_1.deleteWhitelist);
// Limits
router.get('/limits', superadminController_1.getLimits);
router.put('/limits', superadminController_1.updateLimits);
// Audit Log
router.get('/audit-log', superadminController_1.getAuditLog);
// Reports
router.get('/reports', superadminController_1.getReports);
// Settings
router.get('/settings/profile', superadminController_1.getProfile);
router.get('/settings/sessions', superadminController_1.getSessions);
router.delete('/settings/sessions/:id', superadminController_1.revokeSession);
router.get('/settings/notifications', superadminController_1.getNotifications);
router.put('/settings/notifications', superadminController_1.updateNotifications);
exports.default = router;
