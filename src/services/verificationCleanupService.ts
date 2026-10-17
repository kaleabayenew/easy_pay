import { TransactionVerification, ApiKey } from '../models';
import { sendWebhook } from './webhookService';
import { Op } from 'sequelize';

const VERIFICATION_TIMEOUT_MINUTES = 5; // 5 minutes timeout

export const expirePendingVerifications = async (): Promise<void> => {
  try {
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - VERIFICATION_TIMEOUT_MINUTES);

    const expiredVerifications = await TransactionVerification.findAll({
      where: {
        status: 'pending',
        apiRequestReceivedAt: {
          [Op.lt]: timeoutDate,
        },
      },
    });

    for (const verification of expiredVerifications) {
      await verification.update({
        status: 'expired',
        responseSentAt: new Date(),
      });

      // Send webhook if configured
      const apiKey = await ApiKey.findByPk(verification.apiKeyId);
      if (apiKey && apiKey.webhookUrl) {
        await sendWebhook(apiKey.webhookUrl, {
          verificationId: verification.id,
          transactionId: verification.transactionId,
          amount: verification.amount,
          method: verification.method,
          status: 'expired',
        });
      }
    }

    console.log(`Expired ${expiredVerifications.length} pending verifications`);
  } catch (error) {
    console.error('Error expiring verifications:', error);
  }
};

// Run cleanup every minute
export const startVerificationCleanup = (): NodeJS.Timeout => {
  return setInterval(expirePendingVerifications, 60000); // 1 minute
};
