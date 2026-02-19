import voiceService from '../services/voice.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const processVoice = async (req, res) => {
  try {
    const { language = 'en-US' } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return sendError(res, 'Audio file is required', 400);
    }

  
    voiceService.validateAudio(audioFile.buffer);

  
    const voiceResult = await voiceService.processVoiceInput(audioFile.buffer, language);

  
    const userId = req.user.userId;
    const userRole = req.user.role;
    const actionResult = await voiceService.executeVoiceAction(
      voiceResult.intent,
      voiceResult.entities,
      userId,
      userRole
    );

    return sendSuccess(res, {
      transcript: voiceResult.transcript,
      intent: voiceResult.intent,
      entities: voiceResult.entities,
      confidence: voiceResult.confidence,
      action: actionResult
    }, 'Voice command processed successfully');

  } catch (error) {
    logger.error('Voice processing error:', error);
    return sendError(res, error.message || 'Failed to process voice input', 500);
  }
};

export const getVoiceCommands = async (req, res) => {
  try {
    const { language = 'en-US' } = req.query;

    const commands = voiceService.getSupportedCommands(language);

    return sendSuccess(res, {
      language,
      commands,
      supportedLanguages: voiceService.supportedLanguages
    }, 'Voice commands retrieved successfully');

  } catch (error) {
    logger.error('Get voice commands error:', error);
    return sendError(res, 'Failed to get voice commands', 500);
  }
};


export const testVoiceWithText = async (req, res) => {
  try {
    const { text, language = 'en-US' } = req.body;

    if (!text) {
      return sendError(res, 'Text input is required', 400);
    }

    
    const voiceResult = {
      success: true,
      transcript: text,
      intent: voiceService.extractIntent(text),
      entities: voiceService.extractEntities(text),
      confidence: 1.0,
      language
    };

    // Execute the voice action
    const userId = req.user.userId;
    const userRole = req.user.role;
    const actionResult = await voiceService.executeVoiceAction(
      voiceResult.intent,
      voiceResult.entities,
      userId,
      userRole
    );

    return sendSuccess(res, {
      transcript: voiceResult.transcript,
      intent: voiceResult.intent,
      entities: voiceResult.entities,
      confidence: voiceResult.confidence,
      action: actionResult
    }, 'Voice command processed successfully');

  } catch (error) {
    logger.error('Voice test error:', error);
    return sendError(res, error.message || 'Failed to process voice command', 500);
  }
};