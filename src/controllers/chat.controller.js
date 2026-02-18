import {
  getOtherParticipant,
  getRideMessages as getRideMessagesService,
  sendMessage as sendMessageService,
  markMessageAsRead,
} from '../services/chat.service.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * GET /chat/rides/:rideId/messages - Get chat messages for a ride
 */
export const getRideMessages = async (req, res) => {
  try {
    const { rideId } = req.params;
    const userId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;

    const { messages, total } = await getRideMessagesService(
      rideId,
      userId,
      parseInt(page),
      parseInt(limit)
    );

    return sendPaginated(res, messages, {
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
      total,
    });
  } catch (error) {
    logger.error('Get ride messages error:', error);
    return sendError(
      res,
      error.message || 'Failed to get messages',
      error.message?.includes('not a participant') ? 403 : 500
    );
  }
};

/**
 * POST /chat/rides/:rideId/messages - Send a chat message
 */
export const sendMessage = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { message, type = 'text' } = req.body;
    const senderId = req.user.userId;

    if (!message || !message.trim()) {
      return sendError(res, 'Message is required', 400);
    }

    if (message.length > 2000) {
      return sendError(res, 'Message too long. Maximum 2000 characters.', 400);
    }

    const validTypes = ['text', 'image', 'location'];
    if (!validTypes.includes(type)) {
      return sendError(res, 'Invalid message type', 400);
    }

    const receiverId = await getOtherParticipant(rideId, senderId);
    if (!receiverId) {
      return sendError(res, 'You are not a participant in this ride', 403);
    }

    const chatMessage = await sendMessageService(
      rideId,
      senderId,
      receiverId,
      message.trim(),
      type
    );

    return sendSuccess(res, chatMessage, 'Message sent successfully', 201);
  } catch (error) {
    logger.error('Send message error:', error);
    return sendError(
      res,
      error.message || 'Failed to send message',
      error.message?.includes('not a participant') ? 403 : 500
    );
  }
};

/**
 * PUT /chat/messages/:id/read - Mark message as read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const message = await markMessageAsRead(id, userId);

    return sendSuccess(res, message, 'Message marked as read');
  } catch (error) {
    logger.error('Mark message read error:', error);
    return sendError(
      res,
      error.message || 'Failed to mark message as read',
      error.message?.includes('not found') ? 404 : 500
    );
  }
};
