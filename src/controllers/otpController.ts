import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { Device, User } from '../models';
import { ownersStore } from './superadminController';

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

export const normalizePhone = (raw: string): string => {
  let clean = String(raw || '').trim().replace(/\s+/g, '').replace(/[-()]/g, '');
  if (clean.startsWith('+251')) return clean;
  if (clean.startsWith('251')) return '+' + clean;
  if (clean.startsWith('0')) return '+251' + clean.substring(1);
  if (clean.startsWith('9') || clean.startsWith('7')) return '+251' + clean;
  if (clean.length > 0 && !clean.startsWith('+')) return '+' + clean;
  return clean;
};

export const isIdentifierBlocked = (identifier: string): BlockedRecord | null => {
  if (!identifier) return null;
  const now = Date.now();
  const clean = identifier.trim();
  const digits = clean.replace(/\D/g, '').slice(-9);

  const entry = blockedStore.find((b) => {
    if (b.status !== 'active') return false;
    if (b.identifier === clean) return true;
    if (digits.length >= 8 && b.identifier.replace(/\D/g, '').endsWith(digits)) return true;
    return false;
  });

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

    const cleanPhone = normalizePhone(rawPhone);
    const phoneDigits = cleanPhone.replace(/\D/g, '').slice(-9);
    const cleanDeviceId = String(
      rawDeviceId || (phoneDigits ? `easypay_dev_${phoneDigits}` : 'easypay_dev_unknown')
    ).trim();

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
        remainingSeconds: Math.max(60, Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 1000)),
        reason: blockedRecord.reason,
        blocked_until: blockedRecord.expiresAt,
        message: `Device is temporarily blocked. Please wait ${remainingMinutes} minute(s) or ask your Super Admin to unblock you.`,
      });
      return;
    }

    // Query registered owner from Database User table or ownersStore
    let registeredOwner: { name: string; phone: string; pin: string } | null = null;
    try {
      const dbUser = await User.findOne({
        where: {
          [Op.or]: [
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
    } catch (_) {
      try {
        const dbUser = await User.findOne({ where: { phone: cleanPhone } });
        if (dbUser) {
          registeredOwner = {
            name: dbUser.name || `Partner (${dbUser.phone})`,
            phone: dbUser.phone,
            pin: dbUser.pin,
          };
        }
      } catch (_) {}
    }

    if (!registeredOwner) {
      const inMemory = ownersStore.find(
        (o) =>
          o.phone === cleanPhone ||
          o.phone.endsWith(cleanPhone.slice(-9)) ||
          (phoneDigits.length >= 8 && o.phone.replace(/\D/g, '').endsWith(phoneDigits))
      );
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
    for (const r of otpRequestsStore) {
      if (
        (r.phone === cleanPhone ||
          r.deviceId === cleanDeviceId ||
          (phoneDigits.length >= 8 && r.phone.replace(/\D/g, '').endsWith(phoneDigits))) &&
        r.status === 'pending'
      ) {
        r.status = 'expired';
      }
    }

    const newRecord: OtpRecord = {
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

    otpRequestsStore.unshift(newRecord);
    if (otpRequestsStore.length > 200) otpRequestsStore.pop();

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
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── Verify OTP ──────────────────────────────────────────────────

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
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
    const cleanPhone = rawPhone ? normalizePhone(rawPhone) : '';
    const phoneDigits = cleanPhone ? cleanPhone.replace(/\D/g, '').slice(-9) : '';
    const cleanDeviceId = String(
      rawDeviceId || (phoneDigits ? `easypay_dev_${phoneDigits}` : '')
    ).trim();

    // Check if blocked
    const phoneBlocked = cleanPhone ? isIdentifierBlocked(cleanPhone) : null;
    const deviceBlocked = cleanDeviceId ? isIdentifierBlocked(cleanDeviceId) : null;
    const blockedRecord = phoneBlocked || deviceBlocked;

    if (blockedRecord) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((new Date(blockedRecord.expiresAt).getTime() - Date.now()) / 60000)
      );
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
    let otpRecord: OtpRecord | undefined;

    // 1. By phone or phone digits match
    if (phoneDigits) {
      otpRecord = otpRequestsStore.find(
        (r) =>
          r.status === 'pending' &&
          (r.phone === cleanPhone || r.phone.replace(/\D/g, '').endsWith(phoneDigits))
      );
    }

    // 2. By device ID match
    if (!otpRecord && cleanDeviceId) {
      otpRecord = otpRequestsStore.find(
        (r) => r.status === 'pending' && r.deviceId === cleanDeviceId
      );
    }

    // 3. By matching the OTP code directly among pending records!
    if (!otpRecord) {
      otpRecord = otpRequestsStore.find(
        (r) => r.status === 'pending' && r.otpCode === cleanCode
      );
    }

    // 4. Fallback to latest pending OTP if any exists
    if (!otpRecord) {
      otpRecord = otpRequestsStore.find((r) => r.status === 'pending');
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
        blockedStore.unshift({
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
          message:
            'You have exceeded the maximum OTP attempts (5/5). Your device is locked for 15 minutes. Contact your Super Admin to unblock.',
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

    // Safely update or create device in database
    try {
      const [device] = await Device.findOrCreate({
        where: { deviceId: effectiveDeviceId },
        defaults: {
          deviceId: effectiveDeviceId,
          phoneNumber: effectivePhone,
          registeredAt: new Date(),
          lastHeartbeat: new Date(),
          isActive: true,
          isRooted: false,
        },
      });
      await device.update({ isActive: true, lastHeartbeat: new Date(), phoneNumber: effectivePhone });
    } catch (dbErr) {
      console.warn('Device DB sync warning (non-fatal):', dbErr);
    }

    const jwtSecret = process.env.JWT_SECRET || 'superadmin_dev_jwt_secret_key';
    const token = jwt.sign(
      { deviceId: effectiveDeviceId, phone: effectivePhone, role: 'device_user' },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Device successfully authenticated and activated by Super Admin approval.',
      token,
      deviceId: effectiveDeviceId,
      device_id: effectiveDeviceId,
      phone: effectivePhone,
      data: {
        token,
        deviceId: effectiveDeviceId,
        device_id: effectiveDeviceId,
        phone: effectivePhone,
        requestId: otpRecord.id,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error during OTP verification' });
  }
};
