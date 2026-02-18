import {
  uploadAndVerifyCNIC,
  verifyCNICManually,
  getCNICVerificationStatus,
  deleteCNICImage,
} from '../services/cnic.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

export const uploadCNICImage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const file = req.file;

    if (!file) {
      return sendError(res, 'CNIC image is required', 400);
    }

    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Upload and verify CNIC
    const result = await uploadAndVerifyCNIC(file, userId, user.cnic);

    return sendSuccess(
      res,
      {
        imageUrl: result.imageUrl,
        verificationStatus: result.verificationStatus,
        extractedCNIC: result.extractedCNIC,
      },
      result.message
    );

  } catch (error) {
    logger.error('CNIC upload error:', error);
    return sendError(res, error.message || 'CNIC upload failed', 500);
  }
};

/**
 * Get CNIC verification status
 */
export const getCNICStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const status = await getCNICVerificationStatus(userId);

    return sendSuccess(
      res,
      status,
      'CNIC verification status retrieved successfully'
    );

  } catch (error) {
    logger.error('Get CNIC status error:', error);
    return sendError(res, error.message || 'Failed to get CNIC status', 500);
  }
};

export const verifyCNIC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isVerified, notes } = req.body;
    const adminId = req.user.userId;

    if (typeof isVerified !== 'boolean') {
      return sendError(res, 'isVerified must be a boolean', 400);
    }

    const result = await verifyCNICManually(userId, isVerified, adminId, notes);

    return sendSuccess(
      res,
      result,
      `CNIC ${isVerified ? 'verified' : 'rejected'} successfully`
    );

  } catch (error) {
    logger.error('Manual CNIC verification error:', error);
    return sendError(res, error.message || 'CNIC verification failed', 500);
  }
};

export const removeCNICImage = async (req, res) => {
  try {
    const userId = req.user.userId;

    const success = await deleteCNICImage(userId);

    if (!success) {
      return sendError(res, 'CNIC image not found', 404);
    }

    return sendSuccess(
      res,
      null,
      'CNIC image deleted successfully'
    );

  } catch (error) {
    logger.error('Delete CNIC image error:', error);
    return sendError(res, error.message || 'Failed to delete CNIC image', 500);
  }
};
