"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSms = exports.retrySms = exports.getSmsLogs = exports.receiveSms = void 0;
const models_1 = require("../models");
const receiveSms = async (req, res) => {
    try {
        const { deviceId, sender, body, timestamp, simSerial } = req.body;
        if (!deviceId || !sender || !body || !timestamp) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: deviceId, sender, body, timestamp',
            });
            return;
        }
        const device = await models_1.Device.findByPk(deviceId);
        if (!device) {
            res.status(404).json({ success: false, message: 'Device not found' });
            return;
        }
        if (!device.isActive) {
            res.status(403).json({ success: false, message: 'Device is deactivated' });
            return;
        }
        const smsLog = await models_1.SmsLog.create({
            deviceId,
            sender,
            body,
            timestamp: new Date(timestamp),
            simSerial: simSerial || null,
            status: 'pending',
            retryCount: 0,
        });
        await device.update({ lastHeartbeat: new Date() });
        res.json({ success: true, smsId: smsLog.id.toString(), message: 'SMS received' });
    }
    catch (error) {
        console.error('SMS receive error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.receiveSms = receiveSms;
const getSmsLogs = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const status = req.query.status;
        const offset = (page - 1) * limit;
        const userId = req.user?.userId;
        const role = req.user?.role;
        // Ownership check: admin can see all, device_user can only see their own device
        if (role !== 'admin') {
            const device = await models_1.Device.findOne({ where: { deviceId, userId } });
            if (!device) {
                res.status(403).json({ success: false, message: 'Access denied to this device' });
                return;
            }
        }
        const whereClause = { deviceId };
        if (status)
            whereClause.status = status;
        const { count, rows } = await models_1.SmsLog.findAndCountAll({
            where: whereClause,
            order: [['timestamp', 'DESC']],
            limit,
            offset,
        });
        res.json({ success: true, data: rows, total: count, page, limit });
    }
    catch (error) {
        console.error('Get SMS logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getSmsLogs = getSmsLogs;
const retrySms = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;
        const smsLog = await models_1.SmsLog.findByPk(parseInt(id, 10));
        if (!smsLog) {
            res.status(404).json({ success: false, message: 'SMS log not found' });
            return;
        }
        if (role !== 'admin') {
            const device = await models_1.Device.findOne({ where: { deviceId: smsLog.deviceId, userId } });
            if (!device) {
                res.status(403).json({ success: false, message: 'Access denied' });
                return;
            }
        }
        await smsLog.update({ status: 'pending', retryCount: smsLog.retryCount + 1 });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Retry SMS error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.retrySms = retrySms;
const deleteSms = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;
        const smsLog = await models_1.SmsLog.findByPk(parseInt(id, 10));
        if (!smsLog) {
            res.status(404).json({ success: false, message: 'SMS log not found' });
            return;
        }
        if (role !== 'admin') {
            const device = await models_1.Device.findOne({ where: { deviceId: smsLog.deviceId, userId } });
            if (!device) {
                res.status(403).json({ success: false, message: 'Access denied' });
                return;
            }
        }
        await smsLog.destroy();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete SMS error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.deleteSms = deleteSms;
