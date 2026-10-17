"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = require("../config/database");
const models_1 = require("../models");
const seed = async () => {
    try {
        console.log('Connecting to Neon PostgreSQL database...');
        await database_1.sequelize.authenticate();
        console.log('Database connected successfully.');
        // Alter table to ensure columns exist
        await database_1.sequelize.sync({ alter: true });
        console.log('Database schema synchronized.');
        const hashedAdminPin = await bcrypt_1.default.hash('1513', 12);
        const hashedAdminPass = await bcrypt_1.default.hash('Kale@1513', 12);
        // 1. Super Admin user "kaleab"
        const [adminUser] = await models_1.User.upsert({
            username: 'kaleab',
            password: hashedAdminPass,
            phone: '+251900001513',
            pin: hashedAdminPin,
            role: 'admin',
            name: 'Super Admin Kaleab',
            isActive: true,
        });
        console.log('Super Admin user created/updated:', adminUser.username);
        const hashedOwnerPin = await bcrypt_1.default.hash('1234', 12);
        const hashedOwnerPass = await bcrypt_1.default.hash('test1234', 12);
        // 2. Owner user "test" with phone "+251909095880" and pin "1234"
        const [ownerUser] = await models_1.User.upsert({
            username: 'test',
            password: hashedOwnerPass,
            phone: '+251909095880',
            pin: hashedOwnerPin,
            role: 'device_user',
            name: 'Test Betting Partner',
            isActive: true,
        });
        console.log('Owner user created/updated:', ownerUser.username, 'Phone:', ownerUser.phone);
        console.log('Seed executed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};
seed();
