import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { USER_ROLES } from '../config/constants.js';
import {
  processMessage,
  getConversationHistory,
  getHelpTopics,
  clearConversationHistory,
  getChatbotAnalytics
} from '../controllers/chatbot.controller.js';

const router = express.Router();

router.use(authenticate);

router.post('/message', processMessage);
router.get('/history', getConversationHistory);
router.get('/help', getHelpTopics);
router.delete('/history', clearConversationHistory);

router.get('/analytics', requireRole([USER_ROLES.ADMIN]), getChatbotAnalytics);

export default router;