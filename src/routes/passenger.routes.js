import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  getProfile,
  updateProfile,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  getRideHistory,
  getRideDetails,
  getSubscriptionStatus,
  getPassengerStats,
} from '../controllers/passenger.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole([USER_ROLES.PASSENGER]));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

router.post('/emergency-contacts', addEmergencyContact);
router.put('/emergency-contacts/:id', updateEmergencyContact);
router.delete('/emergency-contacts/:id', deleteEmergencyContact);

router.get('/rides', getRideHistory);
router.get('/rides/:id', getRideDetails);

router.get('/subscription', getSubscriptionStatus);

router.get('/stats', getPassengerStats);

export default router;