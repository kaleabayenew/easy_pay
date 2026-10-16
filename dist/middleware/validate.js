"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const validateBody = (fields) => {
    return (req, res, next) => {
        const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
        if (missing.length > 0) {
            res.status(400).json({ success: false, message: `Missing fields: ${missing.join(', ')}` });
            return;
        }
        next();
    };
};
exports.validateBody = validateBody;
