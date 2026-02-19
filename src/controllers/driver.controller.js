import mongoose from 'mongoose';
import User from '../models/User.js';
import Driver from '../models/Driver.js';
import Ride from '../models/Ride.js';
import Vehicle from '../models/Vehicle.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { DRIVER_AVAILABILITY } from '../config/constants.js';
import logger from '../utils/logger.js';

export const getProfile = async (req, res) => {
  try {
    const driverId = req.user.userId;

    const driver = await Driver.findOne({ userId: driverId })
      .populate('userId', 'email phone role isVerified cnicImage')
      .populate('vehicle.vehicleId');

    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }

    return sendSuccess(res, {
      driver: {
        _id: driver._id,
        name: driver.name,
        licenseNumber: driver.licenseNumber,
        licenseImage: driver.licenseImage,
        vehicle: driver.vehicle,
        availability: driver.availability,
        rating: driver.rating,
        totalRides: driver.totalRides,
        completedRides: driver.completedRides,
        cancelledRides: driver.cancelledRides,
        earnings: driver.earnings,
        isApproved: driver.isApproved,
        approvedAt: driver.approvedAt,
        status: driver.status,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      },
      user: driver.userId,
    }, 'Profile retrieved successfully');
  } catch (error) {
    logger.error('Get driver profile error:', error);
    return sendError(res, 'Failed to get profile', 500);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { name } = req.body;

    const driver = await Driver.findOneAndUpdate(
      { userId: driverId },
      { name },
      { new: true, runValidators: true }
    ).populate('userId', 'email phone role isVerified');

    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }

    return sendSuccess(res, {
      driver: {
        _id: driver._id,
        name: driver.name,
        licenseNumber: driver.licenseNumber,
        licenseImage: driver.licenseImage,
        vehicle: driver.vehicle,
        availability: driver.availability,
        rating: driver.rating,
        totalRides: driver.totalRides,
        earnings: driver.earnings,
        isApproved: driver.isApproved,
        status: driver.status,
      },
      user: driver.userId,
    }, 'Profile updated successfully');
  } catch (error) {
    logger.error('Update driver profile error:', error);
    return sendError(res, 'Failed to update profile', 500);
  }
};

export const updateAvailability = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { status, latitude, longitude, address } = req.body;

    if (!Object.values(DRIVER_AVAILABILITY).includes(status)) {
      return sendError(res, 'Invalid availability status', 400);
    }

    const location = latitude && longitude ? { latitude, longitude, address } : null;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }

    if (!driver.isApproved) {
      return sendError(res, 'Driver is not approved yet', 403);
    }

  
    driver.updateAvailability(status, location);
    await driver.save();

    return sendSuccess(res, {
      availability: driver.availability,
      status: driver.status
    }, 'Availability updated successfully');
  } catch (error) {
    logger.error('Update availability error:', error);
    return sendError(res, 'Failed to update availability', 500);
  }
};

export const registerVehicle = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const {
      registrationNumber,
      model,
      year,
      color,
      policyNumber,
      insuranceExpiry,
      insuranceDocument
    } = req.body;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }


    const vehicleData = {
      registrationNumber,
      model,
      year: parseInt(year),
      color,
      insurance: {
        policyNumber,
        expiryDate: insuranceExpiry ? new Date(insuranceExpiry) : null,
        document: insuranceDocument,
      }
    };

    if (driver.vehicle.vehicleId) {
    
      await Vehicle.findByIdAndUpdate(driver.vehicle.vehicleId, vehicleData);
    } else {
      // Create new vehicle
      const vehicle = await Vehicle.create({
        ...vehicleData,
        driverId: driver._id,
      });
      driver.vehicle.vehicleId = vehicle._id;
    }

    driver.vehicle = {
      ...driver.vehicle,
      ...vehicleData
    };

    await driver.save();

    return sendSuccess(res, {
      vehicle: driver.vehicle
    }, 'Vehicle registered successfully');
  } catch (error) {
    logger.error('Register vehicle error:', error);
    return sendError(res, 'Failed to register vehicle', 500);
  }
};


export const updateVehicle = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const vehicleId = req.params.id;
    const updateData = req.body;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver || driver.vehicle.vehicleId?.toString() !== vehicleId) {
      return sendError(res, 'Vehicle not found or access denied', 404);
    }

    // Update vehicle in Vehicle collection
    const vehicle = await Vehicle.findByIdAndUpdate(vehicleId, updateData, { new: true });

    // Update driver's vehicle cache
    if (vehicle) {
      driver.vehicle = {
        vehicleId: vehicle._id,
        registrationNumber: vehicle.registrationNumber,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        insurance: vehicle.insurance,
      };
      await driver.save();
    }

    return sendSuccess(res, {
      vehicle: driver.vehicle
    }, 'Vehicle updated successfully');
  } catch (error) {
    logger.error('Update vehicle error:', error);
    return sendError(res, 'Failed to update vehicle', 500);
  }
};


export const getRideHistory = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query = { driverId };
    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .populate('passengerId', 'name rating')
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
    const driverId = req.user.userId;
    const rideId = req.params.id;

    const ride = await Ride.findOne({
      _id: rideId,
      driverId
    })
    .populate('passengerId', 'name phone rating')
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


export const getEarnings = async (req, res) => {
  try {
    const driverId = req.user.userId;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }

    // Get earnings breakdown by time period
    const [
      todayEarnings,
      weekEarnings,
      monthEarnings,
      totalEarnings
    ] = await Promise.all([
      // Today's earnings
      Ride.aggregate([
        {
          $match: {
            driverId: mongoose.Types.ObjectId(driverId),
            status: 'completed',
            completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          }
        },
        { $group: { _id: null, total: { $sum: '$fare.final' } } }
      ]),

      Ride.aggregate([
        {
          $match: {
            driverId: mongoose.Types.ObjectId(driverId),
            status: 'completed',
            completedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        { $group: { _id: null, total: { $sum: '$fare.final' } } }
      ]),

      // This month's earnings
      Ride.aggregate([
        {
          $match: {
            driverId: mongoose.Types.ObjectId(driverId),
            status: 'completed',
            completedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
          }
        },
        { $group: { _id: null, total: { $sum: '$fare.final' } } }
      ]),

      // Total earnings
      Ride.aggregate([
        {
          $match: {
            driverId: mongoose.Types.ObjectId(driverId),
            status: 'completed'
          }
        },
        { $group: { _id: null, total: { $sum: '$fare.final' } } }
      ]),
    ]);

    return sendSuccess(res, {
      earnings: {
        today: todayEarnings[0]?.total || 0,
        thisWeek: weekEarnings[0]?.total || 0,
        thisMonth: monthEarnings[0]?.total || 0,
        total: totalEarnings[0]?.total || 0,
        pending: driver.earnings.pending,
        withdrawn: driver.earnings.withdrawn,
      }
    }, 'Earnings retrieved successfully');
  } catch (error) {
    logger.error('Get earnings error:', error);
    return sendError(res, 'Failed to get earnings', 500);
  }
};

export const getDriverStats = async (req, res) => {
  try {
    const driverId = req.user.userId;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }

    const [
      totalRides,
      completedRides,
      cancelledRides,
      thisMonthRides,
      thisWeekRides
    ] = await Promise.all([
      Ride.countDocuments({ driverId }),
      Ride.countDocuments({ driverId, status: 'completed' }),
      Ride.countDocuments({ driverId, status: 'cancelled' }),
      Ride.countDocuments({
        driverId,
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      Ride.countDocuments({
        driverId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
    ]);

    const acceptedRides = await Ride.countDocuments({
      driverId,
      status: { $in: ['accepted', 'in-progress', 'completed'] }
    });

    const acceptanceRate = totalRides > 0 ? (acceptedRides / totalRides) * 100 : 0;

    return sendSuccess(res, {
      stats: {
        totalRides,
        completedRides,
        cancelledRides,
        thisMonthRides,
        thisWeekRides,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        rating: driver.rating,
        isApproved: driver.isApproved,
        status: driver.status,
        availability: driver.availability.status,
      }
    }, 'Driver statistics retrieved successfully');
  } catch (error) {
    logger.error('Get driver stats error:', error);
    return sendError(res, 'Failed to get statistics', 500);
  }
};

export const getEarningsStats = async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { period = 'month' } = req.query; // day, week, month, year

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }

    let dateFilter;
    const now = new Date();

    switch (period) {
      case 'day':
        dateFilter = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        dateFilter = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const earnings = await Ride.aggregate([
      {
        $match: {
          driverId: mongoose.Types.ObjectId(driverId),
          status: 'completed',
          completedAt: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' }
          },
          amount: { $sum: '$fare.final' },
          rides: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    return sendSuccess(res, {
      period,
      earnings: earnings.map(item => ({
        date: item._id,
        amount: item.amount,
        rides: item.rides
      })),
      summary: {
        totalEarnings: earnings.reduce((sum, item) => sum + item.amount, 0),
        totalRides: earnings.reduce((sum, item) => sum + item.rides, 0),
        averagePerRide: earnings.length > 0 ?
          earnings.reduce((sum, item) => sum + item.amount, 0) /
          earnings.reduce((sum, item) => sum + item.rides, 0) : 0
      }
    }, 'Earnings statistics retrieved successfully');
  } catch (error) {
    logger.error('Get earnings stats error:', error);
    return sendError(res, 'Failed to get earnings statistics', 500);
  }
};

export const setOnline = async (req, res) => {
  try {
    const driverId = req.user.userId;

    const driver = await Driver.findOne({ userId: driverId });
    if (!driver) {
      return sendError(res, 'Driver profile not found', 404);
    }
    driver.updateAvailability(DRIVER_AVAILABILITY.AVAILABLE);
    await driver.save();

    return sendSuccess(res, {
      availability: driver.availability,
      status: driver.status
    }, 'Driver is now online');
  } catch (error) {
    logger.error('Set online error:', error);
    return sendError(res, 'Failed to set driver online', 500);
  }
};