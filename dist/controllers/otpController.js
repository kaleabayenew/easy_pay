"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtp = exports.requestOtp = exports.isIdentifierBlocked = exports.blockedStore = exports.otpRequestsStore = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const superadminController_1 = require("./superadminController");
// In-memory persistent stores
exports.otpRequestsStore = [
    {
        id: 'otp_demo_1',
        phone: '+251911223344',
        deviceId: 'easypay_dev_01',
        ownerName: 'Betting Partner A',
        otpCode: '849201',
        attempts: 0,
        maxAttempts: 5,
        status: 'pending',
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 13 * 60 * 1000).toISOString(),
    },
];
exports.blockedStore = [
    {
        id: 'blk_demo_1',
        targetType: 'phone',
        identifier: '+251922334455',
        ownerName: 'Betting Partner C',
        reason: 'Exceeded maximum OTP verification attempts (5/5)',
        attempts: 5,
        blockedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        ipAddress: '196.188.12.44',
        status: 'active',
    },
];
const isIdentifierBlocked = (identifier) => {
    const now = Date.now();
    const entry = exports.blockedStore.find((b) => b.identifier === identifier && b.status === 'active');
    if (!entry)
        return null;
    // Check if 15-minute cooldown has expired
    if (new Date(entry.expiresAt).getTime() <= now) {
        entry.status = 'unblocked';
        return null;
    }
    return entry;
};
exports.isIdentifierBlocked = isIdentifierBlocked;
// ─── Device First-time Request OTP ──────────────────────────────
const requestOtp = async (req, res) => {
    try {
        const rawPhone = req.body.phone || req.body.identifier;
        const rawPin = req.body.pin;
        const rawDeviceId = req.body.deviceId ||
            (rawPhone ? `easypay_dev_${String(rawPhone).replace(/\D/g, '')}` : 'easypay_dev_unknown');
        if (!rawPhone) {
            res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
            return;
        }
        // Normalize phone number to +251... format
        let cleanPhone = String(rawPhone).trim().replace(/\s+/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '+251' + cleanPhone.substring(1);
        }
        else if (cleanPhone.startsWith('251')) {
            cleanPhone = '+' + cleanPhone;
        }
        else if (cleanPhone.startsWith('9') || cleanPhone.startsWith('7')) {
            cleanPhone = '+251' + cleanPhone;
        }
        const cleanDeviceId = String(rawDeviceId).trim();
        // Check if phone or device is blocked
        const phoneBlocked = (0, exports.isIdentifierBlocked)(cleanPhone);
        const deviceBlocked = (0, exports.isIdentifierBlocked)(cleanDeviceId);
        const blockedRecord = phoneBlocked || deviceBlocked;
        if (blockedRecord) {
            const remainingMinutes = Math.max(1, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000));
            res.status(403).json({
                success: false,
                is_blocked: true,
                reason: blockedRecord.reason,
                blocked_until: blockedRecord.expiresAt,
                message: `Device is temporarily blocked. Please wait ${remainingMinutes} minute(s) or ask your Super Admin to unblock you.`,
            });
            return;
        }
        // Query registered owner from Database User table or ownersStore
        let registeredOwner = null;
        try {
            const dbUser = await models_1.User.findOne({ where: { phone: cleanPhone } });
            if (dbUser) {
                registeredOwner = {
                    name: dbUser.name || `Partner (${dbUser.phone})`,
                    phone: dbUser.phone,
                    pin: dbUser.pin,
                };
            }
        }
        catch (_) { }
        if (!registeredOwner) {
            const inMemory = superadminController_1.ownersStore.find((o) => o.phone === cleanPhone || o.phone.endsWith(cleanPhone.slice(-9)));
            if (inMemory) {
                registeredOwner = {
                    name: inMemory.name,
                    phone: inMemory.phone,
                    pin: inMemory.pin,
                };
            }
        }
        // Check if phone is registered in system
        if (!registeredOwner) {
            res.status(404).json({
                success: false,
                error: 'NOT_REGISTERED',
                message: `Phone number ${cleanPhone} is not registered in the database. Super Admin must create an Owner account with this phone number first.`,
            });
            return;
        }
        // Validate PIN if provided from SMS Monitor
        if (rawPin !== undefined && rawPin !== null && String(rawPin).trim().length > 0) {
            const cleanPin = String(rawPin).trim();
            if (cleanPin !== registeredOwner.pin) {
                res.status(400).json({
                    success: false,
                    error: 'INVALID_PIN',
                    message: 'Incorrect terminal PIN for this registered owner phone number.',
                });
                return;
            }
        }
        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes expiry
        // Invalidate existing pending OTP for this device/phone
        for (const r of exports.otpRequestsStore) {
            if ((r.phone === cleanPhone || r.deviceId === cleanDeviceId) && r.status === 'pending') {
                r.status = 'expired';
            }
        }
        const newRecord = {
            id: `otp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            phone: cleanPhone,
            deviceId: cleanDeviceId,
            ownerName: registeredOwner.name,
            otpCode: code,
            attempts: 0,
            maxAttempts: 5,
            status: 'pending',
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        exports.otpRequestsStore.unshift(newRecord);
        if (exports.otpRequestsStore.length > 200)
            exports.otpRequestsStore.pop();
        res.json({
            success: true,
            message: 'OTP requested successfully and dispatched to Super Admin for approval.',
            phone: cleanPhone,
            device_id: cleanDeviceId,
            expires_at: expiresAt.toISOString(),
            expires_in_seconds: 900,
            // For testing/debug if in dev mode
            debug_otp_hint: process.env.NODE_ENV !== 'production' ? code : undefined,
        });
    }
    catch (error) {
        console.error('Request OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.requestOtp = requestOtp;
// ─── Verify OTP ──────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
    try {
        const { phone, deviceId, otpCode } = req.body;
        if (!phone || !deviceId || !otpCode) {
            res.status(400).json({
                success: false,
                message: 'Phone, deviceId, and 6-digit OTP code are required',
            });
            return;
        }
        const cleanPhone = phone.trim();
        const cleanDeviceId = deviceId.trim();
        const cleanCode = otpCode.trim();
        // Check if blocked
        const blockedRecord = (0, exports.isIdentifierBlocked)(cleanPhone) || (0, exports.isIdentifierBlocked)(cleanDeviceId);
        if (blockedRecord) {
            const remainingMinutes = Math.max(1, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000));
            res.status(403).json({
                success: false,
                is_blocked: true,
                reason: blockedRecord.reason,
                blocked_until: blockedRecord.expiresAt,
                message: `Device is temporarily blocked. Please wait ${remainingMinutes} minute(s) or ask your Super Admin to unblock you.`,
            });
            return;
        }
        // Find latest pending OTP
        const otpRecord = exports.otpRequestsStore.find((r) => (r.phone === cleanPhone || r.deviceId === cleanDeviceId) &&
            r.status === 'pending');
        if (!otpRecord) {
            res.status(404).json({
                success: false,
                message: 'No pending OTP request found. Please request an OTP first.',
            });
            return;
        }
        // Check expiry
        if (new Date(otpRecord.expiresAt).getTime() <= Date.now()) {
            otpRecord.status = 'expired';
            res.status(400).json({
                success: false,
                message: 'OTP has expired (15-minute window passed). Please request a new code.',
            });
            return;
        }
        // Verify matching code
        if (otpRecord.otpCode !== cleanCode) {
            otpRecord.attempts += 1;
            const remaining = otpRecord.maxAttempts - otpRecord.attempts;
            if (remaining <= 0) {
                otpRecord.status = 'blocked';
                // Add to blocked store for 15 minutes
                const blockedAt = new Date();
                const expiresAt = new Date(blockedAt.getTime() + 15 * 60 * 1000);
                exports.blockedStore.unshift({
                    id: `blk_${Date.now()}`,
                    targetType: 'device',
                    identifier: cleanDeviceId,
                    ownerName: otpRecord.ownerName,
                    reason: 'Exceeded maximum OTP verification attempts (5/5)',
                    attempts: 5,
                    blockedAt: blockedAt.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    ipAddress: req.ip || '127.0.0.1',
                    status: 'active',
                });
                res.status(403).json({
                    success: false,
                    is_blocked: true,
                    reason: 'Exceeded maximum OTP attempts',
                    blocked_until: expiresAt.toISOString(),
                    message: 'You have exceeded the maximum OTP attempts (5/5). Your device is locked for 15 minutes. Contact your Super Admin to unblock.',
                });
                return;
            }
            res.status(400).json({
                success: false,
                attempts_left: remaining,
                message: `Incorrect OTP code. You have ${remaining} attempt(s) remaining before a 15-minute lockout.`,
            });
            return;
        }
        // OTP is valid!
        otpRecord.status = 'verified';
        // Register or activate device in DB
        const [device] = await models_1.Device.findOrCreate({
            where: { deviceId: cleanDeviceId },
            defaults: {
                deviceId: cleanDeviceId,
                phoneNumber: cleanPhone,
                registeredAt: new Date(),
                lastHeartbeat: new Date(),
                isActive: true,
                isRooted: false,
            },
        });
        await device.update({ isActive: true, lastHeartbeat: new Date(), phoneNumber: cleanPhone });
        const jwtSecret = process.env.JWT_SECRET || 'superadmin_dev_jwt_secret_key';
        const token = jsonwebtoken_1.default.sign({ deviceId: cleanDeviceId, phone: cleanPhone, role: 'device_user' }, jwtSecret, { expiresIn: '30d' });
        res.json({
            success: true,
            message: 'Device successfully authenticated and activated by Super Admin approval.',
            token,
            device_id: cleanDeviceId,
            phone: cleanPhone,
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.verifyOtp = verifyOtp;
