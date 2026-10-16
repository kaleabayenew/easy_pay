import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class Device extends Model {
  public deviceId!: string;
  public userId?: number;
  public isActive!: boolean;
  public lastHeartbeat!: Date;
  public simSerial?: string;
  public phoneNumber?: string;
  public isRooted!: boolean;
  public registeredAt!: Date;
  public appVersion?: string;
  public batteryLevel?: number;
  public networkType?: string;
}

Device.init(
  {
    deviceId: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastHeartbeat: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    simSerial: { type: DataTypes.STRING, allowNull: true },
    phoneNumber: { type: DataTypes.STRING, allowNull: true },
    isRooted: { type: DataTypes.BOOLEAN, defaultValue: false },
    registeredAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    appVersion: { type: DataTypes.STRING, allowNull: true },
    batteryLevel: { type: DataTypes.INTEGER, allowNull: true },
    networkType: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, tableName: 'devices', timestamps: true }
);

export default Device;
