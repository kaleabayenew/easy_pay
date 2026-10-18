import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

class CreditTransaction extends Model {
  public id!: number;
  public ownerId!: number;
  public type!: 'initial' | 'add' | 'subtract';
  public amount!: number;
  public balanceBefore!: number;
  public balanceAfter!: number;
  public reason?: string;
  public performedBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CreditTransaction.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['initial', 'add', 'subtract']],
      },
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    balanceBefore: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    performedBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'credit_transactions',
    timestamps: true,
    indexes: [
      {
        fields: ['ownerId', 'createdAt'],
      },
    ],
  }
);

export default CreditTransaction;
