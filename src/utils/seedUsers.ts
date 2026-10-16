import 'dotenv/config';
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

    // 1. Super Admin user "kaleab"
    const [adminUser] = await User.upsert({
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
    const [ownerUser] = await User.upsert({
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
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
