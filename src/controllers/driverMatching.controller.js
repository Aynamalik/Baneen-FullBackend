import driverMatchingService from '../services/driverMatching.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';


export const findAvailableDrivers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query;

    if (!latitude || !longitude) {
      return sendError(res, 'Latitude and longitude are required', 400);
    }

    const location = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    };

    const result = await driverMatchingService.getAvailableDrivers(location, parseFloat(radius));

    return sendSuccess(res, {
      drivers: result.map(driver => ({
        id: driver._id,
        name: driver.name,
        rating: driver.rating,
        distance: driver.distance,
        vehicle: {
          type: driver.vehicle?.type,
          model: driver.vehicle?.model,
          registrationNumber: driver.vehicle?.registrationNumber
        }
      })),
      count: result.length
    }, 'Available drivers retrieved successfully');

  } catch (error) {
    logger.error('Find available drivers error:', error);
    return sendError(res, 'Failed to find available drivers', 500);
  }
};


export const testDriverMatching = async (req, res) => {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType } = req.body;

    if (!pickupLat || !pickupLng) {
      return sendError(res, 'Pickup location is required', 400);
    }

    const pickupLocation = {
      latitude: parseFloat(pickupLat),
      longitude: parseFloat(pickupLng)
    };

    const dropoffLocation = dropoffLat && dropoffLng ? {
      latitude: parseFloat(dropoffLat),
      longitude: parseFloat(dropoffLng)
    } : null;

    const result = await driverMatchingService.findBestDriver(
      pickupLocation,
      dropoffLocation,
      { vehicleType }
    );

    if (!result.success) {
      return sendSuccess(res, {
        success: false,
        reason: result.reason,
        searchCriteria: result.searchCriteria
      }, 'No suitable drivers found');
    }

    return sendSuccess(res, {
      success: true,
      drivers: result.drivers,
      searchCriteria: result.searchCriteria
    }, 'Driver matching completed successfully');

  } catch (error) {
    logger.error('Test driver matching error:', error);
    return sendError(res, 'Failed to test driver matching', 500);
  }
};

export const handleDriverResponse = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { accepted } = req.body;
    const driverId = req.user.userId;

    // Validate driver role
    if (req.user.role !== 'driver') {
      return sendError(res, 'Only drivers can respond to ride requests', 403);
    }

    const result = await driverMatchingService.handleDriverResponse(
      rideId,
      driverId,
      accepted === true || accepted === 'true'
    );

    return sendSuccess(res, result, 'Driver response processed successfully');

  } catch (error) {
    logger.error('Handle driver response error:', error);
    return sendError(res, error.message || 'Failed to process driver response', 500);
  }
};


export const getMatchingStats = async (req, res) => {
  try {
    const stats = await driverMatchingService.getMatchingStats();

    return sendSuccess(res, { stats }, 'Matching statistics retrieved successfully');

  } catch (error) {
    logger.error('Get matching stats error:', error);
    return sendError(res, 'Failed to get matching statistics', 500);
  }
};