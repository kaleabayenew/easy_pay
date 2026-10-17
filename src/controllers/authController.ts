import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Device, ApiKey } from '../models';

const PHONE_REGEX = /^\+251[79]\d{8}$/;
const PIN_REGEX = /^\d{4}$/;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// Helper function to generate API key
const generateApiKey = (): { apiKey: string; keyPrefix: string } => {
  const keyPrefix = 'easypay_';
  const randomPart = crypto.randomBytes(24).toString('hex');
  const apiKey = `${keyPrefix}${randomPart}`;
  return { apiKey, keyPrefix };
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, pin, deviceId } = req.body as { phone: string; pin: string; deviceId?: string };

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

    const user = await User.findOne({
      where: { phone, isActive: true },
      attributes: ['id', 'phone', 'pin', 'role', 'isActive', 'businessName'],
    });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isPinValid = await bcrypt.compare(pin, user.pin);
    if (!isPinValid) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    if (!process.env.JWT_SECRET) {
      res.status(500).json({ success: false, message: 'Server configuration error' });
      return;
    }

    // Upsert device
    if (deviceId) {
      const [device, created] = await Device.findOrCreate({
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
        } else {
          await device.update({ lastHeartbeat: new Date() });
        }
      }
    }

    const expiresInSeconds = 7 * 24 * 60 * 60;
    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: expiresInSeconds }
    );

    res.json({
      success: true,
      token,
      deviceId: deviceId || null,
      phone: user.phone,
      user: { businessName: user.businessName || null },
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, pin } = req.body as { phone: string; pin: string };

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

    const existing = await User.findOne({ where: { phone } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Phone number already registered' });
      return;
    }

    const hashedPin = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await User.create({ phone, pin: hashedPin, role: 'device_user', isActive: true });

    res.status(201).json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const changePin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPin, newPin } = req.body as { currentPin: string; newPin: string };

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

    const user = await User.findByPk(userId, { attributes: ['id', 'pin'] });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isCurrentValid = await bcrypt.compare(currentPin, user.pin);
    if (!isCurrentValid) {
      res.status(401).json({ success: false, message: 'Current PIN is incorrect' });
      return;
    }

    const hashedNewPin = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
    await user.update({ pin: hashedNewPin });

    res.json({ success: true, message: 'PIN updated' });
  } catch (error) {
    console.error('Change PIN error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createOwner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessName, phone, password, pin, credit } = req.body as {
      businessName: string;
      phone: string;
      password: string;
      pin: string;
      credit: string;
    };

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

    const existing = await User.findOne({ where: { phone } });
    if (existing) {
      res.status(400).json({ success: false, message: 'Phone number already registered' });
      return;
    }

    const hashedPin = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const owner = await User.create({
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
    await ApiKey.create({
      ownerId: owner.id,
      apiKey,
      keyPrefix,
      isActive: true,
    });

    res.status(201).json({ 
      success: true, 
      message: 'Owner created successfully',
      apiKey, // Return API key only once during creation
      keyPrefix,
    });
  } catch (error) {
    console.error('Create owner error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const checkDeviceExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.body as { deviceId?: string };

    if (!deviceId) {
      res.status(400).json({ success: false, message: 'Device ID is required' });
      return;
    }

    const device = await Device.findOne({
      where: { deviceId },
      attributes: ['deviceId', 'userId', 'isActive'],
    });

    if (!device) {
      res.json({ success: true, exists: false, message: 'Device not found' });
      return;
    }

    // Get user info if device exists
    const user = await User.findOne({
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
  } catch (error) {
    console.error('Check device exists error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const checkUserExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, deviceId } = req.body as { phone: string; deviceId?: string };

    if (!phone || !PHONE_REGEX.test(phone)) {
      res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
      return;
    }

    const user = await User.findOne({
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
      const device = await Device.findOne({
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
  } catch (error) {
    console.error('Check user exists error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
