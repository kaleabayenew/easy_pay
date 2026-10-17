"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class TransactionVerification extends sequelize_1.Model {
}
TransactionVerification.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
    },
    apiKeyId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'api_keys', key: 'id' },
        onDelete: 'CASCADE'
    },
    transactionId: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(10, 2), allowNull: false },
    method: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    smsTransactionId: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    smsAmount: { type: sequelize_1.DataTypes.DECIMAL(10, 2), allowNull: true },
    smsMethod: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'matched', 'mismatched', 'expired'),
        defaultValue: 'pending',
        allowNull: false
    },
    apiRequestReceivedAt: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    smsReceivedAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    matchedAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    responseSentAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, { sequelize: database_1.sequelize, tableName: 'transaction_verifications', timestamps: true });
exports.default = TransactionVerification;
