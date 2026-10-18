"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserExists = exports.checkDeviceExists = exports.createOwner = exports.changePin = exports.register = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const PHONE_REGEX = /^\+251[79]\d{8}$/;
const PIN_REGEX = /^\d{4}$/;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
// Helper function to generate API key
const generateApiKey = () => {
    const keyPrefix = 'easypay_';
    const randomPart = crypto_1.default.randomBytes(24).toString('hex');
    const apiKey = `${keyPrefix}${randomPart}`;
    return { apiKey, keyPrefix };
};
const login = async (req, res) => {
    try {
        const { phone, pin, deviceId } = req.body;
        if (!phone || !PHONE_REGEX.test(phone)) {
            res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Must be +251 followed by 7 or 9 and 8 digits.',
            });
            return;
        }
        if (!pin || !PIN_REGEX.test(pin)) {
            res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
            return;
        }
        const user = await models_1.User.findOne({
            where: { phone, isActive: true },
            attributes: ['id', 'phone', 'pin', 'role', 'isActive', 'businessName', 'credit'],
        });
        if (!user) {
            // Check if user exists but is inactive
            const inactiveUser = await models_1.User.findOne({
                where: { phone },
                attributes: ['id', 'phone', 'isActive'],
            });
            if (inactiveUser) {
                res.status(401).json({ success: false, message: 'Account is inactive. Please contact support.' });
                return;
            }
            res.status(401).json({ success: false, message: 'Phone number not registered' });
            return;
        }
        let isPinValid = false;
        if (user.pin && (user.pin.startsWith('$2a$') || user.pin.startsWith('$2b$'))) {
            isPinValid = await bcrypt_1.default.compare(pin, user.pin);
            console.log('Login attempt (hashed PIN):', { phone, isPinValid });
        }
        else {
            isPinValid = (pin === user.pin);
            console.log('Login attempt (plaintext PIN):', { phone, isPinValid, hasPin: !!user.pin });
            if (isPinValid) {
                // Upgrade legacy plaintext pin to secure bcrypt hash
                try {
                    const hashed = await bcrypt_1.default.hash(pin, BCRYPT_ROUNDS);
                    await user.update({ pin: hashed });
                    console.log('PIN upgraded to bcrypt for user:', phone);
                }
                catch (e) {
                    console.error('Failed to auto-hash legacy PIN:', e);
                }
            }
        }
        if (!isPinValid) {
            console.log('Login failed: Invalid PIN for phone:', phone);
            res.status(401).json({ success: false, message: 'Invalid PIN' });
            return;
        }
        if (!process.env.JWT_SECRET) {
            res.status(500).json({ success: false, message: 'Server configuration error' });
            return;
        }
        // Upsert device
        if (deviceId) {
            const [device, created] = await models_1.Device.findOrCreate({
                where: { deviceId },
                defaults: {
                    deviceId,
                    userId: user.id,
                    registeredAt: new Date(),
                    lastHeartbeat: new Date(),
                    isActive: true,
                    isRooted: false,
                },
            });
            if (!created) {
                if (device.userId !== user.id) {
                    await device.update({ userId: user.id, lastHeartbeat: new Date() });
                }
                else {
                    await device.update({ lastHeartbeat: new Date() });
                }
            }
        }
        const expiresInSeconds = 7 * 24 * 60 * 60;
        const token = jsonwebtoken_1.default.sign({ userId: user.id, phone: user.phone, role: user.role }, process.env.JWT_SECRET, { expiresIn: expiresInSeconds });
        res.json({
            success: true,
            token,
            deviceId: deviceId || null,
            phone: user.phone,
            user: { businessName: user.businessName || null, credit: Number(user.credit) || 0 },
            expiresAt: Date.now() + expiresInSeconds * 1000,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.login = login;
const register = async (req, res) => {
    try {
        const { phone, pin } = req.body;
        if (!phone || !PHONE_REGEX.test(phone)) {
            res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Must be +251 followed by 7 or 9 and 8 digits.',
            });
            return;
        }
        if (!pin || !PIN_REGEX.test(pin)) {
            res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
            return;
        }
        const existing = await models_1.User.findOne({ where: { phone } });
        if (existing) {
            res.status(400).json({ success: false, message: 'Phone number already registered' });
            return;
        }
        const hashedPin = await bcrypt_1.default.hash(pin, BCRYPT_ROUNDS);
        await models_1.User.create({ phone, pin: hashedPin, role: 'device_user', isActive: true });
        res.status(201).json({ success: true, message: 'Registered successfully' });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.register = register;
const changePin = async (req, res) => {
    try {
        const { currentPin, newPin } = req.body;
        if (!currentPin || !PIN_REGEX.test(currentPin)) {
            res.status(400).json({ success: false, message: 'Current PIN must be exactly 4 digits' });
            return;
        }
        if (!newPin || !PIN_REGEX.test(newPin)) {
            res.status(400).json({ success: false, message: 'New PIN must be exactly 4 digits' });
            return;
        }
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const user = await models_1.User.findByPk(userId, { attributes: ['id', 'pin'] });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        let isCurrentValid = false;
        if (user.pin && (user.pin.startsWith('$2a$') || user.pin.startsWith('$2b$'))) {
            isCurrentValid = await bcrypt_1.default.compare(currentPin, user.pin);
        }
        else {
            isCurrentValid = (currentPin === user.pin);
        }
        if (!isCurrentValid) {
            res.status(401).json({ success: false, message: 'Current PIN is incorrect' });
            return;
        }
        const hashedNewPin = await bcrypt_1.default.hash(newPin, BCRYPT_ROUNDS);
        await user.update({ pin: hashedNewPin });
        res.json({ success: true, message: 'PIN updated' });
    }
    catch (error) {
        console.error('Change PIN error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.changePin = changePin;
const createOwner = async (req, res) => {
    try {
        const { businessName, phone, password, pin, credit } = req.body;
        if (!businessName || businessName.trim().length === 0) {
            res.status(400).json({ success: false, message: 'Business name is required' });
            return;
        }
        if (!phone || !PHONE_REGEX.test(phone)) {
            res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Must be +251 followed by 7 or 9 and 8 digits.',
            });
            return;
        }
        if (!password || password.length < 6) {
            res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
            return;
        }
        if (!pin || !PIN_REGEX.test(pin)) {
            res.status(400).json({ success: false, message: 'PIN must be exactly 4 digits' });
            return;
        }
        if (!credit || isNaN(parseFloat(credit))) {
            res.status(400).json({ success: false, message: 'Credit must be a valid number' });
            return;
        }
        const existing = await models_1.User.findOne({ where: { phone } });
        if (existing) {
            res.status(400).json({ success: false, message: 'Phone number already registered' });
            return;
        }
        const hashedPin = await bcrypt_1.default.hash(pin, BCRYPT_ROUNDS);
        const hashedPassword = await bcrypt_1.default.hash(password, BCRYPT_ROUNDS);
        const owner = await models_1.User.create({
            businessName: businessName.trim(),
            phone,
            password: hashedPassword,
            pin: hashedPin,
            credit: parseFloat(credit),
            role: 'owner',
            isActive: true,
        });
        // Generate API key for the new owner
        const { apiKey, keyPrefix } = generateApiKey();
        await models_1.ApiKey.create({
            ownerId: owner.id,
            apiKey,
            keyPrefix,
            isActive: true,
        });
        // Record initial credit transaction if credit > 0
        if (parseFloat(credit) > 0) {
            await models_1.CreditTransaction.create({
                ownerId: owner.id,
                type: 'initial',
                amount: parseFloat(credit),
                balanceBefore: 0,
                balanceAfter: parseFloat(credit),
                performedBy: 'admin',
            });
        }
        res.status(201).json({
            success: true,
            message: 'Owner created successfully',
            apiKey, // Return API key only once during creation
            keyPrefix,
        });
    }
    catch (error) {
        console.error('Create owner error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.createOwner = createOwner;
const checkDeviceExists = async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) {
            res.status(400).json({ success: false, message: 'Device ID is required' });
            return;
        }
        const device = await models_1.Device.findOne({
            where: { deviceId },
            attributes: ['deviceId', 'userId', 'isActive'],
        });
        if (!device) {
            res.json({ success: true, exists: false, message: 'Device not found' });
            return;
        }
        // Get user info if device exists
        const user = await models_1.User.findOne({
            where: { id: device.userId },
            attributes: ['id', 'phone', 'businessName'],
        });
        res.json({
            success: true,
            exists: true,
            device: {
                deviceId: device.deviceId,
                isActive: device.isActive,
                userId: device.userId,
            },
            user: user ? {
                id: user.id,
                phone: user.phone,
                businessName: user.businessName,
            } : null,
        });
    }
    catch (error) {
        console.error('Check device exists error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.checkDeviceExists = checkDeviceExists;
const checkUserExists = async (req, res) => {
    try {
        const { phone, deviceId } = req.body;
        if (!phone || !PHONE_REGEX.test(phone)) {
            res.status(400).json({
                success: false,
                message: 'Invalid phone number format.',
            });
            return;
        }
        const user = await models_1.User.findOne({
            where: { phone, isActive: true },
            attributes: ['id', 'phone', 'businessName'],
        });
        if (!user) {
            res.json({ success: true, exists: false, message: 'User not found' });
            return;
        }
        // Check if device is already registered to this user
        let deviceRegistered = false;
        if (deviceId) {
            const device = await models_1.Device.findOne({
                where: { deviceId, userId: user.id },
            });
            deviceRegistered = !!device;
        }
        res.json({
            success: true,
            exists: true,
            deviceRegistered,
            user: {
                id: user.id,
                phone: user.phone,
                businessName: user.businessName,
            },
        });
    }
    catch (error) {
        console.error('Check user exists error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.checkUserExists = checkUserExists;
