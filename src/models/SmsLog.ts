import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class SmsLog extends Model {
  public id!: number;
  public deviceId!: string;
  public sender!: string;
  public body!: string;
  public timestamp!: Date;
  public simSerial?: string;
  public status!: string;
  public retryCount!: number;
  public serverResponse?: string;
}

SmsLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    deviceId: { type: DataTypes.STRING, allowNull: false, references: { model: 'devices', key: 'deviceId' } },
    sender: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    simSerial: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'sent', 'failed'), defaultValue: 'pending' },
    retryCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    serverResponse: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'sms_logs', timestamps: true }
);

export default SmsLog;
