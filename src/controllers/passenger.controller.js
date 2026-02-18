import mongoose from 'mongoose';
import User from '../models/User.js';
import Passenger from '../models/Passenger.js';
import Ride from '../models/Ride.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const getProfile = async (req, res) => {
  try {
    const passengerId = req.user.userId;

    const passenger = await Passenger.findOne({ userId: passengerId })
      .populate('userId', 'email phone role isVerified cnicImage')
      .populate('subscription.planId', 'name price ridesIncluded validityDays');

    if (!passenger) {
      return sendError(res, 'Passenger profile not found', 404);
    }

    return sendSuccess(res, {
      passenger: {
        _id: passenger._id,
        name: passenger.name,
        emergencyContacts: passenger.emergencyContacts,
        subscription: passenger.subscription,
        rating: passenger.rating,
        totalRides: passenger.totalRides,
        cnicImage: passenger.cnicImage,
        createdAt: passenger.createdAt,
        updatedAt: passenger.updatedAt,
      },
      user: passenger.userId,
    }, 'Profile retrieved successfully');
  } catch (error) {
    logger.error('Get passenger profile error:', error);
    return sendError(res, 'Failed to get profile', 500);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const passengerId = req.user.userId;
    const { name } = req.body;

    const passenger = await Passenger.findOneAndUpdate(
      { userId: passengerId },
      { name },
      { new: true, runValidators: true }
    ).populate('userId', 'email phone role isVerified');

    if (!passenger) {
      return sendError(res, 'Passenger profile not found', 404);
    }

    return sendSuccess(res, {
      passenger: {
        _id: passenger._id,
        name: passenger.name,
        emergencyContacts: passenger.emergencyContacts,
        subscription: passenger.subscription,
        rating: passenger.rating,
        totalRides: passenger.totalRides,
        cnicImage: passenger.cnicImage,
      },
      user: passenger.userId,
    }, 'Profile updated successfully');
  } catch (error) {
    logger.error('Update passenger profile error:', error);
    return sendError(res, 'Failed to update profile', 500);
  }
};

export const addEmergencyContact = async (req, res) => {
  try {
    const passengerId = req.user.userId;
    const { name, phone, relationship } = req.body;

    if (!phone || !relationship) {
      return sendError(res, 'Phone and relationship are required', 400);
    }

    const passenger = await Passenger.findOneAndUpdate(
      { userId: passengerId },
      {
        $push: {
          emergencyContacts: { name, phone, relationship }
        }
      },
      { new: true, runValidators: true }
    );

    if (!passenger) {
      return sendError(res, 'Passenger profile not found', 404);
    }

    return sendSuccess(res, {
      emergencyContacts: passenger.emergencyContacts
    }, 'Emergency contact added successfully');
  } catch (error) {
    logger.error('Add emergency contact error:', error);
    return sendError(res, 'Failed to add emergency contact', 500);
  }
};

/**
 * Update emergency contact
 */
export const updateEmergencyContact = async (req, res) => {
  try {
    const passengerId = req.user.userId;
    const contactId = req.params.id;
    const { name, phone, relationship } = req.body;

    const passenger = await Passenger.findOneAndUpdate(
      {
        userId: passengerId,
        'emergencyContacts._id': contactId
      },
      {
        $set: {
          'emergencyContacts.$.name': name,
          'emergencyContacts.$.phone': phone,
          'emergencyContacts.$.relationship': relationship,
        }
      },
      { new: true, runValidators: true }
    );

    if (!passenger) {
      return sendError(res, 'Emergency contact not found', 404);
    }

    return sendSuccess(res, {
      emergencyContacts: passenger.emergencyContacts
    }, 'Emergency contact updated successfully');
  } catch (error) {
    logger.error('Update emergency contact error:', error);
    return sendError(res, 'Failed to update emergency contact', 500);
  }
};


export const deleteEmergencyContact = async (req, res) => {
  try {
    const passengerId = req.user.userId;
    const contactId = req.params.id;

    const passenger = await Passenger.findOneAndUpdate(
      { userId: passengerId },
      {
        $pull: {
          emergencyContacts: { _id: contactId }
        }
      },
      { new: true }
    );

    if (!passenger) {
      return sendError(res, 'Passenger profile not found', 404);
    }

    return sendSuccess(res, {
      emergencyContacts: passenger.emergencyContacts
    }, 'Emergency contact deleted successfully');
  } catch (error) {
    logger.error('Delete emergency contact error:', error);
    return sendError(res, 'Failed to delete emergency contact', 500);
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const passengerId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query = { passengerId };
    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .populate('driverId', 'name rating')
      .populate('vehicle', 'model registrationNumber')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('pickup destination status fare payment createdAt completedAt rating');

    const total = await Ride.countDocuments(query);

    return sendSuccess(res, {
      rides,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRides: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    }, 'Ride history retrieved successfully');
  } catch (error) {
    logger.error('Get ride history error:', error);
    return sendError(res, 'Failed to get ride history', 500);
  }
};

export const getRideDetails = async (req, res) => {
  try {
    const passengerId = req.user.userId;
    const rideId = req.params.id;

    const ride = await Ride.findOne({
      _id: rideId,
      passengerId
    })
    .populate('driverId', 'name phone rating')
    .populate('vehicle', 'model registrationNumber color')
    .populate('payment');

    if (!ride) {
      return sendError(res, 'Ride not found', 404);
    }

    return sendSuccess(res, { ride }, 'Ride details retrieved successfully');
  } catch (error) {
    logger.error('Get ride details error:', error);
    return sendError(res, 'Failed to get ride details', 500);
  }
};

export const getSubscriptionStatus = async (req, res) => {
  try {
    const passengerId = req.user.userId;

    const passenger = await Passenger.findOne({ userId: passengerId })
      .populate('subscription.planId', 'name description price ridesIncluded validityDays isActive');

    if (!passenger) {
      return sendError(res, 'Passenger profile not found', 404);
    }

    return sendSuccess(res, {
      subscription: passenger.subscription
    }, 'Subscription status retrieved successfully');
  } catch (error) {
    logger.error('Get subscription status error:', error);
    return sendError(res, 'Failed to get subscription status', 500);
  }
};

export const getPassengerStats = async (req, res) => {
  try {
    const passengerId = req.user.userId;

    const passenger = await Passenger.findOne({ userId: passengerId });

    if (!passenger) {
      return sendError(res, 'Passenger profile not found', 404);
    }

    const [
      totalRides,
      completedRides,
      cancelledRides,
      thisMonthRides,
      thisWeekRides
    ] = await Promise.all([
      Ride.countDocuments({ passengerId }),
      Ride.countDocuments({ passengerId, status: 'completed' }),
      Ride.countDocuments({ passengerId, status: 'cancelled' }),
      Ride.countDocuments({
        passengerId,
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      Ride.countDocuments({
        passengerId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
    ]);

    
    const totalSpentResult = await Ride.aggregate([
      { $match: { passengerId: mongoose.Types.ObjectId(passengerId), status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$fare.final' } } }
    ]);

    const totalSpent = totalSpentResult[0]?.total || 0;

    return sendSuccess(res, {
      stats: {
        totalRides,
        completedRides,
        cancelledRides,
        thisMonthRides,
        thisWeekRides,
        totalSpent,
        rating: passenger.rating,
      }
    }, 'Passenger statistics retrieved successfully');
  } catch (error) {
    logger.error('Get passenger stats error:', error);
    return sendError(res, 'Failed to get statistics', 500);
  }
};