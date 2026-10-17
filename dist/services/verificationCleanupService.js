"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startVerificationCleanup = exports.expirePendingVerifications = void 0;
const models_1 = require("../models");
const webhookService_1 = require("./webhookService");
const sequelize_1 = require("sequelize");
const VERIFICATION_TIMEOUT_MINUTES = 5; // 5 minutes timeout
const expirePendingVerifications = async () => {
    try {
        const timeoutDate = new Date();
        timeoutDate.setMinutes(timeoutDate.getMinutes() - VERIFICATION_TIMEOUT_MINUTES);
        const expiredVerifications = await models_1.TransactionVerification.findAll({
            where: {
                status: 'pending',
                apiRequestReceivedAt: {
                    [sequelize_1.Op.lt]: timeoutDate,
                },
            },
        });
        for (const verification of expiredVerifications) {
            await verification.update({
                status: 'expired',
                responseSentAt: new Date(),
            });
            // Send webhook if configured
            const apiKey = await models_1.ApiKey.findByPk(verification.apiKeyId);
            if (apiKey && apiKey.webhookUrl) {
                await (0, webhookService_1.sendWebhook)(apiKey.webhookUrl, {
                    verificationId: verification.id,
                    transactionId: verification.transactionId,
                    amount: verification.amount,
                    method: verification.method,
                    status: 'expired',
                });
            }
        }
        console.log(`Expired ${expiredVerifications.length} pending verifications`);
    }
    catch (error) {
        console.error('Error expiring verifications:', error);
    }
};
exports.expirePendingVerifications = expirePendingVerifications;
// Run cleanup every minute
const startVerificationCleanup = () => {
    return setInterval(exports.expirePendingVerifications, 60000); // 1 minute
};
exports.startVerificationCleanup = startVerificationCleanup;
