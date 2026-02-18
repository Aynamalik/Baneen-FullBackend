import chatbotService from '../services/chatbot.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const processMessage = async (req, res) => {
  try {
    const { message, context = {} } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (!message || message.trim().length === 0) {
      return sendError(res, 'Message is required', 400);
    }

    if (message.length > 1000) {
      return sendError(res, 'Message too long. Maximum 1000 characters allowed.', 400);
    }

    const result = await chatbotService.processMessage(message, userId, userRole, context);

    return sendSuccess(res, {
      response: result.response,
      intent: result.intent,
      entities: result.entities,
      confidence: result.confidence,
      suggestedActions: result.suggestedActions
    }, 'Message processed successfully');

  } catch (error) {
    logger.error('Chatbot message processing error:', error);
    return sendError(res, error.message || 'Failed to process message', 500);
  }
};

export const getConversationHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;

    const history = chatbotService.getConversationContext(userId)
      .slice(-limit) 
      .map(item => ({
        message: item.lastMessage,
        intent: item.lastIntent,
        timestamp: item.timestamp,
        context: item.context
      }));

    return sendSuccess(res, {
      history,
      total: history.length
    }, 'Conversation history retrieved successfully');

  } catch (error) {
    logger.error('Get conversation history error:', error);
    return sendError(res, 'Failed to get conversation history', 500);
  }
};

export const getHelpTopics = async (req, res) => {
  try {
    const topics = chatbotService.getHelpTopics();

    return sendSuccess(res, { topics }, 'Help topics retrieved successfully');

  } catch (error) {
    logger.error('Get help topics error:', error);
    return sendError(res, 'Failed to get help topics', 500);
  }
};

export const clearConversationHistory = async (req, res) => {
  try {
    const userId = req.user.userId;

    chatbotService.conversationHistory.delete(userId);

    return sendSuccess(res, null, 'Conversation history cleared successfully');

  } catch (error) {
    logger.error('Clear conversation history error:', error);
    return sendError(res, 'Failed to clear conversation history', 500);
  }
};

export const getChatbotAnalytics = async (req, res) => {
  try {
  
    const totalConversations = chatbotService.conversationHistory.size;
    const totalMessages = Array.from(chatbotService.conversationHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    const intentCounts = {};
    for (const [userId, history] of chatbotService.conversationHistory.entries()) {
      for (const message of history) {
        const intent = message.lastIntent || 'UNKNOWN';
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      }
    }

    return sendSuccess(res, {
      analytics: {
        totalConversations,
        totalMessages,
        intentDistribution: intentCounts,
        activeUsers: totalConversations
      }
    }, 'Chatbot analytics retrieved successfully');

  } catch (error) {
    logger.error('Get chatbot analytics error:', error);
    return sendError(res, 'Failed to get chatbot analytics', 500);
  }
};