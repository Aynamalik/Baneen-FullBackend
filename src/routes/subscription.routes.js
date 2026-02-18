import express from 'express';
import {
  getSubscriptionPlans,
  subscribe,
  getSubscriptionStatus,
  cancelSubscription,
  createPlan,
  updatePlan,
  deletePlan,
  getAllPlansAdmin,
  getAnalytics
} from '../controllers/subscription.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/plans', getSubscriptionPlans);
router.post('/subscribe', subscribe);
router.get('/status', getSubscriptionStatus);
router.post('/cancel', cancelSubscription);

router.use(requireRole([USER_ROLES.ADMIN]));
router.get('/admin/plans', getAllPlansAdmin);
router.post('/admin/plans', createPlan);
router.put('/admin/plans/:id', updatePlan);
router.delete('/admin/plans/:id', deletePlan);
router.get('/admin/analytics', getAnalytics);

export default router;