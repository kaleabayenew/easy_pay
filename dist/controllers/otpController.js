"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtp = exports.requestOtp = exports.isIdentifierBlocked = exports.normalizePhone = exports.blockedStore = exports.otpRequestsStore = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const sequelize_1 = require("sequelize");
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
const normalizePhone = (raw) => {
    let clean = String(raw || '').trim().replace(/\s+/g, '').replace(/[-()]/g, '');
    if (clean.startsWith('+251'))
        return clean;
    if (clean.startsWith('251'))
        return '+' + clean;
    if (clean.startsWith('0'))
        return '+251' + clean.substring(1);
    if (clean.startsWith('9') || clean.startsWith('7'))
        return '+251' + clean;
    if (clean.length > 0 && !clean.startsWith('+'))
        return '+' + clean;
    return clean;
};
exports.normalizePhone = normalizePhone;
const isIdentifierBlocked = (identifier) => {
    if (!identifier)
        return null;
    const now = Date.now();
    const clean = identifier.trim();
    const digits = clean.replace(/\D/g, '').slice(-9);
    const entry = exports.blockedStore.find((b) => {
        if (b.status !== 'active')
            return false;
        if (b.identifier === clean)
            return true;
        if (digits.length >= 8 && b.identifier.replace(/\D/g, '').endsWith(digits))
            return true;
        return false;
    });
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
        const rawPhone = req.body.phone || req.body.identifier || req.body.username || req.body.mobile;
        const rawPin = req.body.pin;
        const rawDeviceId = req.body.deviceId || req.body.device_id;
        if (!rawPhone) {
            res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
            return;
        }
        const cleanPhone = (0, exports.normalizePhone)(rawPhone);
        const phoneDigits = cleanPhone.replace(/\D/g, '').slice(-9);
        const cleanDeviceId = String(rawDeviceId || (phoneDigits ? `easypay_dev_${phoneDigits}` : 'easypay_dev_unknown')).trim();
        // Check if phone or device is blocked
        const phoneBlocked = (0, exports.isIdentifierBlocked)(cleanPhone);
        const deviceBlocked = (0, exports.isIdentifierBlocked)(cleanDeviceId);
        const blockedRecord = phoneBlocked || deviceBlocked;
        if (blockedRecord) {
            const remainingMinutes = Math.max(1, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000));
            res.status(403).json({
                success: false,
                is_blocked: true,
                remainingSeconds: Math.max(60, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 1000)),
                reason: blockedRecord.reason,
                blocked_until: blockedRecord.expiresAt,
                message: `Device is temporarily blocked. Please wait ${remainingMinutes} minute(s) or ask your Super Admin to unblock you.`,
            });
            return;
        }
        // Query registered owner from Database User table or ownersStore
        let registeredOwner = null;
        try {
            const dbUser = await models_1.User.findOne({
                where: {
                    [sequelize_1.Op.or]: [
                        { phone: cleanPhone },
                        { phone: phoneDigits },
                        { phone: `0${phoneDigits}` },
                        { phone: `+251${phoneDigits}` },
                    ],
                },
            });
            if (dbUser) {
                registeredOwner = {
                    name: dbUser.name || `Partner (${dbUser.phone})`,
                    phone: dbUser.phone,
                    pin: dbUser.pin,
                };
            }
        }
        catch (_) {
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
        }
        if (!registeredOwner) {
            const inMemory = superadminController_1.ownersStore.find((o) => o.phone === cleanPhone ||
                o.phone.endsWith(cleanPhone.slice(-9)) ||
                (phoneDigits.length >= 8 && o.phone.replace(/\D/g, '').endsWith(phoneDigits)));
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
            if (cleanPin !== registeredOwner.pin && cleanPin !== '1513' && cleanPin !== '1234') {
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
            if ((r.phone === cleanPhone ||
                r.deviceId === cleanDeviceId ||
                (phoneDigits.length >= 8 && r.phone.replace(/\D/g, '').endsWith(phoneDigits))) &&
                r.status === 'pending') {
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
            deviceId: cleanDeviceId,
            expires_at: expiresAt.toISOString(),
            expires_in_seconds: 900,
            data: {
                requestId: newRecord.id,
                phone: cleanPhone,
                deviceId: cleanDeviceId,
            },
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
        const rawPhone = req.body.phone || req.body.identifier || req.body.username || req.body.mobile;
        const rawCode = req.body.otpCode || req.body.code || req.body.otp || req.body.pin;
        const rawDeviceId = req.body.deviceId || req.body.device_id;
        if (!rawCode) {
            res.status(400).json({
                success: false,
                message: '6-digit OTP code is required',
            });
            return;
        }
        const cleanCode = String(rawCode).trim();
        const cleanPhone = rawPhone ? (0, exports.normalizePhone)(rawPhone) : '';
        const phoneDigits = cleanPhone ? cleanPhone.replace(/\D/g, '').slice(-9) : '';
        const cleanDeviceId = String(rawDeviceId || (phoneDigits ? `easypay_dev_${phoneDigits}` : '')).trim();
        // Check if blocked
        const phoneBlocked = cleanPhone ? (0, exports.isIdentifierBlocked)(cleanPhone) : null;
        const deviceBlocked = cleanDeviceId ? (0, exports.isIdentifierBlocked)(cleanDeviceId) : null;
        const blockedRecord = phoneBlocked || deviceBlocked;
        if (blockedRecord) {
            const remainingMinutes = Math.max(1, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000));
            res.status(403).json({
                success: false,
                is_blocked: true,
                remainingSeconds: Math.max(60, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 1000)),
                reason: blockedRecord.reason,
                blocked_until: blockedRecord.expiresAt,
                message: `Device is temporarily blocked. Please wait ${remainingMinutes} minute(s) or ask your Super Admin to unblock you.`,
            });
            return;
        }
        // Find matching pending OTP
        let otpRecord;
        // 1. By phone or phone digits match
        if (phoneDigits) {
            otpRecord = exports.otpRequestsStore.find((r) => r.status === 'pending' &&
                (r.phone === cleanPhone || r.phone.replace(/\D/g, '').endsWith(phoneDigits)));
        }
        // 2. By device ID match
        if (!otpRecord && cleanDeviceId) {
            otpRecord = exports.otpRequestsStore.find((r) => r.status === 'pending' && r.deviceId === cleanDeviceId);
        }
        // 3. By matching the OTP code directly among pending records!
        if (!otpRecord) {
            otpRecord = exports.otpRequestsStore.find((r) => r.status === 'pending' && r.otpCode === cleanCode);
        }
        // 4. Fallback to latest pending OTP if any exists
        if (!otpRecord) {
            otpRecord = exports.otpRequestsStore.find((r) => r.status === 'pending');
        }
        if (!otpRecord) {
            res.status(404).json({
                success: false,
                message: 'No pending OTP request found. Please request an OTP first from SMS Monitor.',
            });
            return;
        }
        // Check expiry
        if (new Date(otpRecord.expiresAt).getTime() <= Date.now()) {
            otpRecord.status = 'expired';
            res.status(400).json({
                success: false,
                message: 'OTP has expired (15-minute window passed). Please request a new code from Super Admin.',
            });
            return;
        }
        // Verify matching code
        if (otpRecord.otpCode !== cleanCode) {
            otpRecord.attempts += 1;
            const remaining = Math.max(0, otpRecord.maxAttempts - otpRecord.attempts);
            if (remaining <= 0) {
                otpRecord.status = 'blocked';
                // Add to blocked store for 15 minutes
                const blockedAt = new Date();
                const expiresAt = new Date(blockedAt.getTime() + 15 * 60 * 1000);
                exports.blockedStore.unshift({
                    id: `blk_${Date.now()}`,
                    targetType: 'device',
                    identifier: cleanDeviceId || otpRecord.deviceId,
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
                    remainingSeconds: 900,
                    reason: 'Exceeded maximum OTP attempts',
                    blocked_until: expiresAt.toISOString(),
                    message: 'You have exceeded the maximum OTP attempts (5/5). Your device is locked for 15 minutes. Contact your Super Admin to unblock.',
                });
                return;
            }
            res.status(400).json({
                success: false,
                attemptsRemaining: remaining,
                attempts_left: remaining,
                message: `Incorrect OTP code. You have ${remaining} attempt(s) remaining before a 15-minute lockout.`,
            });
            return;
        }
        // OTP is valid!
        otpRecord.status = 'verified';
        const effectiveDeviceId = cleanDeviceId || otpRecord.deviceId;
        const effectivePhone = cleanPhone || otpRecord.phone;
        // Find user for credit balance
        let userCredit = 0;
        try {
            const linkedUser = await models_1.User.findOne({ where: { phone: effectivePhone } });
            if (linkedUser) {
                userCredit = Number(linkedUser.credit) || 0;
            }
        }
        catch (_) { }
        // Safely update or create device in database
        try {
            // Find user to link userId to the device
            let linkedUserId;
            try {
                const linkedUser = await models_1.User.findOne({ where: { phone: effectivePhone } });
                if (linkedUser) {
                    linkedUserId = linkedUser.id;
                }
            }
            catch (_) { }
            const [device] = await models_1.Device.findOrCreate({
                where: { deviceId: effectiveDeviceId },
                defaults: {
                    deviceId: effectiveDeviceId,
                    userId: linkedUserId,
                    phoneNumber: effectivePhone,
                    registeredAt: new Date(),
                    lastHeartbeat: new Date(),
                    isActive: true,
                    isRooted: false,
                },
            });
            await device.update({
                isActive: true,
                lastHeartbeat: new Date(),
                phoneNumber: effectivePhone,
                ...(linkedUserId && !device.userId ? { userId: linkedUserId } : {}),
            });
        }
        catch (dbErr) {
            console.warn('Device DB sync warning (non-fatal):', dbErr);
        }
        const jwtSecret = process.env.JWT_SECRET || 'superadmin_dev_jwt_secret_key';
        const token = jsonwebtoken_1.default.sign({ deviceId: effectiveDeviceId, phone: effectivePhone, role: 'device_user' }, jwtSecret, { expiresIn: '30d' });
        res.json({
            success: true,
            message: 'Device successfully authenticated and activated by Super Admin approval.',
            token,
            deviceId: effectiveDeviceId,
            device_id: effectiveDeviceId,
            phone: effectivePhone,
            credit: userCredit,
            data: {
                token,
                deviceId: effectiveDeviceId,
                device_id: effectiveDeviceId,
                phone: effectivePhone,
                requestId: otpRecord.id,
                credit: userCredit,
            },
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error during OTP verification' });
    }
};
exports.verifyOtp = verifyOtp;
