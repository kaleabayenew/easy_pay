import User from './User';
import Device from './Device';
import SmsLog from './SmsLog';
import ApiKey from './ApiKey';
import TransactionVerification from './TransactionVerification';

export { sequelize } from '../config/database';

// Associations
User.hasMany(Device, { foreignKey: 'userId' });
Device.belongsTo(User, { foreignKey: 'userId' });
Device.hasMany(SmsLog, { foreignKey: 'deviceId' });
SmsLog.belongsTo(Device, { foreignKey: 'deviceId' });
User.hasMany(ApiKey, { foreignKey: 'ownerId', as: 'apiKeys' });
ApiKey.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(TransactionVerification, { foreignKey: 'ownerId', as: 'transactionVerifications' });
TransactionVerification.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
ApiKey.hasMany(TransactionVerification, { foreignKey: 'apiKeyId', as: 'verifications' });
TransactionVerification.belongsTo(ApiKey, { foreignKey: 'apiKeyId', as: 'apiKey' });

export { User, Device, SmsLog, ApiKey, TransactionVerification };
