import mongoose from 'mongoose';
import User from '../models/User.js';
import Passenger from '../models/Passenger.js';
import Driver from '../models/Driver.js';
import Admin from '../models/Admin.js';
import Ride from '../models/Ride.js';
import Payment from '../models/Payment.js';
import Complaint from '../models/Complaint.js';
import SOSAlert from '../models/SOSAlert.js';
import Subscription from '../models/Subscription.js';
import SystemSettings from '../models/SystemSettings.js';
import AiInteraction from '../models/ChatbotAndVoiceLogs.js';
import logger from '../utils/logger.js';

export const getDashboardStats = async (req, res) => {
  try {
    // Get current date for filtering
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Parallel data fetching for better performance
    const [
      totalUsers,
      totalDrivers,
      totalPassengers,
      activeRides,
      pendingDrivers,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      completedRidesToday,
      cancelledRidesToday,
      activeSOSAlerts,
      pendingComplaints,
      newUsersToday,
      activeDriversCount
    ] = await Promise.all([
      // User statistics
      User.countDocuments(),
      Driver.countDocuments(),
      Passenger.countDocuments(),

      // Active rides
      Ride.countDocuments({
        status: { $in: ['pending', 'accepted', 'in-progress'] }
      }),

      // Pending driver approvals
      Driver.countDocuments({ isApproved: false }),

      // Revenue calculations
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfWeek, $lte: endOfWeek } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),

      // Ride statistics
      Ride.countDocuments({
        status: 'completed',
        completedAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      Ride.countDocuments({
        status: 'cancelled',
        cancelledAt: { $gte: startOfDay, $lte: endOfDay }
      }),

      // SOS and complaints
      SOSAlert.countDocuments({ status: 'active' }),
      Complaint.countDocuments({ status: 'pending' }),

      // New users today
      User.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),

      // Active drivers (drivers who have completed rides recently or are online)
      Driver.countDocuments({
        isApproved: true,
        // Consider drivers active if they have a recent ride or are marked as available
        $or: [
          { 'availability.isAvailable': true },
          {
            updatedAt: {
              $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Active in last 24 hours
            }
          }
        ]
      })
    ]);

    // Calculate total rides today
    const totalRidesToday = completedRidesToday + cancelledRidesToday;

    // Calculate growth percentages (simplified - you might want more complex logic)
    const stats = {
      totalUsers: totalUsers || 0,
      totalDrivers: totalDrivers || 0,
      totalPassengers: totalPassengers || 0,
      activeRides: activeRides || 0,
      pendingDrivers: pendingDrivers || 0,
      todayRevenue: todayRevenue[0]?.total || 0,
      monthlyRevenue: monthRevenue[0]?.total || 0,
      todayRides: totalRidesToday || 0,
      completedRidesToday: completedRidesToday || 0,
      cancelledRidesToday: cancelledRidesToday || 0,
      activeSOSAlerts: activeSOSAlerts || 0,
      pendingComplaints: pendingComplaints || 0,
      // Additional computed stats
      newUsersToday: newUsersToday || 0,
      activeDrivers: activeDriversCount || 0,
      completionRate: totalRidesToday > 0
        ? ((completedRidesToday / totalRidesToday) * 100).toFixed(1)
        : 0,
      recentActivity: [
        // TODO: Implement recent activity tracking with real data from database
        // This could include recent rides, user registrations, driver approvals, etc.
        // For now, returning empty array
      ]
    };

    logger.info('Admin dashboard stats retrieved');
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

/**
 * USER MANAGEMENT - Get all users with pagination and filters
 */
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      search,
      isVerified,
      isBlocked
    } = req.query;

    const query = {};

    // Apply filters
    if (role) query.role = role;
    if (status) query.isActive = status === 'active';
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';

    // Search functionality (User model has email, phone, cnic - not name)
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { cnic: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await User.countDocuments(query);

    // Enrich users with name from Passenger/Driver/Admin profile
    const userIds = users.map((u) => u._id);
    const [passengers, drivers, admins] = await Promise.all([
      Passenger.find({ userId: { $in: userIds } }).select('userId name').lean(),
      Driver.find({ userId: { $in: userIds } }).select('userId name').lean(),
      Admin.find({ userId: { $in: userIds } }).select('userId name').lean()
    ]);

    const profileMap = {};
    [...passengers, ...drivers, ...admins].forEach((p) => {
      profileMap[p.userId.toString()] = p.name;
    });

    const usersWithName = users.map((u) => ({
      ...u,
      name: profileMap[u._id.toString()] || u.email?.split('@')[0] || 'N/A'
    }));

    res.json({
      success: true,
      data: {
        users: usersWithName,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

/**
 * USER MANAGEMENT - Get specific user details
 */
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password -refreshToken');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get role-specific profile
    let profile = null;
    let rideStats = null;

    if (user.role === 'passenger') {
      profile = await Passenger.findOne({ userId: user._id });
      if (profile) {
        rideStats = await Ride.aggregate([
          { $match: { passengerId: profile._id } },
          {
            $group: {
              _id: null,
              totalRides: { $sum: 1 },
              completedRides: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              totalSpent: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', 0] } }
            }
          }
        ]);
      }
    } else if (user.role === 'driver') {
      profile = await Driver.findOne({ userId: user._id });
      if (profile) {
        rideStats = await Ride.aggregate([
          { $match: { driverId: profile._id } },
          {
            $group: {
              _id: null,
              totalRides: { $sum: 1 },
              completedRides: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              totalEarned: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', 0] } }
            }
          }
        ]);
      }
    }

    res.json({
      success: true,
      data: {
        user,
        profile,
        statistics: rideStats[0] || {
          totalRides: 0,
          completedRides: 0,
          totalSpent: 0,
          totalEarned: 0
        }
      }
    });

  } catch (error) {
    logger.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details'
    });
  }
};

/**
 * USER MANAGEMENT - Verify user account
 */
export const verifyUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isVerified = true;
    user.cnicVerificationStatus = 'verified';
    user.cnicVerifiedAt = new Date();
    await user.save();

    logger.info(`User ${id} verified by admin`);
    res.json({
      success: true,
      message: 'User verified successfully'
    });

  } catch (error) {
    logger.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify user'
    });
  }
};

/**
 * USER MANAGEMENT - Block user account
 */
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isBlocked = true;
    user.isActive = false;
    await user.save();

    // If driver, update availability
    if (user.role === 'driver') {
      await Driver.findOneAndUpdate(
        { userId: user._id },
        {
          'availability.status': 'offline',
          isActive: false
        }
      );
    }

    logger.info(`User ${id} blocked by admin. Reason: ${reason || 'No reason provided'}`);
    res.json({
      success: true,
      message: 'User blocked successfully'
    });

  } catch (error) {
    logger.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
};

/**
 * USER MANAGEMENT - Unblock user account
 */
export const unblockUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isBlocked = false;
    user.isActive = true;
    await user.save();

    // If driver, allow them to be active again
    if (user.role === 'driver') {
      await Driver.findOneAndUpdate(
        { userId: user._id },
        { isActive: true }
      );
    }

    logger.info(`User ${id} unblocked by admin`);
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });

  } catch (error) {
    logger.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
};

/**
 * USER MANAGEMENT - Delete user account
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete associated profiles and data
    if (user.role === 'passenger') {
      await Passenger.findOneAndDelete({ userId: user._id });
      await Ride.deleteMany({ passengerId: user._id });
    } else if (user.role === 'driver') {
      await Driver.findOneAndDelete({ userId: user._id });
      await Ride.updateMany({ driverId: user._id }, { driverId: null });
    }

    // Delete user
    await User.findByIdAndDelete(id);

    logger.info(`User ${id} deleted by admin`);
    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

/**
 * DRIVER MANAGEMENT - Get all drivers
 */
export const getAllDrivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const query = {};

    // Apply filters
    if (status === 'approved') query.isApproved = true;
    else if (status === 'pending') query.isApproved = false;
    else if (status === 'rejected') query.isApproved = false; // You might want a separate field for rejections

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } },
        { 'userId.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const drivers = await Driver.find(query)
      .populate('userId', 'name email phone isVerified isBlocked')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Driver.countDocuments(query);

    res.json({
      success: true,
      data: {
        drivers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get all drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers'
    });
  }
};

/**
 * DRIVER MANAGEMENT - Get driver by id (driver document id)
 */
export const getDriverDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findById(id).populate('userId', 'name email phone isVerified isBlocked cnic');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    const rideStats = await Ride.aggregate([
      { $match: { driverId: driver._id } },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          completedRides: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalEarned: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', 0] } }
        }
      }
    ]);
    res.json({
      success: true,
      data: {
        user: driver.userId,
        profile: driver,
        statistics: rideStats[0] || { totalRides: 0, completedRides: 0, totalEarned: 0 }
      }
    });
  } catch (error) {
    logger.error('Get driver details error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch driver details' });
  }
};

/**
 * DRIVER MANAGEMENT - Get pending driver approvals
 */
export const getPendingDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ isApproved: false })
      .populate('userId', 'name email phone cnic cnicImage')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: drivers
    });

  } catch (error) {
    logger.error('Get pending drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending drivers'
    });
  }
};

/**
 * DRIVER MANAGEMENT - Approve driver
 */
export const approveDriver = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    driver.isApproved = true;
    driver.approvedAt = new Date();
    await driver.save();

    logger.info(`Driver ${id} approved by admin`);
    res.json({
      success: true,
      message: 'Driver approved successfully'
    });

  } catch (error) {
    logger.error('Approve driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve driver'
    });
  }
};

/**
 * DRIVER MANAGEMENT - Reject driver
 */
export const rejectDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Instead of deleting, you might want to add a rejection status
    // For now, we'll delete the driver record
    await Driver.findByIdAndDelete(id);

    logger.info(`Driver ${id} rejected by admin. Reason: ${reason || 'No reason provided'}`);
    res.json({
      success: true,
      message: 'Driver rejected successfully'
    });

  } catch (error) {
    logger.error('Reject driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject driver'
    });
  }
};

/**
 * RIDE MANAGEMENT - Get all rides for admin
 */
export const getAllRides = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, search, passengerId, driverId } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (passengerId && mongoose.Types.ObjectId.isValid(passengerId)) query.passengerId = passengerId;
    if (driverId && mongoose.Types.ObjectId.isValid(driverId)) query.driverId = driverId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      if (mongoose.Types.ObjectId.isValid(search)) {
        query._id = search;
      }
    }

    const rides = await Ride.find(query)
      .populate('passengerId', 'name')
      .populate('driverId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Ride.countDocuments(query);

    res.json({
      success: true,
      data: {
        rides,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get all rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rides'
    });
  }
};

/**
 * RIDE MANAGEMENT - Get active rides
 */
export const getActiveRidesAdmin = async (req, res) => {
  try {
    const rides = await Ride.find({
      status: { $in: ['pending', 'accepted', 'in-progress'] }
    })
      .populate('passengerId', 'name phone')
      .populate('driverId', 'name phone')
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

/**
 * RIDE MANAGEMENT - Get ride details for admin
 */
export const getRideDetailsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const ride = await Ride.findById(id)
      .populate('passengerId')
      .populate('driverId')
      .populate('passengerId.userId', 'name email phone')
      .populate('driverId.userId', 'name email phone');

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    res.json({
      success: true,
      data: ride
    });

  } catch (error) {
    logger.error('Get ride details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ride details'
    });
  }
};


export const cancelRideAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refundAmount = 0 } = req.body;

    const ride = await Ride.findById(id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    if (ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed ride'
      });
    }

    // Update ride status
    ride.status = 'cancelled';
    ride.cancelledBy = 'system';
    ride.cancellationReason = reason || 'Cancelled by admin';
    ride.cancelledAt = new Date();
    await ride.save();

    // Process refund if applicable
    if (refundAmount > 0 && ride.payment.status === 'completed') {
      // Create refund payment record
      await Payment.create({
        rideId: ride._id,
        userId: ride.passengerId,
        type: 'refund',
        amount: refundAmount,
        currency: 'PKR',
        method: ride.payment.method,
        status: 'completed',
        gateway: ride.payment.gateway,
        transactionId: `REFUND-${ride._id}`,
        processedAt: new Date()
      });
    }

    logger.info(`Ride ${id} cancelled by admin. Reason: ${reason || 'No reason provided'}`);
    res.json({
      success: true,
      message: 'Ride cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel ride admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel ride'
    });
  }
};

/**
 * REPORTS - Get ride reports
 */
export const getRideReports = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const groupByFormat = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const reports = await Ride.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: groupByFormat, date: '$createdAt' }
          },
          totalRides: { $sum: 1 },
          completedRides: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelledRides: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', 0] } },
          averageFare: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, '$fare.final', null] } }
        }
      },
      {
        $project: {
          date: '$_id',
          totalRides: 1,
          completedRides: 1,
          cancelledRides: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          averageFare: { $round: ['$averageFare', 2] },
          completionRate: {
            $round: [
              { $multiply: [{ $divide: ['$completedRides', { $max: ['$totalRides', 1] }] }, 100] },
              1
            ]
          }
        }
      },
      { $sort: { date: -1 } }
    ]);

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    logger.error('Get ride reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate ride reports'
    });
  }
};

/**
 * REPORTS - Get earnings reports
 */
export const getEarningsReports = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const matchQuery = { status: 'completed' };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const groupByFormat = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const reports = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: groupByFormat, date: '$createdAt' }
          },
          totalRevenue: { $sum: '$amount' },
          cashPayments: {
            $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] }
          },
          onlinePayments: {
            $sum: { $cond: [{ $ne: ['$method', 'cash'] }, '$amount', 0] }
          },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id',
          totalRevenue: { $round: ['$totalRevenue', 2] },
          cashPayments: { $round: ['$cashPayments', 2] },
          onlinePayments: { $round: ['$onlinePayments', 2] },
          transactionCount: 1,
          averageTransaction: {
            $round: [{ $divide: ['$totalRevenue', { $max: ['$transactionCount', 1] }] }, 2]
          }
        }
      },
      { $sort: { date: -1 } }
    ]);

    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    logger.error('Get earnings reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate earnings reports'
    });
  }
};

/**
 * REPORTS - Get user reports
 */
export const getUserReports = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const userStats = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          blocked: { $sum: { $cond: ['$isBlocked', 1, 0] } }
        }
      }
    ]);

    // Get registration trends
    const registrationTrends = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          registrations: { $sum: 1 }
        }
      },
      { $sort: { '_id': -1 } },
      { $limit: 30 }
    ]);

    res.json({
      success: true,
      data: {
        userStats,
        registrationTrends
      }
    });

  } catch (error) {
    logger.error('Get user reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate user reports'
    });
  }
};

/**
 * REPORTS - Get driver performance reports
 */
export const getDriverReports = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const driverPerformance = await Ride.aggregate([
      {
        $match: {
          ...matchQuery,
          driverId: { $ne: null },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$driverId',
          totalRides: { $sum: 1 },
          totalEarnings: { $sum: '$fare.final' },
          averageRating: { $avg: '$rating.driverRating' },
          completedRides: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driver'
        }
      },
      { $unwind: '$driver' },
      {
        $project: {
          driverId: '$_id',
          driverName: '$driver.name',
          totalRides: 1,
          totalEarnings: { $round: ['$totalEarnings', 2] },
          averageRating: { $round: ['$averageRating', 2] },
          averageEarningsPerRide: {
            $round: [{ $divide: ['$totalEarnings', { $max: ['$totalRides', 1] }] }, 2]
          }
        }
      },
      { $sort: { totalEarnings: -1 } }
    ]);

    res.json({
      success: true,
      data: driverPerformance
    });

  } catch (error) {
    logger.error('Get driver reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate driver reports'
    });
  }
};

/**
 * SUBSCRIPTION MANAGEMENT - Get all subscription plans
 */
export const getSubscriptionPlans = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (status !== undefined) {
      query.isActive = status === 'active';
    }

    const plans = await Subscription.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subscription.countDocuments(query);

    res.json({
      success: true,
      data: {
        plans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans'
    });
  }
};

export const createSubscriptionPlan = async (req, res) => {
  try {
    const { name, description, ridesIncluded, price, validityDays } = req.body;

    // Validate required fields
    if (!name || !ridesIncluded || !price || !validityDays) {
      return res.status(400).json({
        success: false,
        message: 'Name, rides included, price, and validity days are required'
      });
    }

    const plan = await Subscription.create({
      name,
      description,
      ridesIncluded,
      price,
      validityDays,
      isActive: true
    });

    logger.info(`Subscription plan created: ${plan.name}`);
    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: plan
    });

  } catch (error) {
    logger.error('Create subscription plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription plan'
    });
  }
};

export const updateSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await Subscription.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    logger.info(`Subscription plan updated: ${plan.name}`);
    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: plan
    });

  } catch (error) {
    logger.error('Update subscription plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription plan'
    });
  }
};

export const deleteSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Subscription.findByIdAndDelete(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    logger.info(`Subscription plan deleted: ${plan.name}`);
    res.json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });

  } catch (error) {
    logger.error('Delete subscription plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subscription plan'
    });
  }
};

export const getSystemStats = async (req, res) => {
  try {
    // Get database statistics
    const dbStats = await mongoose.connection.db.stats();

    // Get server information
    const serverInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform
    };

    const activeRides = await Ride.countDocuments({
      status: { $in: ['pending', 'accepted', 'in-progress'] }
    });

    const todayStats = await Ride.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          completedRides: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        database: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize
        },
        server: serverInfo,
        activity: {
          activeRides,
          todayRides: todayStats[0]?.totalRides || 0,
          todayCompleted: todayStats[0]?.completedRides || 0
        }
      }
    });

  } catch (error) {
    logger.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system statistics'
    });
  }
};

/**
 * COMPLAINT MANAGEMENT - Get all complaints with pagination and filters
 */
export const getAllComplaints = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      complainantType,
      targetType,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (complainantType) query.complainantType = complainantType;
    if (targetType) query.targetType = targetType;

    // Search functionality
    if (search) {
      // We'll need to populate complainant and target to search by names
      // For now, search by description
      query.description = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const complaints = await Complaint.find(query)
      .populate('complainantId', 'name email phone')
      .populate('targetId', 'name email phone')
      .populate('rideId', 'pickupLocation destination status')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Complaint.countDocuments(query);

    logger.info(`Complaints retrieved: ${complaints.length} complaints`);
    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get all complaints error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
};

/**
 * COMPLAINT MANAGEMENT - Get complaint details by ID
 */
export const getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await Complaint.findById(id)
      .populate('complainantId', 'name email phone profilePicture')
      .populate('targetId', 'name email phone profilePicture')
      .populate('rideId')
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    logger.info(`Complaint details retrieved: ${complaint._id}`);
    res.json({
      success: true,
      data: complaint
    });

  } catch (error) {
    logger.error('Get complaint details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details'
    });
  }
};

/**
 * COMPLAINT MANAGEMENT - Resolve a complaint
 */
export const resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, adminNotes, action } = req.body;
    const adminProfile = await Admin.findOne({ userId: req.user.userId });
    const adminId = adminProfile?._id || req.user.userId;

    const complaint = await Complaint.findById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    if (complaint.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Complaint is already resolved'
      });
    }

    // Update complaint
    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = adminId;
    complaint.resolution = resolution;
    complaint.adminNotes = adminNotes;

    await complaint.save();

    // Handle different actions based on resolution
    if (action) {
      // Could implement additional actions like:
      // - Block user/driver
      // - Issue refund
      // - Send warning
      // - Suspend account
      logger.info(`Complaint ${id} resolved with action: ${action}`);
    }

    logger.info(`Complaint resolved: ${complaint._id}`);
    res.json({
      success: true,
      message: 'Complaint resolved successfully',
      data: complaint
    });

  } catch (error) {
    logger.error('Resolve complaint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve complaint'
    });
  }
};

/**
 * SOS ALERT MANAGEMENT - Get all SOS alerts with pagination and filters
 */
export const getAllSOSAlerts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      severity,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (severity) query.severity = severity;

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const alerts = await SOSAlert.find(query)
      .populate('userId', 'name email phone')
      .populate('rideId', 'pickupLocation destination driverId')
      .populate('resolvedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await SOSAlert.countDocuments(query);

    logger.info(`SOS alerts retrieved: ${alerts.length} alerts`);
    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get all SOS alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SOS alerts'
    });
  }
};

/**
 * SOS ALERT MANAGEMENT - Get active SOS alerts
 */
export const getActiveSOSAlerts = async (req, res) => {
  try {
    const activeAlerts = await SOSAlert.find({ status: 'active' })
      .populate('userId', 'name email phone emergencyContacts')
      .populate('rideId', 'pickupLocation destination driverId passengerId')
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`Active SOS alerts retrieved: ${activeAlerts.length} alerts`);
    res.json({
      success: true,
      data: activeAlerts
    });

  } catch (error) {
    logger.error('Get active SOS alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active SOS alerts'
    });
  }
};

/**
 * SOS ALERT MANAGEMENT - Resolve an SOS alert
 */
export const resolveSOSAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, responseNotes, policeNotified, ambulanceNotified } = req.body;
    const adminProfile = await Admin.findOne({ userId: req.user.userId });
    const adminId = adminProfile?._id || req.user.userId;

    const alert = await SOSAlert.findById(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found'
      });
    }

    if (alert.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'SOS alert is already resolved'
      });
    }

    // Update alert
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = adminId;
    alert.response = {
      ...alert.response,
      responseNotes: responseNotes || alert.response?.responseNotes,
      policeNotified: policeNotified !== undefined ? policeNotified : alert.response?.policeNotified,
      ambulanceNotified: ambulanceNotified !== undefined ? ambulanceNotified : alert.response?.ambulanceNotified
    };

    await alert.save();

    // Notify emergency contacts if not already done
    // This could trigger SMS/email notifications

    logger.info(`SOS alert resolved: ${alert._id}`);
    res.json({
      success: true,
      message: 'SOS alert resolved successfully',
      data: alert
    });

  } catch (error) {
    logger.error('Resolve SOS alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve SOS alert'
    });
  }
};

/**
 * Get single SOS alert details (admin)
 */
export const getSOSAlertDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await SOSAlert.findById(id)
      .populate('userId', 'name email phone')
      .populate('rideId')
      .populate('resolvedBy', 'name email')
      .lean();

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Get SOS alert details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SOS alert details'
    });
  }
};

/**
 * Get system settings (admin)
 */
export const getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.find({}).lean();
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    res.json({
      success: true,
      data: {
        maintenanceMode: settingsMap.maintenanceMode ?? false,
        emailNotifications: settingsMap.emailNotifications ?? true,
      }
    });
  } catch (error) {
    logger.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system settings'
    });
  }
};

/**
 * Update system settings (admin)
 */
export const updateSystemSettings = async (req, res) => {
  try {
    const { maintenanceMode, emailNotifications } = req.body;
    const adminProfile = await Admin.findOne({ userId: req.user.userId });
    const adminId = adminProfile?._id || req.user.userId;

    const updates = [];
    if (maintenanceMode !== undefined) {
      updates.push(
        SystemSettings.findOneAndUpdate(
          { key: 'maintenanceMode' },
          { value: !!maintenanceMode, updatedBy: adminId },
          { upsert: true, new: true }
        )
      );
    }
    if (emailNotifications !== undefined) {
      updates.push(
        SystemSettings.findOneAndUpdate(
          { key: 'emailNotifications' },
          { value: !!emailNotifications, updatedBy: adminId },
          { upsert: true, new: true }
        )
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    const settings = await SystemSettings.find({ key: { $in: ['maintenanceMode', 'emailNotifications'] } }).lean();
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    logger.info('System settings updated by admin');
    res.json({
      success: true,
      message: 'Settings saved successfully',
      data: {
        maintenanceMode: settingsMap.maintenanceMode ?? false,
        emailNotifications: settingsMap.emailNotifications ?? true,
      }
    });
  } catch (error) {
    logger.error('Update system settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system settings'
    });
  }
};

/**
 * Create user (admin) - passenger or driver
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, cnic, role = 'passenger' } = req.body;

    if (!name || !email || !phone || !password || !cnic) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, password, and CNIC are required'
      });
    }

    if (role !== 'passenger' && role !== 'driver') {
      return res.status(400).json({
        success: false,
        message: 'Role must be passenger or driver'
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone already registered'
      });
    }

    const user = await User.create({
      email: email.toLowerCase(),
      phone,
      password,
      cnic,
      role,
      isVerified: true,
      cnicImage: 'https://via.placeholder.com/400x300?text=Admin+Created',
    });

    if (role === 'passenger') {
      await Passenger.create({
        userId: user._id,
        name,
        cnicImage: 'https://via.placeholder.com/400x300?text=Admin+Created',
      });
    } else if (role === 'driver') {
      await Driver.create({
        userId: user._id,
        name,
        address: 'Address to be updated by driver',
      });
    }

    const populatedUser = await User.findById(user._id).select('-password');
    logger.info(`Admin created ${role} user: ${email}`);

    res.status(201).json({
      success: true,
      message: `${role === 'passenger' ? 'Passenger' : 'Driver'} created successfully`,
      data: { user: populatedUser }
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create user'
    });
  }
};

/**
 * ADMIN - Get chatbot/voice conversation logs (paginated)
 */
export const getChatbotConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, userId, startDate, endDate } = req.query;
    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, Math.max(1, parseInt(limit)));

    const query = {};

    if (type && ['voice', 'chat'].includes(type)) {
      query.type = type;
    }
    if (userId) {
      query.user = new mongoose.Types.ObjectId(userId);
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [conversations, total] = await Promise.all([
      AiInteraction.find(query)
        .populate('user', 'email phone role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(50, Math.max(1, parseInt(limit))))
        .lean(),
      AiInteraction.countDocuments(query),
    ]);

    res.json({
      success: true,
      message: 'Chatbot conversations retrieved successfully',
      data: conversations,
      meta: {
        page: Math.max(1, parseInt(page)),
        limit: Math.min(50, Math.max(1, parseInt(limit))),
        total,
        totalPages: Math.ceil(total / Math.min(50, Math.max(1, parseInt(limit)))),
      },
    });
  } catch (error) {
    logger.error('Get chatbot conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chatbot conversations',
    });
  }
};

/**
 * ADMIN - Get chatbot analytics
 */
export const getChatbotAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const [totalConversations, totalMessages, intentDistribution, typeDistribution, recentActivity] = await Promise.all([
      AiInteraction.distinct('user', dateQuery).then((users) => users.length),
      AiInteraction.countDocuments(dateQuery),
      AiInteraction.aggregate([
        { $match: dateQuery },
        { $group: { _id: '$intent', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AiInteraction.aggregate([
        { $match: dateQuery },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      AiInteraction.find(dateQuery)
        .populate('user', 'email phone role')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const intentMap = intentDistribution.reduce((acc, item) => {
      acc[item._id || 'UNKNOWN'] = item.count;
      return acc;
    }, {});

    const typeMap = typeDistribution.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Chatbot analytics retrieved successfully',
      data: {
        totalConversations,
        totalMessages,
        intentDistribution: intentMap,
        typeDistribution: typeMap,
        recentActivity,
      },
    });
  } catch (error) {
    logger.error('Get chatbot analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chatbot analytics',
    });
  }
};