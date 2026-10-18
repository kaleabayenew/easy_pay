"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateStream = exports.requireAdmin = exports.verifyHmac = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const authenticate = (req, res, next) => {
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
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
const verifyHmac = (req, res, next) => {
    try {
        const signature = req.headers['x-signature'];
        const deviceId = req.headers['x-device-id'];
        const timestamp = req.headers['x-timestamp'];
        if (!signature || !deviceId || !timestamp) {
            const fallbackDeviceId = (deviceId || req.body?.deviceId || req.headers['device-id']);
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
        const expectedHmac = crypto_1.default.createHmac('sha256', hmacSecret).update(stringToSign).digest('hex');
        // Constant-time comparison to prevent timing attacks
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedHmac);
        if (sigBuffer.length !== expectedBuffer.length || !crypto_1.default.timingSafeEqual(sigBuffer, expectedBuffer)) {
            res.status(401).json({ success: false, message: 'Invalid signature' });
            return;
        }
        next();
    }
    catch (error) {
        console.error('HMAC verification error:', error);
        res.status(401).json({ success: false, message: 'Signature verification failed' });
    }
};
exports.verifyHmac = verifyHmac;
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ success: false, message: 'Admin access required' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
const authenticateStream = (req, res, next) => {
    try {
        let token;
        // Try Authorization header first
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        // Fallback to query param for EventSource (can't send headers)
        if (!token && req.query.token) {
            token = req.query.token;
        }
        if (!token) {
            res.status(401).json({ success: false, message: 'No token provided' });
            return;
        }
        if (!process.env.JWT_SECRET) {
            res.status(500).json({ success: false, message: 'Server configuration error' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
};
exports.authenticateStream = authenticateStream;
