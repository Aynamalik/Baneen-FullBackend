import voiceService from '../services/voice.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Process voice input from audio file
 */
export const processVoice = async (req, res) => {
  try {
    const { language = 'en-US' } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return sendError(res, 'Audio file is required', 400);
    }

    // Validate audio file
    voiceService.validateAudio(audioFile.buffer);

    // Process voice input
    const voiceResult = await voiceService.processVoiceInput(audioFile.buffer, language);

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
    logger.error('Voice processing error:', error);
    return sendError(res, error.message || 'Failed to process voice input', 500);
  }
};

/**
 * Get supported voice commands
 */
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

/**
 * Test voice processing with text input (for development)
 */
export const testVoiceWithText = async (req, res) => {
  try {
    const { text, language = 'en-US' } = req.body;

    if (!text) {
      return sendError(res, 'Text input is required', 400);
    }

    // Create mock voice result from text
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