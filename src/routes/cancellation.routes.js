import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  calculateCancellationFee,
  checkCancellationEligibility,
  getCancellationPolicy,
  getCancellationStats
} from '../controllers/cancellation.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/fee/:rideId', calculateCancellationFee);
router.get('/eligibility/:rideId', checkCancellationEligibility);
router.get('/policy/:userType', getCancellationPolicy);

router.get('/stats', requireRole([USER_ROLES.ADMIN]), getCancellationStats);

export default router;