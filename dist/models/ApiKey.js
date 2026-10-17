"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class ApiKey extends sequelize_1.Model {
}
ApiKey.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
    },
    apiKey: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    keyPrefix: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    isActive: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    webhookUrl: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    lastUsedAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    expiresAt: { type: sequelize_1.DataTypes.DATE, allowNull: true },
}, { sequelize: database_1.sequelize, tableName: 'api_keys', timestamps: true });
exports.default = ApiKey;
