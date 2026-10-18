"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditError = void 0;
exports.adjustCredit = adjustCredit;
const models_1 = require("../models");
class CreditError extends Error {
    constructor(message, httpStatus = 400) {
        super(message);
        this.httpStatus = httpStatus;
        this.name = 'CreditError';
    }
}
exports.CreditError = CreditError;
async function adjustCredit({ ownerId, type, amount, reason, performedBy, }) {
    // Validation
    if (!isFinite(amount) || amount <= 0) {
        throw new CreditError('Amount must be a positive number');
    }
    // Check decimal places (max 2)
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
        throw new CreditError('Amount can have at most 2 decimal places');
    }
    // Per-operation maximum
    if (amount > 10000000) {
        throw new CreditError('Amount exceeds maximum of 10,000,000 per operation');
    }
    const t = await models_1.sequelize.transaction();
    try {
        // Lock user row for update
        const user = await models_1.User.findByPk(ownerId, {
            lock: t.LOCK.UPDATE,
            transaction: t,
        });
        if (!user) {
            throw new CreditError('Owner not found', 404);
        }
        const balanceBefore = Number(user.credit) || 0;
        const balanceBeforeCents = Math.round(balanceBefore * 100);
        const amountCents = Math.round(amount * 100);
        let balanceAfterCents;
        if (type === 'subtract') {
            balanceAfterCents = balanceBeforeCents - amountCents;
            if (balanceAfterCents < 0) {
                throw new CreditError(`Insufficient credit. Current balance: ${balanceBefore.toFixed(2)}, requested to subtract: ${amount.toFixed(2)}`);
            }
        }
        else {
            balanceAfterCents = balanceBeforeCents + amountCents;
        }
        const balanceAfter = balanceAfterCents / 100;
        // Check column limit (DECIMAL(12,2) max is 9999999999.99)
        if (balanceAfter > 9999999999.99) {
            throw new CreditError('Balance would exceed maximum allowed amount');
        }
        // Update user credit
        await user.update({ credit: balanceAfter }, { transaction: t });
        // Create credit transaction record
        const transaction = await models_1.CreditTransaction.create({
            ownerId,
            type,
            amount,
            balanceBefore,
            balanceAfter,
            reason,
            performedBy,
        }, { transaction: t });
        await t.commit();
        // Emit live event AFTER commit (done by caller)
        return {
            balanceBefore,
            balanceAfter,
            transaction,
        };
    }
    catch (error) {
        await t.rollback();
        if (error instanceof CreditError) {
            throw error;
        }
        console.error('Error adjusting credit:', error);
        throw new CreditError('Failed to adjust credit', 500);
    }
}
