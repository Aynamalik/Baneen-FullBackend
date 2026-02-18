import ChatMessage from '../models/ChatMessage.js';
import Ride from '../models/Ride.js';
import logger from '../utils/logger.js';

/**
 * Get the other participant's userId for a ride
 * Chat is only available once driver is assigned
 */
export const getOtherParticipant = async (rideId, currentUserId) => {
  const ride = await Ride.findById(rideId)
    .populate('passengerId', 'userId')
    .populate('driverId', 'userId')
    .lean();

  if (!ride || !ride.passengerId || !ride.driverId) return null;

  const passengerUserId = ride.passengerId.userId
    ? (typeof ride.passengerId.userId === 'object' ? ride.passengerId.userId.toString() : ride.passengerId.userId)
    : null;
  const driverUserId = ride.driverId.userId
    ? (typeof ride.driverId.userId === 'object' ? ride.driverId.userId.toString() : ride.driverId.userId)
    : null;
  const currentUserIdStr = currentUserId.toString();

  if (passengerUserId === currentUserIdStr) return driverUserId;
  if (driverUserId === currentUserIdStr) return passengerUserId;

  return null;
};

/**
 * Check if user is a participant in the ride
 */
export const isRideParticipant = async (rideId, userId) => {
  const other = await getOtherParticipant(rideId, userId);
  return other !== null;
};

/**
 * Send a chat message
 */
export const sendMessage = async (rideId, senderId, receiverId, message, type = 'text') => {
  const chatMessage = await ChatMessage.create({
    rideId,
    senderId,
    receiverId,
    message,
    type,
  });

  return chatMessage.populate([
    { path: 'senderId', select: 'email phone' },
    { path: 'receiverId', select: 'email phone' },
  ]);
};

/**
 * Get messages for a ride (paginated)
 */
export const getRideMessages = async (rideId, userId, page = 1, limit = 50) => {
  const isParticipant = await isRideParticipant(rideId, userId);
  if (!isParticipant) {
    throw new Error('You are not a participant in this ride');
  }

  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));

  const [messages, total] = await Promise.all([
    ChatMessage.find({ rideId })
      .populate('senderId', 'email phone')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Math.min(100, Math.max(1, limit)))
      .lean(),
    ChatMessage.countDocuments({ rideId }),
  ]);

  return { messages, total };
};

/**
 * Mark message as read
 */
export const markMessageAsRead = async (messageId, userId) => {
  const msg = await ChatMessage.findById(messageId);
  if (!msg) throw new Error('Message not found');
  if (msg.receiverId.toString() !== userId.toString()) {
    throw new Error('You can only mark messages sent to you as read');
  }

  msg.isRead = true;
  msg.readAt = new Date();
  await msg.save();
  return msg;
};
