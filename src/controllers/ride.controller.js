import {
  requestRideService,
  acceptRideService,
  startRideService,
  updateRideLocationService,
  completeRideService,
  cancelRideService,
  rateRideService,
  getRideDetailsService,
  getRideHistoryService,
  getFareEstimateService,
  updateDriverAvailabilityService
} from '../services/ride.service.js';
import { triggerSOSAlertService } from '../services/sos.service.js';
import { geocodeAddress } from '../services/maps.service.js';
import { USER_ROLES } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/response.js';
import cancellationService from '../services/cancellation.service.js';
import logger from '../utils/logger.js';

export const triggerSOSAlert = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    if (userRole !== USER_ROLES.PASSENGER && userRole !== USER_ROLES.DRIVER) {
      return sendError(res, 'Only passengers and drivers can trigger SOS alerts', 403);
    }

    const result = await triggerSOSAlertService(userId, userRole, req.body);

    return sendSuccess(res, result, 'SOS alert triggered. Help has been notified.', 201);
  } catch (error) {
    logger.error('SOS alert error:', error);
    return sendError(res, error.message || 'Failed to trigger SOS alert', 400);
  }
};

export const requestRide = async (req, res) => {
  try {
    const userId = req.user.userId;
    const rideData = req.body;

    const result = await requestRideService(userId, rideData);

    return sendSuccess(res, result, 'Ride requested successfully', 201);

  } catch (error) {
    logger.error('Ride request error:', error);
    return sendError(res, error.message || 'Failed to request ride', 400);
  }
};

export const acceptRide = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { id: rideId } = req.params;

    if (req.user.role !== USER_ROLES.DRIVER) {
      return sendError(res, 'Only drivers can accept rides', 403);
    }

    const result = await acceptRideService(driverId, rideId);

    return sendSuccess(res, result, 'Ride accepted successfully');

  } catch (error) {
    logger.error('Ride accept error:', error);
    return sendError(res, error.message || 'Failed to accept ride', 400);
  }
};

export const startRide = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { id: rideId } = req.params;

    let startCoords = req.body.startCoords;
    if (typeof startCoords === 'string') {
      try {
        startCoords = JSON.parse(startCoords);
      } catch (parseError) {
        return sendError(res, 'Invalid start coordinates format', 400);
      }
    }


    if (req.user.role !== USER_ROLES.DRIVER) {
      return sendError(res, 'Only drivers can start rides', 403);
    }

    if (!startCoords || !startCoords.latitude || !startCoords.longitude) {
      return sendError(res, 'Start coordinates are required', 400);
    }


    if (!req.file) {
      return sendError(res, 'Driver photo is required to start the ride', 400);
    }

    const result = await startRideService(driverId, rideId, startCoords, req.file);

    return sendSuccess(res, result, 'Ride started successfully');

  } catch (error) {
    logger.error('Ride start error:', error);
    return sendError(res, error.message || 'Failed to start ride', 400);
  }
};

export const updateRideLocation = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { id: rideId } = req.params;
    const locationData = req.body;

    // Validate driver role
    if (req.user.role !== USER_ROLES.DRIVER) {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can update ride location'
      });
    }

    if (!locationData.latitude || !locationData.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }

    const result = await updateRideLocationService(driverId, rideId, locationData);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: result
    });

  } catch (error) {
    logger.error('Location update error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const completeRide = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { id: rideId } = req.params;
    const { endCoords, finalDistance, finalDuration } = req.body;

    
    if (req.user.role !== USER_ROLES.DRIVER) {
      return sendError(res, 'Only drivers can complete rides', 403);
    }

    if (!endCoords || !endCoords.latitude || !endCoords.longitude) {
      return sendError(res, 'End coordinates are required', 400);
    }

    const result = await completeRideService(driverId, rideId, {
      endCoords,
      finalDistance,
      finalDuration
    });

    return sendSuccess(res, result, 'Ride completed successfully');

  } catch (error) {
    logger.error('Ride completion error:', error);
    return sendError(res, error.message || 'Failed to complete ride', 400);
  }
};

export const cancelRide = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { id: rideId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return sendError(res, 'Cancellation reason is required', 400);
    }

  
    const cancellationResult = await cancellationService.processCancellation(
      rideId,
      userRole === USER_ROLES.DRIVER ? 'driver' : 'passenger',
      reason
    );

    if (!cancellationResult.success) {
      return sendError(res, cancellationResult.reason, 400);
    }

    const result = await cancelRideService(userId, userRole, rideId, { reason });

    return sendSuccess(res, {
      ride: result,
      cancellationFee: cancellationResult.fee,
      feeBreakdown: cancellationResult.breakdown,
      policy: cancellationResult.policy
    }, 'Ride cancelled successfully');

  } catch (error) {
    logger.error('Ride cancellation error:', error);
    return sendError(res, error.message || 'Failed to cancel ride', 400);
  }
};

export const rateRide = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { id: rideId } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const result = await rateRideService(userId, userRole, rideId, { rating, review });

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: result
    });

  } catch (error) {
    logger.error('Ride rating error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getRideDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { id: rideId } = req.params;

    const ride = await getRideDetailsService(userId, userRole, rideId);

    res.json({
      success: true,
      data: ride
    });

  } catch (error) {
    logger.error('Get ride details error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const filters = req.query;

    const result = await getRideHistoryService(userId, userRole, filters);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get ride history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ride history'
    });
  }
};

export const getFareEstimate = async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress } = req.query;

    let pickupCoords, dropoffCoords;

    if (pickupLat && pickupLng) {
      pickupCoords = {
        latitude: parseFloat(pickupLat),
        longitude: parseFloat(pickupLng)
      };
    } else if (pickupAddress) {
      
      const geocoded = await geocodeAddress(pickupAddress);
      pickupCoords = {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Pickup coordinates (pickupLat, pickupLng) or address (pickupAddress) is required'
      });
    }

    if (dropoffLat && dropoffLng) {
      dropoffCoords = {
        latitude: parseFloat(dropoffLat),
        longitude: parseFloat(dropoffLng)
      };
    } else if (dropoffAddress) {
      // Geocode address if coordinates not provided
      const geocoded = await geocodeAddress(dropoffAddress);
      dropoffCoords = {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Dropoff coordinates (dropoffLat, dropoffLng) or address (dropoffAddress) is required'
      });
    }

    const result = await getFareEstimateService(pickupCoords, dropoffCoords);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Fare estimate error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateDriverAvailability = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const availabilityData = req.body;

    // Validate driver role
    if (req.user.role !== USER_ROLES.DRIVER) {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can update their availability status'
      });
    }

    const result = await updateDriverAvailabilityService(driverId, availabilityData);

    res.json({
      success: true,
      message: 'Driver availability updated successfully',
      data: result
    });

  } catch (error) {
    logger.error('Driver availability update error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getActiveRides = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query = {
      status: { $in: ['pending', 'accepted', 'in-progress'] }
    };

    if (userRole === USER_ROLES.PASSENGER) {
      
      const Passenger = (await import('../models/Passenger.js')).default;
      const passenger = await Passenger.findOne({ userId });
      if (passenger) {
        query.passengerId = passenger._id;
      }
    } else if (userRole === USER_ROLES.DRIVER) {
      const Driver = (await import('../models/Driver.js')).default;
      const driver = await Driver.findOne({ userId });
      if (driver) {
        query.driverId = driver._id;
      }
    }

    const Ride = (await import('../models/Ride.js')).default;
    const rides = await Ride.find(query)
      .populate('passengerId', 'name rating')
      .populate('driverId', 'name rating vehicle')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: rides
    });

  } catch (error) {
    logger.error('Get active rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active rides'
    });
  }
};

export const getRideStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    const Ride = (await import('../models/Ride.js')).default;
    const Passenger = (await import('../models/Passenger.js')).default;
    const Driver = (await import('../models/Driver.js')).default;

    let userObjectId;

    if (userRole === USER_ROLES.PASSENGER) {
      const passenger = await Passenger.findOne({ userId });
      userObjectId = passenger?._id;
    } else if (userRole === USER_ROLES.DRIVER) {
      const driver = await Driver.findOne({ userId });
      userObjectId = driver?._id;
    }

    if (!userObjectId) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    const query = userRole === USER_ROLES.PASSENGER
      ? { passengerId: userObjectId }
      : { driverId: userObjectId };

    // Get ride statistics
    const stats = await Ride.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          completedRides: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledRides: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalSpent: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', 0] }
          },
          totalEarned: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', 0] }
          },
          averageRating: userRole === USER_ROLES.PASSENGER
            ? { $avg: '$rating.driverRating' }
            : { $avg: '$rating.passengerRating' }
        }
      }
    ]);

    const rideStats = stats[0] || {
      totalRides: 0,
      completedRides: 0,
      cancelledRides: 0,
      totalSpent: 0,
      totalEarned: 0,
      averageRating: 0
    };

    rideStats.completionRate = rideStats.totalRides > 0
      ? ((rideStats.completedRides / rideStats.totalRides) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: rideStats
    });

  } catch (error) {
    logger.error('Get ride stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ride statistics'
    });
  }
};