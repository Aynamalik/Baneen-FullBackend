import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { processVoice, getVoiceCommands, testVoiceWithText } from '../controllers/voice.controller.js';
import { handleUploads } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/process', handleUploads([{ name: 'audio', maxCount: 1 }]), processVoice);
router.get('/commands', getVoiceCommands);
router.post('/test', testVoiceWithText);

export default router;