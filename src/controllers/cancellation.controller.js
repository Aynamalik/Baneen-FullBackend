import cancellationService from '../services/cancellation.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const calculateCancellationFee = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { cancelledBy } = req.query;

    if (!cancelledBy || !['passenger', 'driver'].includes(cancelledBy)) {
      return sendError(res, 'Valid cancelledBy parameter required (passenger/driver)', 400);
    }

    const feeCalculation = await cancellationService.calculateCancellationFee(
      rideId,
      cancelledBy
    );

    return sendSuccess(res, {
      fee: feeCalculation.fee,
      breakdown: feeCalculation.breakdown,
      policy: feeCalculation.policy
    }, 'Cancellation fee calculated successfully');

  } catch (error) {
    logger.error('Calculate cancellation fee error:', error);
    return sendError(res, 'Failed to calculate cancellation fee', 500);
  }
};

export const checkCancellationEligibility = async (req, res) => {
  try {
    const { rideId } = req.params;
    const cancelledBy = req.user.role === 'driver' ? 'driver' : 'passenger';

    const result = await cancellationService.canCancelRide(rideId, cancelledBy);

    return sendSuccess(res, {
      canCancel: result.allowed,
      reason: result.reason
    }, 'Cancellation eligibility checked successfully');

  } catch (error) {
    logger.error('Check cancellation eligibility error:', error);
    return sendError(res, 'Failed to check cancellation eligibility', 500);
  }
};

export const getCancellationPolicy = async (req, res) => {
  try {
    const { userType } = req.params;

    if (!userType || !['passenger', 'driver'].includes(userType)) {
      return sendError(res, 'Valid userType parameter required (passenger/driver)', 400);
    }

    const policy = cancellationService.getCancellationPolicy(userType);

    return sendSuccess(res, { policy }, 'Cancellation policy retrieved successfully');

  } catch (error) {
    logger.error('Get cancellation policy error:', error);
    return sendError(res, 'Failed to get cancellation policy', 500);
  }
};


export const getCancellationStats = async (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;

    const stats = await cancellationService.getCancellationStats(timeframe);

    return sendSuccess(res, { stats }, 'Cancellation statistics retrieved successfully');

  } catch (error) {
    logger.error('Get cancellation stats error:', error);
    return sendError(res, 'Failed to get cancellation statistics', 500);
  }
};