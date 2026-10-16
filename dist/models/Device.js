"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Device extends sequelize_1.Model {
}
Device.init({
    deviceId: { type: sequelize_1.DataTypes.STRING, primaryKey: true },
    userId: { type: sequelize_1.DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    isActive: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    lastHeartbeat: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    simSerial: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    phoneNumber: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    isRooted: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
    registeredAt: { type: sequelize_1.DataTypes.DATE, defaultValue: sequelize_1.DataTypes.NOW },
    appVersion: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    batteryLevel: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    networkType: { type: sequelize_1.DataTypes.STRING, allowNull: true },
}, { sequelize: database_1.sequelize, tableName: 'devices', timestamps: true });
exports.default = Device;
