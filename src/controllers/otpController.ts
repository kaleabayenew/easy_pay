import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Device, User } from '../models';

export interface OtpRecord {
  id: string;
  phone: string;
  deviceId: string;
  ownerName: string;
  otpCode: string;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'verified' | 'expired' | 'blocked';
  createdAt: string;
  expiresAt: string;
}

export interface BlockedRecord {
  id: string;
  targetType: 'phone' | 'device' | 'user';
  identifier: string;
  ownerName: string;
  reason: string;
  attempts: number;
  blockedAt: string;
  expiresAt: string; // ISO string
  ipAddress: string;
  status: 'active' | 'unblocked';
}

// In-memory persistent stores
export const otpRequestsStore: OtpRecord[] = [
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

export const blockedStore: BlockedRecord[] = [
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

export const isIdentifierBlocked = (identifier: string): BlockedRecord | null => {
  const now = Date.now();
  const entry = blockedStore.find(
    (b) => b.identifier === identifier && b.status === 'active'
  );
  if (!entry) return null;

  // Check if 15-minute cooldown has expired
  if (new Date(entry.expiresAt).getTime() <= now) {
    entry.status = 'unblocked';
    return null;
  }
  return entry;
};

// ─── Device First-time Request OTP ──────────────────────────────

export const requestOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, deviceId, ownerName } = req.body;

    if (!phone || !deviceId) {
      res.status(400).json({
        success: false,
        message: 'Phone number and deviceId are required',
      });
      return;
    }

    const cleanPhone = phone.trim();
    const cleanDeviceId = deviceId.trim();

    // Check if phone or device is blocked
    const phoneBlocked = isIdentifierBlocked(cleanPhone);
    const deviceBlocked = isIdentifierBlocked(cleanDeviceId);
    const blockedRecord = phoneBlocked || deviceBlocked;

    if (blockedRecord) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000)
      );
      res.status(403).json({
        success: false,
        is_blocked: true,
        reason: blockedRecord.reason,
        blocked_until: blockedRecord.expiresAt,
        message: `Device is temporarily blocked. Please wait ${remainingMinutes} minute(s) or ask your Super Admin to unblock you.`,
      });
      return;
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes expiry

    // Invalidate existing pending OTP for this device/phone
    for (const r of otpRequestsStore) {
      if ((r.phone === cleanPhone || r.deviceId === cleanDeviceId) && r.status === 'pending') {
        r.status = 'expired';
      }
    }

    const newRecord: OtpRecord = {
      id: `otp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      phone: cleanPhone,
      deviceId: cleanDeviceId,
      ownerName: ownerName || 'Betting Partner',
      otpCode: code,
      attempts: 0,
      maxAttempts: 5,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    otpRequestsStore.unshift(newRecord);
    if (otpRequestsStore.length > 200) otpRequestsStore.pop();

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
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Verify OTP ──────────────────────────────────────────────────

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
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
    const blockedRecord = isIdentifierBlocked(cleanPhone) || isIdentifierBlocked(cleanDeviceId);
    if (blockedRecord) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000)
      );
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
    const otpRecord = otpRequestsStore.find(
      (r) =>
        (r.phone === cleanPhone || r.deviceId === cleanDeviceId) &&
        r.status === 'pending'
    );

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
        blockedStore.unshift({
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
          message:
            'You have exceeded the maximum OTP attempts (5/5). Your device is locked for 15 minutes. Contact your Super Admin to unblock.',
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
    const [device] = await Device.findOrCreate({
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
    const token = jwt.sign(
      { deviceId: cleanDeviceId, phone: cleanPhone, role: 'device_user' },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Device successfully authenticated and activated by Super Admin approval.',
      token,
      device_id: cleanDeviceId,
      phone: cleanPhone,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
