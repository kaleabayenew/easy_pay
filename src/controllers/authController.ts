import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Device } from '../models';

const PHONE_REGEX = /^\+251[79]\d{8}$/;
const PIN_REGEX = /^\d{4}$/;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

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
      attributes: ['id', 'phone', 'pin', 'role', 'isActive'],
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
