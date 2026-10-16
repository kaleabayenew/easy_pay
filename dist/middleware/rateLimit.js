"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsRateLimit = exports.loginRateLimit = void 0;
const createRateLimiter = (maxRequests, windowMs) => {
    const store = new Map();
    // Clean up expired entries every windowMs
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            if (now > entry.resetAt)
                store.delete(key);
        }
    }, windowMs);
    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.socket.remoteAddress ||
            'unknown';
        const now = Date.now();
        const entry = store.get(ip);
        if (!entry || now > entry.resetAt) {
            store.set(ip, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }
        if (entry.count >= maxRequests) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            res.status(429).json({ success: false, message: 'Too many requests, please try again later' });
            return;
        }
        entry.count += 1;
        next();
    };
};
// Login: max 5 attempts per 15 minutes per IP
exports.loginRateLimit = createRateLimiter(parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10), parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10));
// SMS: max 60 requests per minute per device
exports.smsRateLimit = createRateLimiter(60, 60 * 1000);
