"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustOwnerCredit = adjustOwnerCredit;
exports.getOwnerCreditHistory = getOwnerCreditHistory;
exports.getOwnerCredit = getOwnerCredit;
exports.streamCreditUpdates = streamCreditUpdates;
exports.getMyCredit = getMyCredit;
exports.getMyCreditHistory = getMyCreditHistory;
exports.streamMyCreditUpdates = streamMyCreditUpdates;
const models_1 = require("../models");
const creditService_1 = require("../services/creditService");
const creditEvents_1 = require("../services/creditEvents");
const superadminController_1 = require("./superadminController");
async function adjustOwnerCredit(req, res) {
    try {
        const { id } = req.params;
        const { type, amount, reason } = req.body;
        const admin = req.user;
        if (!id) {
            res.status(400).json({ success: false, message: 'Owner ID is required' });
            return;
        }
        // Parse ID: handle both "12" and "own_12"
        const ownerIdStr = id.startsWith('own_') ? id.substring(4) : id;
        const ownerId = parseInt(ownerIdStr, 10);
        if (isNaN(ownerId)) {
            res.status(400).json({ success: false, message: 'Invalid owner ID' });
            return;
        }
        if (!type || !['add', 'subtract'].includes(type)) {
            res.status(400).json({ success: false, message: 'Type must be "add" or "subtract"' });
            return;
        }
        if (!amount || isNaN(parseFloat(amount))) {
            res.status(400).json({ success: false, message: 'Valid amount is required' });
            return;
        }
        const result = await (0, creditService_1.adjustCredit)({
            ownerId,
            type,
            amount: parseFloat(amount),
            reason,
            performedBy: admin?.username || 'admin',
        });
        // Get user for audit
        const user = await models_1.User.findByPk(ownerId);
        // Emit live event
        creditEvents_1.creditEventHub.emitCreditUpdate({
            ownerId,
            balance: result.balanceAfter,
            change: type === 'add' ? amount : -amount,
            type,
            reason,
            at: new Date().toISOString(),
        });
        // Log audit
        await (0, superadminController_1.logAudit)(admin?.username || 'admin', `credit_${type}`, ownerId.toString(), user?.name || 'Owner', reason || `${type} credit by admin`, (req.ip || '127.0.0.1'), { balance: result.balanceBefore }, { balance: result.balanceAfter });
        res.json({
            success: true,
            balanceBefore: result.balanceBefore,
            balanceAfter: result.balanceAfter,
            transaction: {
                id: result.transaction.id,
                type: result.transaction.type,
                amount: result.transaction.amount,
                balanceBefore: result.transaction.balanceBefore,
                balanceAfter: result.transaction.balanceAfter,
                reason: result.transaction.reason,
                performedBy: result.transaction.performedBy,
                createdAt: result.transaction.createdAt,
            },
        });
    }
    catch (error) {
        if (error instanceof creditService_1.CreditError) {
            res.status(error.httpStatus).json({ success: false, message: error.message });
        }
        else {
            console.error('Error adjusting owner credit:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
}
async function getOwnerCreditHistory(req, res) {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        // Parse ID
        const ownerIdStr = id.startsWith('own_') ? id.substring(4) : id;
        const ownerId = parseInt(ownerIdStr, 10);
        if (isNaN(ownerId)) {
            res.status(400).json({ success: false, message: 'Invalid owner ID' });
            return;
        }
        const { count, rows } = await models_1.CreditTransaction.findAndCountAll({
            where: { ownerId },
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit,
        });
        res.json({
            success: true,
            items: rows.map((t) => ({
                id: t.id,
                type: t.type,
                amount: Number(t.amount),
                balanceBefore: Number(t.balanceBefore),
                balanceAfter: Number(t.balanceAfter),
                reason: t.reason,
                performedBy: t.performedBy,
                createdAt: t.createdAt,
            })),
            total: count,
            page,
            limit,
        });
    }
    catch (error) {
        console.error('Error getting credit history:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function getOwnerCredit(req, res) {
    try {
        const { id } = req.params;
        // Parse ID
        const ownerIdStr = id.startsWith('own_') ? id.substring(4) : id;
        const ownerId = parseInt(ownerIdStr, 10);
        if (isNaN(ownerId)) {
            res.status(400).json({ success: false, message: 'Invalid owner ID' });
            return;
        }
        const user = await models_1.User.findByPk(ownerId);
        if (!user) {
            res.status(404).json({ success: false, message: 'Owner not found' });
            return;
        }
        res.json({
            success: true,
            ownerId: user.id,
            balance: Number(user.credit),
        });
    }
    catch (error) {
        console.error('Error getting owner credit:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function streamCreditUpdates(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const lastEventId = Array.isArray(req.headers['last-event-id'])
        ? req.headers['last-event-id'][0]
        : req.headers['last-event-id'];
    // Add as admin client
    creditEvents_1.creditEventHub.addAdminClient(res);
    // Send initial connected event
    res.write(`event: connected\ndata: {"message":"Connected to credit updates"}\n\n`);
    req.on('close', () => {
        // Cleanup handled by hub
    });
}
// Owner endpoints (scoped to authenticated user)
async function getMyCredit(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        // Resolve user by userId or phone
        let currentUser;
        if (user.userId) {
            currentUser = await models_1.User.findByPk(user.userId);
        }
        else if (user.phone) {
            currentUser = await models_1.User.findOne({ where: { phone: user.phone } });
        }
        if (!currentUser) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.json({
            success: true,
            balance: Number(currentUser.credit),
            currency: 'ETB',
            updatedAt: currentUser.updatedAt,
        });
    }
    catch (error) {
        console.error('Error getting my credit:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function getMyCreditHistory(req, res) {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        // Resolve user by userId or phone
        let currentUser;
        if (user.userId) {
            currentUser = await models_1.User.findByPk(user.userId);
        }
        else if (user.phone) {
            currentUser = await models_1.User.findOne({ where: { phone: user.phone } });
        }
        if (!currentUser) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const { count, rows } = await models_1.CreditTransaction.findAndCountAll({
            where: { ownerId: currentUser.id },
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit,
        });
        res.json({
            success: true,
            items: rows.map((t) => ({
                id: t.id,
                type: t.type,
                amount: Number(t.amount),
                balanceBefore: Number(t.balanceBefore),
                balanceAfter: Number(t.balanceAfter),
                reason: t.reason,
                performedBy: t.performedBy,
                createdAt: t.createdAt,
            })),
            total: count,
            page,
            limit,
        });
    }
    catch (error) {
        console.error('Error getting my credit history:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function streamMyCreditUpdates(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
    }
    // Resolve user by userId or phone
    let currentUser;
    if (user.userId) {
        currentUser = await models_1.User.findByPk(user.userId);
    }
    else if (user.phone) {
        currentUser = await models_1.User.findOne({ where: { phone: user.phone } });
    }
    if (!currentUser) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const lastEventId = Array.isArray(req.headers['last-event-id'])
        ? req.headers['last-event-id'][0]
        : req.headers['last-event-id'];
    // Add as owner client
    creditEvents_1.creditEventHub.addOwnerClient(currentUser.id, res, lastEventId);
    // Send initial connected event with current balance
    res.write(`event: connected\ndata: {"balance":${Number(currentUser.credit)}}\n\n`);
    req.on('close', () => {
        // Cleanup handled by hub
    });
}
