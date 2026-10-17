import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class TransactionVerification extends Model {
  public id!: number;
  public ownerId!: number;
  public apiKeyId!: number;
  public transactionId!: string;
  public amount!: number;
  public method!: string; // 'CBE' or 'Telebirr'
  public smsTransactionId?: string;
  public smsAmount?: number;
  public smsMethod?: string;
  public status!: string; // 'pending', 'matched', 'mismatched', 'expired'
  public apiRequestReceivedAt!: Date;
  public smsReceivedAt?: Date;
  public matchedAt?: Date;
  public responseSentAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TransactionVerification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    apiKeyId: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'api_keys', key: 'id' },
      onDelete: 'CASCADE'
    },
    transactionId: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    method: { type: DataTypes.STRING, allowNull: false },
    smsTransactionId: { type: DataTypes.STRING, allowNull: true },
    smsAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    smsMethod: { type: DataTypes.STRING, allowNull: true },
    status: { 
      type: DataTypes.ENUM('pending', 'matched', 'mismatched', 'expired'), 
      defaultValue: 'pending',
      allowNull: false 
    },
    apiRequestReceivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    smsReceivedAt: { type: DataTypes.DATE, allowNull: true },
    matchedAt: { type: DataTypes.DATE, allowNull: true },
    responseSentAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'transaction_verifications', timestamps: true }
);

export default TransactionVerification;
