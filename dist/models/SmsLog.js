"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class SmsLog extends sequelize_1.Model {
}
SmsLog.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deviceId: { type: sequelize_1.DataTypes.STRING, allowNull: false, references: { model: 'devices', key: 'deviceId' } },
    sender: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    body: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    timestamp: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    simSerial: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    status: { type: sequelize_1.DataTypes.ENUM('pending', 'sent', 'failed'), defaultValue: 'pending' },
    retryCount: { type: sequelize_1.DataTypes.INTEGER, defaultValue: 0 },
    serverResponse: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
}, { sequelize: database_1.sequelize, tableName: 'sms_logs', timestamps: true });
exports.default = SmsLog;
