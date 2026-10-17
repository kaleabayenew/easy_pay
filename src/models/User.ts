import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class User extends Model {
  public id!: number;
  public businessName?: string;
  public name?: string;
  public username?: string;
  public password?: string;
  public phone!: string;
  public pin!: string;
  public credit?: number;
  public isActive!: boolean;
  public role!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    businessName: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    username: { type: DataTypes.STRING, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: false, unique: true },
    pin: { type: DataTypes.STRING, allowNull: false },
    credit: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    role: { type: DataTypes.STRING, defaultValue: 'device_user' },
  },
  { sequelize, tableName: 'users', timestamps: true }
);

export default User;
