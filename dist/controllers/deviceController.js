"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateDevice = exports.listDevices = exports.getDeviceStatus = exports.heartbeat = void 0;
const models_1 = require("../models");
const heartbeat = async (req, res) => {
    try {
        const { deviceId, timestamp, simSerial, phoneNumber, isRooted, batteryLevel, networkType, appVersion, } = req.body;
        if (!deviceId) {
            res.status(400).json({ success: false, message: 'Missing deviceId' });
            return;
        }
        const ts = timestamp != null
            ? new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10))
            : new Date();
        const batteryLevelNum = batteryLevel != null ? Number(batteryLevel) : null;
        const [device, created] = await models_1.Device.findOrCreate({
            where: { deviceId },
            defaults: {
                deviceId,
                lastHeartbeat: ts,
                simSerial: simSerial || null,
                phoneNumber: phoneNumber || null,
                isRooted: isRooted === true,
                batteryLevel: batteryLevelNum,
                networkType: networkType || null,
                appVersion: appVersion || null,
                isActive: isRooted !== true,
                registeredAt: new Date(),
            },
        });
        if (!created) {
            const updates = {
                lastHeartbeat: ts,
                simSerial: simSerial || device.simSerial,
                phoneNumber: phoneNumber || device.phoneNumber,
                isRooted: isRooted === true,
                batteryLevel: batteryLevelNum !== null ? batteryLevelNum : device.batteryLevel,
                networkType: networkType || device.networkType,
                appVersion: appVersion || device.appVersion,
            };
            // Security policy: if rooted, deactivate automatically
            if (isRooted === true)
                updates.isActive = false;
            await device.update(updates);
            // Reload to get the latest persisted values (isActive may have changed)
            await device.reload();
        }
        res.json({
            success: true,
            isActive: device.isActive,
            shouldDeactivate: !device.isActive,
            shouldWipe: false,
            serverTimestamp: Date.now(),
        });
    }
    catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.heartbeat = heartbeat;
const getDeviceStatus = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;
        const whereClause = { deviceId };
        if (role !== 'admin')
            whereClause.userId = userId;
        const device = await models_1.Device.findOne({ where: whereClause });
        if (!device) {
            res.status(404).json({ success: false, message: 'Device not found' });
            return;
        }
        res.json({ success: true, data: device });
    }
    catch (error) {
        console.error('Get device status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getDeviceStatus = getDeviceStatus;
const listDevices = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        const whereClause = {};
        if (role !== 'admin')
            whereClause.userId = userId;
        const devices = await models_1.Device.findAll({ where: whereClause });
        res.json({ success: true, data: devices });
    }
    catch (error) {
        console.error('List devices error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.listDevices = listDevices;
const deactivateDevice = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;
        const whereClause = { deviceId };
        if (role !== 'admin')
            whereClause.userId = userId;
        const device = await models_1.Device.findOne({ where: whereClause });
        if (!device) {
            res.status(404).json({ success: false, message: 'Device not found' });
            return;
        }
        await device.update({ isActive: false });
        res.json({ success: true, message: 'Device deactivated' });
    }
    catch (error) {
        console.error('Deactivate device error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.deactivateDevice = deactivateDevice;
