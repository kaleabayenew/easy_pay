import User from './User';
import Device from './Device';
import SmsLog from './SmsLog';

export { sequelize } from '../config/database';

// Associations
User.hasMany(Device, { foreignKey: 'userId' });
Device.belongsTo(User, { foreignKey: 'userId' });
Device.hasMany(SmsLog, { foreignKey: 'deviceId' });
SmsLog.belongsTo(Device, { foreignKey: 'deviceId' });

export { User, Device, SmsLog };
