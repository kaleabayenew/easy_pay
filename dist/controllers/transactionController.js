"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVerificationStatus = exports.verifyTransaction = void 0;
const models_1 = require("../models");
const verifyTransaction = async (req, res) => {
    try {
        const apiKeyHeader = req.headers['x-api-key'];
        const { transaction_id, amount, method } = req.body;
        // Validate API key
        if (!apiKeyHeader) {
            res.status(401).json({ success: false, message: 'API key is required' });
            return;
        }
        if (!transaction_id || transaction_id.trim().length === 0) {
            res.status(400).json({ success: false, message: 'Transaction ID is required' });
            return;
        }
        if (!amount || isNaN(amount) || amount <= 0) {
            res.status(400).json({ success: false, message: 'Valid amount is required' });
            return;
        }
        if (!method || !['CBE', 'Telebirr'].includes(method)) {
            res.status(400).json({ success: false, message: 'Method must be CBE or Telebirr' });
            return;
        }
        // Find API key
        const apiKey = await models_1.ApiKey.findOne({
            where: { apiKey: apiKeyHeader, isActive: true },
        });
        if (!apiKey) {
            res.status(401).json({ success: false, message: 'Invalid or inactive API key' });
            return;
        }
        // Find owner
        const owner = await models_1.User.findOne({
            where: { id: apiKey.ownerId, isActive: true },
        });
        if (!owner) {
            res.status(401).json({ success: false, message: 'Owner not found or inactive' });
            return;
        }
        // Check if verification already exists for this transaction
        const existingVerification = await models_1.TransactionVerification.findOne({
            where: { transactionId: transaction_id, ownerId: owner.id },
        });
        if (existingVerification) {
            res.status(200).json({
                success: true,
                message: 'Transaction verification already exists',
                status: existingVerification.status,
                verificationId: existingVerification.id,
            });
            return;
        }
        // Create pending verification
        const verification = await models_1.TransactionVerification.create({
            ownerId: owner.id,
            apiKeyId: apiKey.id,
            transactionId: transaction_id,
            amount: parseFloat(amount.toString()),
            method: method,
            status: 'pending',
            apiRequestReceivedAt: new Date(),
        });
        // TODO: Hook for automatic credit deduction on transaction verification
        // When the verification is matched, deduct from owner's credit:
        // await adjustCredit({ ownerId: owner.id, type: 'subtract', amount, reason: 'Transaction verification', performedBy: 'system' })
        // This should be integrated into the SMS matching logic in smsController
        res.status(201).json({
            success: true,
            message: 'Transaction verification request created. Waiting for SMS match.',
            verificationId: verification.id,
            status: 'pending',
        });
    }
    catch (error) {
        console.error('Verify transaction error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.verifyTransaction = verifyTransaction;
const getVerificationStatus = async (req, res) => {
    try {
        const { verificationId } = req.params;
        if (!verificationId) {
            res.status(400).json({ success: false, message: 'Verification ID is required' });
            return;
        }
        const verification = await models_1.TransactionVerification.findByPk(verificationId);
        if (!verification) {
            res.status(404).json({ success: false, message: 'Verification not found' });
            return;
        }
        res.status(200).json({
            success: true,
            verification: {
                id: verification.id,
                transactionId: verification.transactionId,
                amount: verification.amount,
                method: verification.method,
                status: verification.status,
                smsTransactionId: verification.smsTransactionId,
                smsAmount: verification.smsAmount,
                smsMethod: verification.smsMethod,
                apiRequestReceivedAt: verification.apiRequestReceivedAt,
                smsReceivedAt: verification.smsReceivedAt,
                matchedAt: verification.matchedAt,
                responseSentAt: verification.responseSentAt,
            },
        });
    }
    catch (error) {
        console.error('Get verification status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getVerificationStatus = getVerificationStatus;
