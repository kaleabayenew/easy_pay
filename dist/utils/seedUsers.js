"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
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
        // 1. Super Admin user "kaleab"
        const [adminUser] = await models_1.User.upsert({
            username: 'kaleab',
            password: 'Kale@1513',
            phone: '+251900001513',
            pin: '1513',
            role: 'admin',
            name: 'Super Admin Kaleab',
            isActive: true,
        });
        console.log('Super Admin user created/updated:', adminUser.username);
        // 2. Owner user "test" with phone "+251909095880" and pin "1513"
        const [ownerUser] = await models_1.User.upsert({
            username: 'test',
            password: 'test1234',
            phone: '+251909095880',
            pin: '1513',
            role: 'device_user',
            name: 'Test Betting Partner',
            isActive: true,
        });
        console.log('Owner user created/updated:', ownerUser.username, 'Phone:', ownerUser.phone, 'PIN:', ownerUser.pin);
        console.log('Seed executed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};
seed();
