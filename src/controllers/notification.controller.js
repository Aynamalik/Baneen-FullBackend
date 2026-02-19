import {
  getUserNotifications,
  markAsRead as markNotificationAsRead,
  markAllAsRead as markAllNotificationsAsRead,
} from '../services/notification.service.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import logger from '../utils/logger.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly } = req.query;

    const { notifications, total, unreadCount } = await getUserNotifications(
      userId,
      parseInt(page),
      parseInt(limit),
      unreadOnly === 'true'
    );

    return res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
      meta: {
        page: Math.max(1, parseInt(page)),
        limit: Math.min(50, Math.max(1, parseInt(limit))),
        total,
        totalPages: Math.ceil(total / Math.min(50, Math.max(1, parseInt(limit)))),
        unreadCount,
      },
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    return sendError(res, 'Failed to get notifications', 500);
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await markNotificationAsRead(id, userId);

    if (!notification) {
      return sendError(res, 'Notification not found', 404);
    }

    return sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) {
    logger.error('Mark notification read error:', error);
    return sendError(res, 'Failed to mark notification as read', 500);
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await markAllNotificationsAsRead(userId);

    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    return sendError(res, 'Failed to mark all notifications as read', 500);
  }
};
