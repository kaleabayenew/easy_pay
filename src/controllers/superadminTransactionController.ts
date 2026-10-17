import { Request, Response } from 'express';
import { TransactionVerification, User, ApiKey } from '../models';

export const getAllVerifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const whereClause: Record<string, unknown> = {};
    if (status) whereClause.status = status;

    const { count, rows } = await TransactionVerification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'businessName', 'phone'],
        },
        {
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'keyPrefix'],
        },
      ],
      order: [['apiRequestReceivedAt', 'DESC']],
      limit,
      offset,
    });

    res.json({ success: true, data: rows, total: count, page, limit });
  } catch (error) {
    console.error('Get all verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getVerificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const verification = await TransactionVerification.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'businessName', 'phone'],
        },
        {
          model: ApiKey,
          as: 'apiKey',
          attributes: ['id', 'keyPrefix'],
        },
      ],
    });

    if (!verification) {
      res.status(404).json({ success: false, message: 'Verification not found' });
      return;
    }

    res.json({ success: true, data: verification });
  } catch (error) {
    console.error('Get verification by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getVerificationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const total = await TransactionVerification.count();
    const pending = await TransactionVerification.count({ where: { status: 'pending' } });
    const matched = await TransactionVerification.count({ where: { status: 'matched' } });
    const mismatched = await TransactionVerification.count({ where: { status: 'mismatched' } });
    const expired = await TransactionVerification.count({ where: { status: 'expired' } });

    res.json({
      success: true,
      stats: {
        total,
        pending,
        matched,
        mismatched,
        expired,
      },
    });
  } catch (error) {
    console.error('Get verification stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
