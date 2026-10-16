import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class User extends Model {
  public id!: number;
  public phone!: string;
  public pin!: string;
  public isActive!: boolean;
  public role!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    pin: { type: DataTypes.STRING, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    role: { type: DataTypes.ENUM('device_user', 'admin'), defaultValue: 'device_user' },
  },
  { sequelize, tableName: 'users', timestamps: true }
);

export default User;
