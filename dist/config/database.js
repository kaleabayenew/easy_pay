"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
// Support both DATABASE_URL and individual DB_* variables
let sequelize;
if (process.env.DATABASE_URL) {
    // Use DATABASE_URL if provided (e.g., Neon, Heroku, etc.)
    exports.sequelize = sequelize = new sequelize_1.Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
    });
}
else {
    // Use individual DB_* variables
    if (!process.env.DB_PASSWORD) {
        throw new Error('DB_PASSWORD environment variable is required but not set');
    }
    exports.sequelize = sequelize = new sequelize_1.Sequelize({
        dialect: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'sms_monitor',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
    });
}
