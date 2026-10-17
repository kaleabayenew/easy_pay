import axios from 'axios';

interface WebhookPayload {
  verificationId: number;
  transactionId: string;
  amount: number;
  method: string;
  status: string;
  smsTransactionId?: string;
  smsAmount?: number;
  smsMethod?: string;
  matchedAt?: Date;
}

export const sendWebhook = async (webhookUrl: string, payload: WebhookPayload): Promise<boolean> => {
  try {
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
    return true;
  } catch (error) {
    console.error('Webhook send error:', error);
    return false;
  }
};
