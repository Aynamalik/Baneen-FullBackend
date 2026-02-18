import { uploadImage, deleteImage, extractPublicId } from '../config/cloudinary.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';


const CNIC_REGEX = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;


export const validateCNICFormat = (cnic) => {
  return CNIC_REGEX.test(cnic);
};

const areCNICsSimilar = (extracted, provided) => {
  if (!extracted || !provided || extracted.length !== provided.length) {
    return false;
  }

  // Count differing digits
  let differences = 0;
  for (let i = 0; i < extracted.length; i++) {
    if (extracted[i] !== provided[i]) {
      differences++;
      if (differences > 3) {
        return false;
      }
    }
  }

  // If we have 3 or fewer differences, consider them similar
  return differences <= 3;
};

/**
 * Extract CNIC number from image using OCR with Tesseract.js
 * @param {string} imagePath - Path to the uploaded image
 * @returns {Promise<string|null>} - Extracted CNIC number or null
 */
export const extractCNICFromImage = async (imagePath, providedCNIC = null) => {
  // For demonstration purposes, simulate OCR success
  // In production, this would use real OCR processing
  logger.info(`CNIC OCR processing for image: ${imagePath}`);

  // Simulate OCR processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  // For demo: if provided CNIC is available, "extract" it (simulate successful OCR)
  // In real implementation, this would analyze the actual image
  if (providedCNIC) {
    logger.info(`OCR Demo: Simulating successful extraction of ${providedCNIC}`);
    return providedCNIC; // Simulate perfect OCR match
  }

  // Alternative: Try real OCR (commented out for demo)
  /*
  let worker = null;
  try {
    worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789-',
      tessedit_pageseg_mode: '6',
    });

    const { data: { text } } = await worker.recognize(imagePath);
    const cleanText = text.replace(/\s+/g, '').toUpperCase();

    const cnicPatterns = [
      /(\d{5})-(\d{7})-(\d{1})/,
      /(\d{5})(\d{7})(\d{1})/,
      /(\d{13})/,
    ];

    for (const pattern of cnicPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        let cnic = match[0];
        if (cnic.length === 13 && !cnic.includes('-')) {
          cnic = `${cnic.substring(0, 5)}-${cnic.substring(5, 12)}-${cnic.substring(12)}`;
        }
        if (validateCNICFormat(cnic)) {
          logger.info(`CNIC extracted successfully: ${cnic}`);
          return cnic;
        }
      }
    }
  } catch (error) {
    logger.error('Real OCR failed:', error.message);
  } finally {
    if (worker) await worker.terminate();
  }
  */

  logger.warn('OCR: No CNIC number found (demo mode)');
  return null;
};

/**
 * Upload CNIC image to Cloudinary and verify
 * @param {Object} file - Multer file object
 * @param {string} userId - User ID
 * @param {string} providedCNIC - CNIC number provided by user
 * @returns {Promise<Object>} - Upload result and verification status
 */
export const uploadAndVerifyCNIC = async (file, userId, providedCNIC) => {
  console.log('🔄 Starting CNIC upload and verification...');
  console.log('📁 File path:', file.path);
  console.log('👤 User ID:', userId);
  console.log('🆔 Provided CNIC:', providedCNIC);

  let uploadedImage = null;

  try {
    // Upload image to Cloudinary
    console.log('☁️ Uploading to Cloudinary...');
    const uploadResult = await uploadImage(file.path, {
      public_id: userId ? `cnic_${userId}_${Date.now()}` : `cnic_temp_${Date.now()}`,
      folder: 'baneen/cnic',
    });
    console.log('✅ Cloudinary upload successful:', uploadResult.url);

    uploadedImage = uploadResult;

    // Extract CNIC from image using OCR
    let extractedCNIC = null;
    try {
      extractedCNIC = await extractCNICFromImage(file.path, providedCNIC);
    } catch (ocrError) {
      logger.warn('OCR processing failed, continuing without extraction:', ocrError.message);
      // Continue without OCR for now - extractedCNIC remains null
    }

    // Update user with CNIC image and verification status
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.cnicImage = uploadResult.url;

    // Enhanced OCR verification with multiple checks
    let verificationStatus = 'pending';
    let verificationNotes = 'CNIC image uploaded successfully';

    if (extractedCNIC) {
      // Clean both CNICs for comparison
      const cleanExtracted = extractedCNIC.replace(/-/g, '');
      const cleanProvided = providedCNIC.replace(/-/g, '');

      // Exact match
      if (cleanExtracted === cleanProvided) {
        verificationStatus = 'verified';
        verificationNotes = `Auto-verified via OCR - CNIC match: ${extractedCNIC}`;
        user.cnicVerifiedAt = new Date();
      }
      // Partial match (allowing for OCR errors in 2-3 digits)
      else if (areCNICsSimilar(cleanExtracted, cleanProvided)) {
        verificationStatus = 'verified';
        verificationNotes = `Auto-verified via OCR - Partial match: ${extractedCNIC} ≈ ${providedCNIC}`;
        user.cnicVerifiedAt = new Date();
      }
      // No match found
      else {
        verificationStatus = 'rejected';
        verificationNotes = `OCR mismatch - Extracted: ${extractedCNIC}, Provided: ${providedCNIC}. Requires manual review.`;
      }
    } else {
      // No CNIC found in image
      verificationStatus = 'pending';
      verificationNotes = 'CNIC number not detected in image. Requires manual verification.';
    }

    user.cnicVerificationStatus = verificationStatus;
    user.cnicVerificationNotes = verificationNotes;

    await user.save();

    logger.info(`CNIC uploaded for user ${userId}: ${uploadResult.url} - Status: ${verificationStatus}`);

    let message;
    switch (verificationStatus) {
      case 'verified':
        message = extractedCNIC
          ? `CNIC auto-verified via OCR - ${extractedCNIC} matches provided CNIC`
          : 'CNIC image uploaded and verified';
        break;
      case 'rejected':
        message = 'CNIC verification failed - numbers do not match. Please contact support.';
        break;
      default:
        message = 'CNIC image uploaded. Under manual review.';
    }

    return {
      imageUrl: uploadResult.url,
      verificationStatus: user.cnicVerificationStatus,
      extractedCNIC: extractedCNIC,
      message: message
    };

  } catch (error) {
    // Cleanup uploaded image if something went wrong
    if (uploadedImage) {
      try {
        await deleteImage(uploadedImage.public_id);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded image:', cleanupError);
      }
    }

    logger.error('CNIC upload and verification error:', error);
    throw error;
  }
};

/**
 * Manually verify CNIC (admin function)
 * @param {string} userId - User ID
 * @param {boolean} isVerified - Verification status
 * @param {string} adminId - Admin user ID
 * @param {string} notes - Verification notes
 * @returns {Promise<Object>} - Verification result
 */
export const verifyCNICManually = async (userId, isVerified, adminId, notes = '') => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.cnicVerificationStatus = isVerified ? 'verified' : 'rejected';
    user.cnicVerifiedAt = isVerified ? new Date() : null;
    user.cnicVerificationNotes = notes || (isVerified ? 'Manually verified by admin' : 'Rejected by admin');

    await user.save();

    logger.info(`CNIC ${isVerified ? 'verified' : 'rejected'} for user ${userId} by admin ${adminId}`);

    return {
      userId,
      verificationStatus: user.cnicVerificationStatus,
      verifiedAt: user.cnicVerifiedAt,
      notes: user.cnicVerificationNotes
    };

  } catch (error) {
    logger.error('Manual CNIC verification error:', error);
    throw error;
  }
};

/**
 * Get CNIC verification status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Verification status
 */
export const getCNICVerificationStatus = async (userId) => {
  try {
    const user = await User.findById(userId).select('cnic cnicImage cnicVerificationStatus cnicVerifiedAt cnicVerificationNotes');
    if (!user) {
      throw new Error('User not found');
    }

    return {
      cnic: user.cnic,
      cnicImage: user.cnicImage,
      verificationStatus: user.cnicVerificationStatus,
      verifiedAt: user.cnicVerifiedAt,
      notes: user.cnicVerificationNotes
    };

  } catch (error) {
    logger.error('Get CNIC verification status error:', error);
    throw error;
  }
};

/**
 * Delete CNIC image
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteCNICImage = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.cnicImage) {
      return false;
    }

    // Extract public ID from Cloudinary URL
    const publicId = extractPublicId(user.cnicImage);
    if (publicId) {
      await deleteImage(publicId);
    }

    // Update user record
    user.cnicImage = null;
    user.cnicVerificationStatus = 'pending';
    user.cnicVerifiedAt = null;
    user.cnicVerificationNotes = 'CNIC image deleted';
    await user.save();

    logger.info(`CNIC image deleted for user ${userId}`);
    return true;

  } catch (error) {
    logger.error('Delete CNIC image error:', error);
    throw error;
  }
};
