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
    // IMPORTANT: Change the PIN immediately after first login via POST /api/v1/auth/change-pin
    // The seed PIN is read from ADMIN_SEED_PIN env var — must be set before running migrate
    const adminSeedPin = process.env.ADMIN_SEED_PIN;
    if (!adminSeedPin) {
      console.error('ERROR: ADMIN_SEED_PIN environment variable is not set. Skipping seed.');
      console.error('Set ADMIN_SEED_PIN in your .env file and re-run migrate to create the admin user.');
      process.exit(1);
    }

    const adminPhone = process.env.ADMIN_SEED_PHONE || '+251900000000';
    const existing = await User.findOne({ where: { phone: adminPhone } });
    if (!existing) {
      const hashedPin = await bcrypt.hash(adminSeedPin, BCRYPT_ROUNDS);
      await User.create({
        phone: adminPhone,
        pin: hashedPin,
        role: 'admin',
        isActive: true,
      });
      console.log(`Seed complete: admin user created for phone ${adminPhone}`);
      console.log('ACTION REQUIRED: Change the admin PIN immediately after first login.');
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
