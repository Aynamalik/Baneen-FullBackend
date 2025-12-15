import express from 'express';
import {
  uploadCNICImage,
  getCNICStatus,
  verifyCNIC,
  removeCNICImage,
} from '../controllers/cnic.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';
import { uploadCNICImage as uploadMiddleware, cleanupTempFiles, validateCNICImage } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import { cnicUploadSchema } from '../utils/validators.js';

const router = express.Router();

/**
 * @route   POST /api/v1/cnic/upload
 * @desc    Upload CNIC image for verification
 * @access  Private (Authenticated users)
 */
router.post(
  '/upload',
  authenticate,
  uploadMiddleware,
  validateCNICImage,
  cleanupTempFiles,
  uploadCNICImage
);

/**
 * @route   GET /api/v1/cnic/status
 * @desc    Get CNIC verification status
 * @access  Private (Authenticated users)
 */
router.get('/status', authenticate, getCNICStatus);

/**
 * @route   DELETE /api/v1/cnic/image
 * @desc    Delete CNIC image
 * @access  Private (Authenticated users)
 */
router.delete('/image', authenticate, removeCNICImage);

/**
 * @route   POST /api/v1/cnic/verify/:userId
 * @desc    Manually verify CNIC (Admin only)
 * @access  Private (Admin only)
 */
router.post(
  '/verify/:userId',
  authenticate,
  authorize(['admin']),
  verifyCNIC
);

export default router;
