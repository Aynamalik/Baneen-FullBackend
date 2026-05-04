import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { uploadDriverProfileFiles, cleanupTempFiles } from '../middleware/upload.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  getProfile,
  updateProfile,
  updateAvailability,
  setOnline,
  setOffline,
  getPendingRideRequests,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
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
router.put('/profile', uploadDriverProfileFiles, cleanupTempFiles, updateProfile);

router.put('/availability', updateAvailability);
router.post('/online', setOnline);
router.post('/offline', setOffline);

router.get('/rides/requests', getPendingRideRequests);
router.get('/rides', getRideHistory);
router.get('/rides/:id', getRideDetails);

router.post('/emergency-contacts', addEmergencyContact);
router.put('/emergency-contacts/:id', updateEmergencyContact);
router.delete('/emergency-contacts/:id', deleteEmergencyContact);

router.post('/vehicle', registerVehicle);
router.put('/vehicle/:id', updateVehicle);

router.get('/earnings', getEarnings);
router.get('/earnings/stats', getEarningsStats);

router.get('/stats', getDriverStats);

export default router;