import Notification from '../models/Notification.js';
import Admin from '../models/Admin.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Notify all admin users (for SOS, complaints, driver approvals, etc.)
 */
export const notifyAdmins = async (type, title, message, data = {}) => {
  try {
    const admins = await Admin.find({}).select('userId').lean();
    const userIds = admins.map((a) => a.userId).filter(Boolean);
    if (userIds.length === 0) return [];

    const notifications = await Promise.all(
      userIds.map((userId) =>
        Notification.create({ userId, type, title, message, data })
      )
    );
    logger.info(`Notified ${notifications.length} admin(s): ${title}`);
    return notifications;
  } catch (error) {
    logger.error('Notify admins error:', error);
    throw error;
  }
};

/**
 * Create a notification for a user
 */
export const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data,
    });
    return notification;
  } catch (error) {
    logger.error('Create notification error:', error);
    throw error;
  }
};

/**
 * Get notifications for a user (paginated)
 */
export const getUserNotifications = async (userId, page = 1, limit = 20, unreadOnly = false) => {
  const query = { userId };
  if (unreadOnly) query.isRead = false;

  const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(50, Math.max(1, limit)))
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return { notifications, total, unreadCount };
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId,
  });

  if (!notification) return null;

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
};

/**
 * Get unread notification count for a user
 */
export const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return count;
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result;
};
