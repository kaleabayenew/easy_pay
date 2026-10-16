import { Request, Response } from 'express';
import { Device } from '../models';

export const heartbeat = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      deviceId,
      timestamp,
      simSerial,
      phoneNumber,
      isRooted,
      batteryLevel,
      networkType,
      appVersion,
    } = req.body as {
      deviceId?: string;
      timestamp?: number | string;
      simSerial?: string;
      phoneNumber?: string;
      isRooted?: boolean;
      batteryLevel?: number | string;
      networkType?: string;
      appVersion?: string;
    };

    if (!deviceId) {
      res.status(400).json({ success: false, message: 'Missing deviceId' });
      return;
    }

    const ts =
      timestamp != null
        ? new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10))
        : new Date();

    const batteryLevelNum = batteryLevel != null ? Number(batteryLevel) : null;

    const [device, created] = await Device.findOrCreate({
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
      const updates: Record<string, unknown> = {
        lastHeartbeat: ts,
        simSerial: simSerial || device.simSerial,
        phoneNumber: phoneNumber || device.phoneNumber,
        isRooted: isRooted === true,
        batteryLevel: batteryLevelNum !== null ? batteryLevelNum : device.batteryLevel,
        networkType: networkType || device.networkType,
        appVersion: appVersion || device.appVersion,
      };
      // Security policy: if rooted, deactivate automatically
      if (isRooted === true) updates.isActive = false;
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
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getDeviceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;

    const whereClause: Record<string, unknown> = { deviceId };
    if (role !== 'admin') whereClause.userId = userId;

    const device = await Device.findOne({ where: whereClause });

    if (!device) {
      res.status(404).json({ success: false, message: 'Device not found' });
      return;
    }

    res.json({ success: true, data: device });
  } catch (error) {
    console.error('Get device status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    const whereClause: Record<string, unknown> = {};
    if (role !== 'admin') whereClause.userId = userId;

    const devices = await Device.findAll({ where: whereClause });
    res.json({ success: true, data: devices });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deactivateDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;

    const whereClause: Record<string, unknown> = { deviceId };
    if (role !== 'admin') whereClause.userId = userId;

    const device = await Device.findOne({ where: whereClause });
    if (!device) {
      res.status(404).json({ success: false, message: 'Device not found' });
      return;
    }

    await device.update({ isActive: false });
    res.json({ success: true, message: 'Device deactivated' });
  } catch (error) {
    console.error('Deactivate device error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
