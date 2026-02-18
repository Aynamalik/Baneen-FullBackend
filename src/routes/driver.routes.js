import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  getProfile,
  updateProfile,
  updateAvailability,
  setOnline,
  registerVehicle,
  updateVehicle,
  getRideHistory,
  getRideDetails,
  getEarnings,
  getDriverStats,
  getEarningsStats,
} from '../controllers/driver.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole([USER_ROLES.DRIVER]));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.put('/availability', updateAvailability);
router.post('/online', setOnline);

router.post('/vehicle', registerVehicle);
router.put('/vehicle/:id', updateVehicle);

router.get('/rides', getRideHistory);
router.get('/rides/:id', getRideDetails);

router.get('/earnings', getEarnings);
router.get('/earnings/stats', getEarningsStats);

router.get('/stats', getDriverStats);

export default router;