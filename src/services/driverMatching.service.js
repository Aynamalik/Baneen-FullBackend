import Driver from '../models/Driver.js';
import Ride from '../models/Ride.js';
import logger from '../utils/logger.js';
import { DRIVER_AVAILABILITY } from '../config/constants.js';

// Driver Matching Service for Ride-Sharing Platform
class DriverMatchingService {
  constructor() {
    this.searchRadiusKm = 5; // Default search radius
    this.maxSearchTime = 30000; // 30 seconds max search time
    this.driverResponseTimeout = 15000; // 15 seconds for driver to respond
    this.maxConcurrentRides = 1; // Maximum concurrent rides per driver
  }

  /**
   * Find best available driver for a ride request
   */
  async findBestDriver(pickupLocation, dropoffLocation, preferences = {}) {
    try {
      logger.info('Finding best driver for ride request', {
        pickup: pickupLocation,
        dropoff: dropoffLocation
      });

      const {
        vehicleType = 'any',
        maxWaitTime = 10, // minutes
        priority = 'speed' // 'speed', 'rating', 'distance'
      } = preferences;

      // Step 1: Get all available drivers within search radius
      const availableDrivers = await this.getAvailableDrivers(
        pickupLocation,
        this.searchRadiusKm
      );

      if (availableDrivers.length === 0) {
        logger.warn('No available drivers found within search radius');
        return { success: false, reason: 'NO_DRIVERS_AVAILABLE' };
      }

      // Step 2: Filter drivers by vehicle type if specified
      let filteredDrivers = availableDrivers;
      if (vehicleType !== 'any') {
        filteredDrivers = availableDrivers.filter(driver =>
          driver.vehicle?.type === vehicleType
        );
      }

      if (filteredDrivers.length === 0) {
        logger.warn('No drivers available for requested vehicle type');
        return { success: false, reason: 'NO_DRIVERS_FOR_VEHICLE_TYPE' };
      }

      // Step 3: Calculate scores for each driver
      const scoredDrivers = await this.calculateDriverScores(
        filteredDrivers,
        pickupLocation,
        priority
      );

      // Step 4: Sort by score and select top candidates
      scoredDrivers.sort((a, b) => b.score - a.score);
      const topCandidates = scoredDrivers.slice(0, 3); // Send to top 3 drivers

      logger.info(`Found ${topCandidates.length} driver candidates`);

      return {
        success: true,
        drivers: topCandidates,
        searchCriteria: {
          pickupLocation,
          searchRadius: this.searchRadiusKm,
          vehicleType,
          totalAvailable: availableDrivers.length,
          filteredCount: filteredDrivers.length
        }
      };

    } catch (error) {
      logger.error('Driver matching error:', error);
      return { success: false, reason: 'MATCHING_ERROR', error: error.message };
    }
  }

  /**
   * Get all available drivers within radius
   */
  async getAvailableDrivers(centerLocation, radiusKm) {
    try {
      // Calculate bounding box for the search area
      const { lat, lng } = centerLocation;
      const latDelta = radiusKm / 111.32; // 1 degree latitude ≈ 111.32 km
      const lngDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLng = lng - lngDelta;
      const maxLng = lng + lngDelta;

      // Query available drivers within bounding box
      const availableDrivers = await Driver.find({
        isApproved: true,
        'availability.status': DRIVER_AVAILABILITY.AVAILABLE,
        'availability.currentLocation.latitude': { $gte: minLat, $lte: maxLat },
        'availability.currentLocation.longitude': { $gte: minLng, $lte: maxLng }
      })
      .populate('userId', 'name phone rating')
      .populate('vehicle.vehicleId')
      .limit(50); // Limit results for performance

      // Filter by exact distance (more precise than bounding box)
      const driversWithinRadius = [];
      for (const driver of availableDrivers) {
        const distance = this.calculateDistance(
          centerLocation,
          driver.availability.currentLocation
        );

        if (distance <= radiusKm) {
          driver.distance = distance;
          driversWithinRadius.push(driver);
        }
      }

      return driversWithinRadius;

    } catch (error) {
      logger.error('Error getting available drivers:', error);
      throw error;
    }
  }

  /**
   * Calculate scores for drivers based on various factors
   */
  async calculateDriverScores(drivers, pickupLocation, priority = 'speed') {
    const scoredDrivers = [];

    for (const driver of drivers) {
      const score = {
        driverId: driver._id,
        userId: driver.userId._id,
        name: driver.name,
        rating: driver.rating,
        distance: driver.distance,
        vehicle: driver.vehicle,
        score: 0,
        factors: {}
      };

      // Factor 1: Distance (closer is better)
      const distanceScore = Math.max(0, 100 - (driver.distance * 20)); // 5km = 0 points
      score.factors.distance = distanceScore;
      score.score += distanceScore * 0.3; // 30% weight

      // Factor 2: Rating (higher rating is better)
      const ratingScore = (driver.rating / 5) * 100;
      score.factors.rating = ratingScore;
      score.score += ratingScore * 0.25; // 25% weight

      // Factor 3: Acceptance Rate (from recent rides)
      const acceptanceRate = await this.calculateAcceptanceRate(driver._id);
      score.factors.acceptanceRate = acceptanceRate;
      score.score += acceptanceRate * 0.2; // 20% weight

      // Factor 4: Completion Rate
      const completionRate = await this.calculateCompletionRate(driver._id);
      score.factors.completionRate = completionRate;
      score.score += completionRate * 0.15; // 15% weight

      // Factor 5: Response Time (how quickly they accept rides)
      const avgResponseTime = await this.calculateAverageResponseTime(driver._id);
      const responseScore = Math.max(0, 100 - (avgResponseTime / 1000)); // Faster is better
      score.factors.responseTime = responseScore;
      score.score += responseScore * 0.1; // 10% weight

      // Priority adjustments
      if (priority === 'rating') {
        score.score = score.score * 0.8 + ratingScore * 0.2;
      } else if (priority === 'distance') {
        score.score = score.score * 0.8 + distanceScore * 0.2;
      }

      scoredDrivers.push(score);
    }

    return scoredDrivers;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLng = this.toRadians(coord2.longitude - coord1.longitude);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate driver's acceptance rate
   */
  async calculateAcceptanceRate(driverId) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const totalRequests = await Ride.countDocuments({
        driverId,
        createdAt: { $gte: thirtyDaysAgo }
      });

      const acceptedRequests = await Ride.countDocuments({
        driverId,
        status: { $in: ['accepted', 'in-progress', 'completed'] },
        createdAt: { $gte: thirtyDaysAgo }
      });

      return totalRequests > 0 ? (acceptedRequests / totalRequests) * 100 : 50; // Default 50% if no data

    } catch (error) {
      logger.error('Error calculating acceptance rate:', error);
      return 50; // Default value
    }
  }

  /**
   * Calculate driver's completion rate
   */
  async calculateCompletionRate(driverId) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const acceptedRides = await Ride.countDocuments({
        driverId,
        status: { $in: ['accepted', 'in-progress'] },
        createdAt: { $gte: thirtyDaysAgo }
      });

      const completedRides = await Ride.countDocuments({
        driverId,
        status: 'completed',
        createdAt: { $gte: thirtyDaysAgo }
      });

      return acceptedRides > 0 ? (completedRides / acceptedRides) * 100 : 50;

    } catch (error) {
      logger.error('Error calculating completion rate:', error);
      return 50;
    }
  }

  /**
   * Calculate average response time for ride acceptance
   */
  async calculateAverageResponseTime(driverId) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const rides = await Ride.find({
        driverId,
        status: { $in: ['accepted', 'in-progress', 'completed'] },
        createdAt: { $gte: thirtyDaysAgo }
      }).select('createdAt acceptedAt');

      if (rides.length === 0) return 30000; // Default 30 seconds

      const responseTimes = rides
        .filter(ride => ride.acceptedAt)
        .map(ride => ride.acceptedAt - ride.createdAt);

      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

      return avgResponseTime || 30000;

    } catch (error) {
      logger.error('Error calculating response time:', error);
      return 30000;
    }
  }

  /**
   * Send ride request to selected drivers
   */
  async sendRideRequestsToDrivers(rideId, driverCandidates) {
    try {
      logger.info(`Sending ride request ${rideId} to ${driverCandidates.length} drivers`);

      const ride = await Ride.findById(rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      // Send notifications to drivers (this would integrate with push notifications)
      const notifications = driverCandidates.map(driver => ({
        driverId: driver.driverId,
        rideId,
        message: `New ride request: ${ride.pickup.address} to ${ride.destination.address}`,
        expiresAt: new Date(Date.now() + this.driverResponseTimeout)
      }));

      // In production, send push notifications here
      logger.info('Ride requests sent to drivers:', notifications.map(n => n.driverId));

      return {
        success: true,
        notificationsSent: notifications.length,
        expiresAt: new Date(Date.now() + this.driverResponseTimeout)
      };

    } catch (error) {
      logger.error('Error sending ride requests:', error);
      throw error;
    }
  }

  /**
   * Handle driver response to ride request
   */
  async handleDriverResponse(rideId, driverId, accepted) {
    try {
      logger.info(`Driver ${driverId} ${accepted ? 'accepted' : 'rejected'} ride ${rideId}`);

      const ride = await Ride.findById(rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      if (accepted) {
        // Assign driver to ride
        ride.driverId = driverId;
        ride.status = 'accepted';
        ride.acceptedAt = new Date();
        await ride.save();

        // Update driver status
        await Driver.findByIdAndUpdate(driverId, {
          status: 'ON_RIDE',
          'availability.status': DRIVER_AVAILABILITY.ON_RIDE
        });

        // Notify other drivers that ride is taken
        // (In production, cancel their notifications)

        return {
          success: true,
          action: 'RIDE_ACCEPTED',
          ride,
          message: 'Ride successfully assigned to driver'
        };

      } else {
        // Driver rejected - try next driver if available
        return {
          success: true,
          action: 'RIDE_REJECTED',
          message: 'Driver rejected the ride'
        };
      }

    } catch (error) {
      logger.error('Error handling driver response:', error);
      throw error;
    }
  }

  /**
   * Get matching statistics
   */
  async getMatchingStats() {
    try {
      const stats = {
        totalDrivers: await Driver.countDocuments({ isApproved: true }),
        availableDrivers: await Driver.countDocuments({
          isApproved: true,
          'availability.status': DRIVER_AVAILABILITY.AVAILABLE
        }),
        activeRides: await Ride.countDocuments({
          status: { $in: ['accepted', 'in-progress'] }
        }),
        completedRidesToday: await Ride.countDocuments({
          status: 'completed',
          completedAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        })
      };

      return stats;

    } catch (error) {
      logger.error('Error getting matching stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const driverMatchingService = new DriverMatchingService();
export default driverMatchingService;