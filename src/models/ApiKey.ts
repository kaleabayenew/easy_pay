import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class ApiKey extends Model {
  public id!: number;
  public ownerId!: number;
  public apiKey!: string;
  public keyPrefix!: string;
  public isActive!: boolean;
  public lastUsedAt?: Date;
  public expiresAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ApiKey.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    apiKey: { type: DataTypes.STRING, allowNull: false, unique: true },
    keyPrefix: { type: DataTypes.STRING, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'api_keys', timestamps: true }
);

export default ApiKey;
