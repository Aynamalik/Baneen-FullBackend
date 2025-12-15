import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate Cloudinary configuration
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.warn('⚠️  Cloudinary configuration missing. CNIC upload will be disabled.');
  console.warn('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable CNIC uploads.');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

/**
 * Upload image to Cloudinary
 * @param {string} filePath - Local file path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Upload result
 */
export const uploadImage = async (filePath, options = {}) => {
  // Check if Cloudinary is configured
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn('⚠️  Cloudinary not configured. Skipping image upload.');
    // Return mock result for development
    return {
      public_id: `mock-${Date.now()}`,
      url: `https://via.placeholder.com/400x300?text=CNIC-${Date.now()}`,
      format: 'jpg',
      width: 400,
      height: 300,
    };
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'baneen/cnic',
      resource_type: 'image', // Specify image type instead of auto
      transformation: [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto' },
      ],
      ...options,
    });

    return {
      public_id: result.public_id,
      url: result.secure_url,
      format: result.format,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Public ID of the image
 * @returns {Promise<Object>} - Delete result
 */
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} - Public ID
 */
export const extractPublicId = (url) => {
  const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/);
  return matches ? matches[1] : null;
};

export default cloudinary;
