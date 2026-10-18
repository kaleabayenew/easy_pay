import { Router } from 'express';
import {
  adjustOwnerCredit,
  getOwnerCreditHistory,
  getOwnerCredit,
  streamCreditUpdates,
  getMyCredit,
  getMyCreditHistory,
  streamMyCreditUpdates,
} from '../controllers/creditController';
import { authenticate, requireAdmin, authenticateStream } from '../middleware/auth';
import { creditRateLimit } from '../middleware/rateLimit';

const router = Router();

// Superadmin routes (admin only)
router.post(
  '/superadmin/owners/:id/credit',
  authenticate,
  requireAdmin,
  creditRateLimit,
  adjustOwnerCredit
);
router.get(
  '/superadmin/owners/:id/credit-history',
  authenticate,
  requireAdmin,
  getOwnerCreditHistory
);
router.get('/superadmin/owners/:id/credit', authenticate, requireAdmin, getOwnerCredit);
router.get(
  '/superadmin/credit/stream',
  authenticateStream,
  requireAdmin,
  streamCreditUpdates
);

// Owner routes (authenticated users only)
router.get('/auth/me/credit', authenticate, getMyCredit);
router.get('/auth/me/credit/history', authenticate, getMyCreditHistory);
router.get('/auth/me/credit/stream', authenticateStream, streamMyCreditUpdates);

export default router;
