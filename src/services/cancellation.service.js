import Ride from '../models/Ride.js';
import logger from '../utils/logger.js';

// Cancellation Fee Service
class CancellationService {
  constructor() {
    // Base cancellation fees (in PKR)
    this.BASE_FEES = {
      passenger: {
        immediate: 0,    // Within 1 minute
        early: 50,       // 1-2 minutes
        standard: 100,   // 2-5 minutes
        late: 150        // After 5 minutes
      },
      driver: {
        immediate: 0,    // Within 1 minute
        early: 25,       // 1-2 minutes
        standard: 50,    // 2-5 minutes
        late: 100        // After 5 minutes
      }
    };

    // Surge multipliers for peak hours/demand
    this.SURGE_MULTIPLIERS = {
      normal: 1.0,
      peak: 1.5,
      high: 2.0
    };

    // Time thresholds in minutes
    this.TIME_THRESHOLDS = {
      immediate: 1,
      early: 2,
      standard: 5
    };
  }

  /**
   * Calculate cancellation fee
   */
  async calculateCancellationFee(rideId, cancelledBy, cancellationTime = new Date()) {
    try {
      const ride = await Ride.findById(rideId)
        .populate('passengerId', 'subscription')
        .populate('driverId', 'rating');

      if (!ride) {
        throw new Error('Ride not found');
      }

      // No cancellation fee for scheduled rides (no driver assigned yet)
      if (ride.status === 'scheduled') {
        return {
          fee: 0,
          breakdown: { baseFee: 0, surgeMultiplier: 1, discounts: { total: 0 }, timeElapsedMinutes: 0, feeCategory: 'scheduled', cancelledBy },
          policy: this.getCancellationPolicy(cancelledBy)
        };
      }

      const rideCreatedAt = ride.createdAt;
      const timeElapsedMinutes = (cancellationTime - rideCreatedAt) / (1000 * 60);

      // Determine fee category based on time elapsed
      let feeCategory;
      if (timeElapsedMinutes <= this.TIME_THRESHOLDS.immediate) {
        feeCategory = 'immediate';
      } else if (timeElapsedMinutes <= this.TIME_THRESHOLDS.early) {
        feeCategory = 'early';
      } else if (timeElapsedMinutes <= this.TIME_THRESHOLDS.standard) {
        feeCategory = 'standard';
      } else {
        feeCategory = 'late';
      }

      // Get base fee
      const baseFee = this.BASE_FEES[cancelledBy][feeCategory];

      // Apply surge multiplier
      const surgeMultiplier = await this.calculateSurgeMultiplier(cancellationTime);
      let finalFee = baseFee * surgeMultiplier;

      // Apply discounts for special cases
      const discounts = await this.calculateDiscounts(ride, cancelledBy, timeElapsedMinutes);

      finalFee = Math.max(0, finalFee - discounts.total);

      // Round to nearest 10 PKR
      finalFee = Math.round(finalFee / 10) * 10;

      logger.info(`Cancellation fee calculated:`, {
        rideId,
        cancelledBy,
        timeElapsedMinutes,
        feeCategory,
        baseFee,
        surgeMultiplier,
        discounts,
        finalFee
      });

      return {
        fee: finalFee,
        breakdown: {
          baseFee,
          surgeMultiplier,
          discounts,
          timeElapsedMinutes,
          feeCategory,
          cancelledBy
        },
        policy: this.getCancellationPolicy(cancelledBy)
      };

    } catch (error) {
      logger.error('Cancellation fee calculation error:', error);
      throw error;
    }
  }

  /**
   * Calculate surge multiplier based on time and demand
   */
  async calculateSurgeMultiplier(cancellationTime) {
    const hour = cancellationTime.getHours();
    const day = cancellationTime.getDay();

    // Peak hours: 7-9 AM, 5-7 PM on weekdays
    const isPeakHour = (
      (hour >= 7 && hour <= 9) ||
      (hour >= 17 && hour <= 19)
    ) && day >= 1 && day <= 5; // Monday to Friday

    // High demand weekends: Friday 8PM - Sunday 8PM
    const isWeekendHigh = (
      (day === 5 && hour >= 20) || // Friday after 8PM
      (day === 6) || // All Saturday
      (day === 0 && hour <= 20) // Sunday until 8PM
    );

    if (isWeekendHigh) {
      return this.SURGE_MULTIPLIERS.high;
    } else if (isPeakHour) {
      return this.SURGE_MULTIPLIERS.peak;
    } else {
      return this.SURGE_MULTIPLIERS.normal;
    }
  }

  /**
   * Calculate applicable discounts
   */
  async calculateDiscounts(ride, cancelledBy, timeElapsedMinutes) {
    const discounts = {
      subscription: 0,
      firstTime: 0,
      goodRating: 0,
      total: 0
    };

    // Subscription discount (50% off for active subscribers)
    if (cancelledBy === 'passenger' && ride.passengerId?.subscription?.isActive) {
      discounts.subscription = 0.5; // 50% discount
    }

    // First-time user discount (within first week of registration)
    const userAge = ride.passengerId ?
      (Date.now() - ride.passengerId.createdAt) / (1000 * 60 * 60 * 24) : 0;

    if (cancelledBy === 'passenger' && userAge <= 7) {
      discounts.firstTime = 25; // PKR 25 discount
    }

    // Good rating discount for drivers
    if (cancelledBy === 'driver' && ride.driverId?.rating >= 4.5) {
      discounts.goodRating = 20; // PKR 20 discount
    }

    // Early cancellation bonus (reduce fee for very early cancellations)
    if (timeElapsedMinutes < 0.5) { // Within 30 seconds
      discounts.earlyCancellation = Math.min(50, discounts.total + 25);
    }

    discounts.total = discounts.subscription +
                     discounts.firstTime +
                     discounts.goodRating +
                     (discounts.earlyCancellation || 0);

    return discounts;
  }

  /**
   * Get cancellation policy details
   */
  getCancellationPolicy(cancelledBy) {
    const policies = {
      passenger: {
        freeCancellation: 'Within 1 minute of booking',
        earlyFee: 'PKR 50 (1-2 minutes)',
        standardFee: 'PKR 100 (2-5 minutes)',
        lateFee: 'PKR 150 (after 5 minutes)',
        subscriptionDiscount: '50% discount for active subscribers'
      },
      driver: {
        freeCancellation: 'Within 1 minute of acceptance',
        earlyFee: 'PKR 25 (1-2 minutes)',
        standardFee: 'PKR 50 (2-5 minutes)',
        lateFee: 'PKR 100 (after 5 minutes)',
        ratingDiscount: 'Up to PKR 20 discount for highly rated drivers'
      }
    };

    return policies[cancelledBy] || policies.passenger;
  }

  /**
   * Check if cancellation is allowed
   */
  async canCancelRide(rideId, cancelledBy, cancellationTime = new Date()) {
    try {
      const ride = await Ride.findById(rideId);

      if (!ride) {
        return { allowed: false, reason: 'Ride not found' };
      }

      // Check ride status
      if (ride.status === 'completed') {
        return { allowed: false, reason: 'Cannot cancel completed ride' };
      }

      if (ride.status === 'cancelled') {
        return { allowed: false, reason: 'Ride already cancelled' };
      }

      // Scheduled rides: passenger can cancel anytime before pickup (no driver assigned yet)
      if (ride.status === 'scheduled' && cancelledBy === 'passenger') {
        return { allowed: true };
      }

      // Check cancellation time limits for immediate rides
      if (cancelledBy === 'passenger') {
        // Passengers can cancel up to 10 minutes after booking (immediate rides only)
        const timeSinceBooking = (cancellationTime - ride.createdAt) / (1000 * 60);
        if (timeSinceBooking > 10) {
          return { allowed: false, reason: 'Cancellation time limit exceeded (10 minutes)' };
        }
      } else if (cancelledBy === 'driver') {
        // Drivers can cancel up to pickup time
        if (ride.status === 'in-progress') {
          return { allowed: false, reason: 'Cannot cancel ride in progress' };
        }
      }

      return { allowed: true };

    } catch (error) {
      logger.error('Can cancel ride check error:', error);
      return { allowed: false, reason: 'Error checking cancellation eligibility' };
    }
  }

  /**
   * Process ride cancellation
   */
  async processCancellation(rideId, cancelledBy, reason, cancellationTime = new Date()) {
    try {
      // Check if cancellation is allowed
      const canCancel = await this.canCancelRide(rideId, cancelledBy, cancellationTime);
      if (!canCancel.allowed) {
        return {
          success: false,
          reason: canCancel.reason,
          fee: 0
        };
      }

      // Calculate cancellation fee
      const feeCalculation = await this.calculateCancellationFee(rideId, cancelledBy, cancellationTime);

      // Update ride status
      const ride = await Ride.findByIdAndUpdate(rideId, {
        status: 'cancelled',
        cancelledBy,
        cancellationReason: reason,
        'fare.cancellationFee': feeCalculation.fee,
        cancelledAt: cancellationTime
      }, { new: true });

      if (!ride) {
        throw new Error('Failed to update ride status');
      }

      logger.info(`Ride ${rideId} cancelled by ${cancelledBy}, fee: PKR ${feeCalculation.fee}`);

      return {
        success: true,
        ride,
        fee: feeCalculation.fee,
        breakdown: feeCalculation.breakdown,
        policy: feeCalculation.policy
      };

    } catch (error) {
      logger.error('Process cancellation error:', error);
      throw error;
    }
  }

  /**
   * Get cancellation statistics
   */
  async getCancellationStats(timeframe = 'month') {
    try {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const stats = await Ride.aggregate([
        {
          $match: {
            status: 'cancelled',
            cancelledAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$cancelledBy',
            count: { $sum: 1 },
            totalFees: { $sum: '$fare.cancellationFee' },
            avgFee: { $avg: '$fare.cancellationFee' }
          }
        }
      ]);

      const totalCancellations = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalFees = stats.reduce((sum, stat) => sum + stat.totalFees, 0);

      return {
        timeframe,
        totalCancellations,
        totalFees,
        breakdown: stats,
        period: {
          start: startDate,
          end: new Date()
        }
      };

    } catch (error) {
      logger.error('Get cancellation stats error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const cancellationService = new CancellationService();
export default cancellationService;