import { Sequelize } from 'sequelize';
import { config } from 'dotenv';

config();

// Support both DATABASE_URL and individual DB_* variables
let sequelize: Sequelize;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (e.g., Neon, Heroku, etc.)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
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
} else {
  // Use individual DB_* variables
  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is required but not set');
  }

  sequelize = new Sequelize({
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

export { sequelize };
