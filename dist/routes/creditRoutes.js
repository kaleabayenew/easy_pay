"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const creditController_1 = require("../controllers/creditController");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
// Superadmin routes (admin only)
router.post('/superadmin/owners/:id/credit', auth_1.authenticate, auth_1.requireAdmin, rateLimit_1.creditRateLimit, creditController_1.adjustOwnerCredit);
router.get('/superadmin/owners/:id/credit-history', auth_1.authenticate, auth_1.requireAdmin, creditController_1.getOwnerCreditHistory);
router.get('/superadmin/owners/:id/credit', auth_1.authenticate, auth_1.requireAdmin, creditController_1.getOwnerCredit);
router.get('/superadmin/credit/stream', auth_1.authenticateStream, auth_1.requireAdmin, creditController_1.streamCreditUpdates);
// Owner routes (authenticated users only)
router.get('/auth/me/credit', auth_1.authenticate, creditController_1.getMyCredit);
router.get('/auth/me/credit/history', auth_1.authenticate, creditController_1.getMyCreditHistory);
router.get('/auth/me/credit/stream', auth_1.authenticateStream, creditController_1.streamMyCreditUpdates);
exports.default = router;
