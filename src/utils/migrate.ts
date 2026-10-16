import 'dotenv/config';
import bcrypt from 'bcrypt';
import { sequelize } from '../config/database';
import { User } from '../models';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

const migrate = async (): Promise<void> => {
  try {
    console.log('Starting database migration...');
    await sequelize.authenticate();
    console.log('Database connection established');

    await sequelize.sync({ force: true });
    console.log('Database migration completed successfully');

    // Seed default admin user if not exists
    const adminPhone = '+251900000000';
    const existing = await User.findOne({ where: { phone: adminPhone } });
    if (!existing) {
      const hashedPin = await bcrypt.hash('0000', BCRYPT_ROUNDS);
      await User.create({
        phone: adminPhone,
        pin: hashedPin,
        role: 'admin',
        isActive: true,
      });
      console.log('Seed complete: default admin user created');
    } else {
      console.log('Seed skipped: admin user already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
