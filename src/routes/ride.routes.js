import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { sosAlertSchema, rideRequestSchema } from '../utils/validators.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import { uploadDriverPhoto } from '../middleware/upload.middleware.js';
import {
  requestRide,
  acceptRide,
  startRide,
  updateRideLocation,
  completeRide,
  cancelRide,
  rateRide,
  getRideDetails,
  getRideHistory,
  getScheduledRides,
  getFareEstimate,
  updateDriverAvailability,
  getActiveRides,
  getRideStats,
  triggerSOSAlert,
} from '../controllers/ride.controller.js';

const router = express.Router();

router.get('/estimate', getFareEstimate);

router.use(authenticate);

router.post('/sos/alert', requireRole([USER_ROLES.PASSENGER, USER_ROLES.DRIVER]), validate(sosAlertSchema), triggerSOSAlert);

router.post('/request', requireRole([USER_ROLES.PASSENGER]), validate(rideRequestSchema), requestRide);

router.put('/driver/availability', requireRole([USER_ROLES.DRIVER]), updateDriverAvailability);

router.get('/history', getRideHistory);
router.get('/scheduled', requireRole([USER_ROLES.PASSENGER]), getScheduledRides);
router.get('/active', getActiveRides);
router.get('/stats', getRideStats);

router.put('/:id/accept', requireRole([USER_ROLES.DRIVER]), acceptRide);

router.put('/:id/start', requireRole([USER_ROLES.DRIVER]), uploadDriverPhoto, startRide);

router.put('/:id/location', requireRole([USER_ROLES.DRIVER]), updateRideLocation);

router.put('/:id/complete', requireRole([USER_ROLES.DRIVER]), completeRide);

router.post('/:id/cancel', requireRole([USER_ROLES.PASSENGER, USER_ROLES.DRIVER]), cancelRide);

router.post('/:id/rate', requireRole([USER_ROLES.PASSENGER, USER_ROLES.DRIVER]), rateRide);

router.get('/:id', getRideDetails);

export default router;
