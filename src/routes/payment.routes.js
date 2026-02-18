import express from 'express';
import {
  processPaymentRequest,
  verifyPayment,
  getUserPaymentHistory,
  requestRefund,
  handleEasypaisaWebhook,
  handleJazzCashWebhook,
  handleStripeWebhook,
  getPaymentStats,
  processRefundAdmin,
  getAllPayments
} from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.post('/webhooks/easypaisa', handleEasypaisaWebhook);
router.post('/webhooks/jazzcash', handleJazzCashWebhook);
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

router.use(authenticate);

router.post('/process', processPaymentRequest);
router.post('/verify', verifyPayment);
router.get('/history', getUserPaymentHistory);
router.post('/refund', requestRefund);

router.use(requireRole([USER_ROLES.ADMIN]));
router.get('/admin/stats', getPaymentStats);
router.post('/admin/refund', processRefundAdmin);
router.get('/admin/all', getAllPayments);

export default router;