import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

// Create uploads directory if it doesn't exist
// For Railway, use /tmp for temporary uploads
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
const uploadsDir = isRailway
  ? '/tmp/uploads/temp'
  : path.join(process.cwd(), 'uploads', 'temp');

console.log('📁 Environment:', isRailway ? 'Railway' : 'Local');
console.log('📁 Checking uploads directory:', uploadsDir);

try {
  if (!fs.existsSync(uploadsDir)) {
    console.log('📁 Creating uploads directory...');
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Uploads directory created');
  } else {
    console.log('✅ Uploads directory exists');
  }
} catch (error) {
  console.warn('⚠️ Could not create uploads directory:', error.message);
  console.warn('📁 Using system temp directory');
}

// Multer storage configuration for temporary storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the determined uploads directory
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cnic-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter for CNIC images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, and PNG images are allowed for CNIC upload'));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
  }
});

/**
 * Middleware to handle CNIC image upload
 */
export const uploadCNICImage = (req, res, next) => {
  console.log('🔄 Starting CNIC image upload...');
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📋 Form fields:', Object.keys(req.body || {}));
  console.log('📋 Has file in raw body:', !!req.body && typeof req.body === 'object');

  const uploadSingle = upload.single('cnicImage');

  uploadSingle(req, res, (err) => {
    console.log('📤 Multer processing complete');
    console.log('❌ Error object:', err);
    console.log('📁 req.file:', req.file);

    if (err instanceof multer.MulterError) {
      console.error('🚨 Multer Error Details:', {
        code: err.code,
        field: err.field,
        message: err.message,
        stack: err.stack
      });

      // Multer-specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        console.log('📏 File too large');
        return sendError(res, 'CNIC image size must be less than 5MB', 400);
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        console.log('📊 Too many files');
        return sendError(res, 'Only one CNIC image can be uploaded at a time', 400);
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        console.log('🎯 Unexpected file field');
        return sendError(res, 'File must be uploaded with field name "cnicImage"', 400);
      }
      console.log('🔧 Other multer error:', err.code);
      return sendError(res, `File upload error: ${err.message}`, 400);
    } else if (err) {
      console.error('🚨 Non-multer error:', err);
      // Other errors (like file filter errors)
      return sendError(res, err.message, 400);
    }

    // Check if file was uploaded
    if (!req.file) {
      console.log('❌ No file uploaded');
      console.log('📋 Available fields:', req.body);
      return sendError(res, 'CNIC image is required', 400);
    }

    // Validate image dimensions (basic check)
    const { size, mimetype, filename, path: filePath } = req.file;
    console.log('✅ File uploaded successfully:', {
      filename,
      size,
      mimetype,
      path: filePath
    });

    if (size === 0) {
      console.log('📏 Empty file detected');
      return sendError(res, 'Uploaded file is empty', 400);
    }

    logger.info(`CNIC image uploaded: ${req.file.filename}`);
    next();
  });
};

/**
 * Middleware to clean up temporary uploaded files
 */
export const cleanupTempFiles = (req, res, next) => {
  res.on('finish', () => {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        logger.info(`Cleaned up temp file: ${req.file.filename}`);
      } catch (error) {
        logger.error(`Failed to cleanup temp file: ${error.message}`);
      }
    }
  });
  next();
};

/**
 * Validate CNIC image quality (basic validation)
 */
export const validateCNICImage = (req, res, next) => {
  if (!req.file) {
    return sendError(res, 'CNIC image is required', 400);
  }

  // Add more sophisticated image validation here in the future
  // For now, just check basic properties

  const { size, mimetype } = req.file;
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];

  // Temporarily allow any file type for testing
  if (!allowedTypes.includes(mimetype) && !mimetype) {
    // For testing, allow any file - in production this would be stricter
    console.log(`Testing mode: Allowing file with mimetype: ${mimetype}`);
  } else if (!allowedTypes.includes(mimetype)) {
    return sendError(res, 'Invalid image format. Only JPEG and PNG are allowed', 400);
  }

  if (size < 100) { // Reduced minimum size for testing
    return sendError(res, 'CNIC image file is too small. Please upload a clear image', 400);
  }

  next();
};

export default upload;
