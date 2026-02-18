import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  findAvailableDrivers,
  testDriverMatching,
  handleDriverResponse,
  getMatchingStats
} from '../controllers/driverMatching.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/available-drivers', findAvailableDrivers);
router.post('/test-matching', testDriverMatching);

router.post('/ride-response/:rideId', requireRole([USER_ROLES.DRIVER]), handleDriverResponse);

router.get('/stats', requireRole([USER_ROLES.ADMIN]), getMatchingStats);

export default router;