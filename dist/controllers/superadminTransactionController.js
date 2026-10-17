"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVerificationStats = exports.getVerificationById = exports.getAllVerifications = void 0;
const models_1 = require("../models");
const getAllVerifications = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const status = req.query.status;
        const offset = (page - 1) * limit;
        const whereClause = {};
        if (status)
            whereClause.status = status;
        const { count, rows } = await models_1.TransactionVerification.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: models_1.User,
                    as: 'owner',
                    attributes: ['id', 'businessName', 'phone'],
                },
                {
                    model: models_1.ApiKey,
                    as: 'apiKey',
                    attributes: ['id', 'keyPrefix'],
                },
            ],
            order: [['apiRequestReceivedAt', 'DESC']],
            limit,
            offset,
        });
        res.json({ success: true, data: rows, total: count, page, limit });
    }
    catch (error) {
        console.error('Get all verifications error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getAllVerifications = getAllVerifications;
const getVerificationById = async (req, res) => {
    try {
        const { id } = req.params;
        const verification = await models_1.TransactionVerification.findByPk(id, {
            include: [
                {
                    model: models_1.User,
                    as: 'owner',
                    attributes: ['id', 'businessName', 'phone'],
                },
                {
                    model: models_1.ApiKey,
                    as: 'apiKey',
                    attributes: ['id', 'keyPrefix'],
                },
            ],
        });
        if (!verification) {
            res.status(404).json({ success: false, message: 'Verification not found' });
            return;
        }
        res.json({ success: true, data: verification });
    }
    catch (error) {
        console.error('Get verification by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getVerificationById = getVerificationById;
const getVerificationStats = async (req, res) => {
    try {
        const total = await models_1.TransactionVerification.count();
        const pending = await models_1.TransactionVerification.count({ where: { status: 'pending' } });
        const matched = await models_1.TransactionVerification.count({ where: { status: 'matched' } });
        const mismatched = await models_1.TransactionVerification.count({ where: { status: 'mismatched' } });
        const expired = await models_1.TransactionVerification.count({ where: { status: 'expired' } });
        res.json({
            success: true,
            stats: {
                total,
                pending,
                matched,
                mismatched,
                expired,
            },
        });
    }
    catch (error) {
        console.error('Get verification stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getVerificationStats = getVerificationStats;
