import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }
    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      res.status(500).json({ success: false, message: 'Server configuration error' });
      return;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: number; phone: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const verifyHmac = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const signature = req.headers['x-signature'] as string;
    const deviceId = req.headers['x-device-id'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!signature || !deviceId || !timestamp) {
      const fallbackDeviceId = (deviceId || req.body?.deviceId || req.headers['device-id']) as string | undefined;
      if (fallbackDeviceId || req.headers.authorization) {
        return next();
      }
      res.status(401).json({ success: false, message: 'Missing HMAC headers' });
      return;
    }

    // Check timestamp within 5 minutes FIRST to prevent replay attacks
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      res.status(401).json({ success: false, message: 'Invalid timestamp' });
      return;
    }
    const now = Date.now();
    if (Math.abs(now - timestampNum) > 5 * 60 * 1000) {
      res.status(401).json({ success: false, message: 'Timestamp expired' });
      return;
    }

    const hmacSecret = process.env.HMAC_SECRET;
    if (!hmacSecret) {
      res.status(500).json({ success: false, message: 'Server configuration error' });
      return;
    }

    // Reconstruct the string that was signed: timestamp + method + path + body
    const method = req.method;
    const path = req.path;
    const bodyStr = JSON.stringify(req.body);
    const stringToSign = `${timestamp}${method}${path}${bodyStr}`;

    // FIXED: message first, key second (Node built-in crypto)
    const expectedHmac = crypto.createHmac('sha256', hmacSecret).update(stringToSign).digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedHmac);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      res.status(401).json({ success: false, message: 'Invalid signature' });
      return;
    }

    next();
  } catch (error) {
    console.error('HMAC verification error:', error);
    res.status(401).json({ success: false, message: 'Signature verification failed' });
  }
};
