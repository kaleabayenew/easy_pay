"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class User extends sequelize_1.Model {
}
User.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    businessName: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    username: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    password: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    phone: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    pin: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    credit: { type: sequelize_1.DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    isActive: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: true },
    role: { type: sequelize_1.DataTypes.STRING, defaultValue: 'device_user' },
}, { sequelize: database_1.sequelize, tableName: 'users', timestamps: true });
exports.default = User;
