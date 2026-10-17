import 'dotenv/config';
import bcrypt from 'bcrypt';
import { sequelize } from '../config/database';
import { User } from '../models';

const seed = async () => {
  try {
    console.log('Connecting to Neon PostgreSQL database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Alter table to ensure columns exist
    await sequelize.sync({ alter: true });
    console.log('Database schema synchronized.');

    const hashedAdminPin = await bcrypt.hash('1513', 12);
    const hashedAdminPass = await bcrypt.hash('Kale@1513', 12);

    // 1. Super Admin user "kaleab"
    const [adminUser] = await User.upsert({
      username: 'kaleab',
      password: hashedAdminPass,
      phone: '+251900001513',
      pin: hashedAdminPin,
      role: 'admin',
      name: 'Super Admin Kaleab',
      isActive: true,
    });
    console.log('Super Admin user created/updated:', adminUser.username);

    const hashedOwnerPin = await bcrypt.hash('1234', 12);
    const hashedOwnerPass = await bcrypt.hash('test1234', 12);

    // 2. Owner user "test" with phone "+251909095880" and pin "1234"
    const [ownerUser] = await User.upsert({
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
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
