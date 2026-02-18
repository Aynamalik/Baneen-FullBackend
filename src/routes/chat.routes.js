import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  getRideMessages,
  sendMessage,
  markAsRead,
} from '../controllers/chat.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole([USER_ROLES.PASSENGER, USER_ROLES.DRIVER]));

router.get('/rides/:rideId/messages', getRideMessages);
router.post('/rides/:rideId/messages', sendMessage);
router.put('/messages/:id/read', markAsRead);

export default router;
