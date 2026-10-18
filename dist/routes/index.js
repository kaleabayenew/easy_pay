"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const otpController_1 = require("../controllers/otpController");
const smsController_1 = require("../controllers/smsController");
const deviceController_1 = require("../controllers/deviceController");
const transactionController_1 = require("../controllers/transactionController");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const superadminRoutes_1 = __importDefault(require("./superadminRoutes"));
const creditRoutes_1 = __importDefault(require("./creditRoutes"));
const router = (0, express_1.Router)();
// Superadmin routes
router.use('/superadmin', superadminRoutes_1.default);
// Credit routes
router.use('/api/v1', creditRoutes_1.default);
// Auth & OTP routes
router.post('/auth/login', rateLimit_1.loginRateLimit, authController_1.login);
router.post('/auth/register', authController_1.register);
router.post('/auth/change-pin', auth_1.authenticate, authController_1.changePin);
router.post('/auth/create-owner', auth_1.authenticate, auth_1.requireAdmin, authController_1.createOwner);
router.post('/auth/check-user', authController_1.checkUserExists);
router.post('/auth/check-device', authController_1.checkDeviceExists);
router.post('/auth/request-otp', otpController_1.requestOtp);
router.post('/auth/verify-otp', otpController_1.verifyOtp);
// SMS routes
router.post('/sms', auth_1.verifyHmac, auth_1.authenticate, rateLimit_1.smsRateLimit, smsController_1.receiveSms);
router.get('/sms/logs/:deviceId', auth_1.authenticate, smsController_1.getSmsLogs);
router.post('/sms/:id/retry', auth_1.authenticate, smsController_1.retrySms);
router.delete('/sms/:id', auth_1.authenticate, smsController_1.deleteSms);
// Device / heartbeat routes
router.post('/heartbeat', auth_1.verifyHmac, deviceController_1.heartbeat);
router.post('/device/register', auth_1.authenticate, deviceController_1.registerDevice);
router.get('/devices', auth_1.authenticate, deviceController_1.listDevices);
router.get('/devices/:deviceId', auth_1.authenticate, deviceController_1.getDeviceStatus);
router.post('/devices/:deviceId/deactivate', auth_1.authenticate, auth_1.verifyHmac, deviceController_1.deactivateDevice);
// Transaction verification routes (public with API key)
router.post('/verify-transaction', transactionController_1.verifyTransaction);
router.get('/verify-transaction/:verificationId', transactionController_1.getVerificationStatus);
exports.default = router;
