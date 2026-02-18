import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'temp');
console.log('📁 Checking uploads directory:', uploadsDir);
if (!fs.existsSync(uploadsDir)) {
  console.log('📁 Creating uploads directory...');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created');
} else {
  console.log('✅ Uploads directory exists');
}

// Multer storage configuration for temporary storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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
    files: 4, // Only one file at a time
  }
});
export const handleUploads = (fields) => (req, res, next) => {
  // Use upload.any() to handle all fields
  const uploadAny = upload.any();
  uploadAny(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return sendError(res, 'File too large', 400);
      if (err.code === 'LIMIT_FILE_COUNT') return sendError(res, 'Too many files', 400);
      if (err.code === 'LIMIT_UNEXPECTED_FILE') return sendError(res, `Unexpected file field: ${err.field}`, 400);
      return sendError(res, err.message, 400);
    } else if (err) {
      return sendError(res, err.message, 400);
    }

    // Separate files and text fields
    const processedFiles = {};
    const processedBody = {};

    // Process all fields from req.body (multer puts everything here with any())
    Object.keys(req.body).forEach(key => {
      const values = req.body[key];

      // Trim whitespace from field names to handle accidental spaces
      const cleanKey = key.trim();

      // If it's an array with one element and looks like text, treat as text field
      if (Array.isArray(values) && values.length === 1) {
        processedBody[cleanKey] = values[0];
      } else if (!Array.isArray(values)) {
        processedBody[cleanKey] = values;
      }
    });

    // Process files from req.files array
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (!processedFiles[file.fieldname]) {
          processedFiles[file.fieldname] = [];
        }
        processedFiles[file.fieldname].push(file);
      });
    }

    req.body = processedBody;
    req.files = processedFiles;

    // Validate required files
    for (let field of fields.map(f => f.name)) {
      if (!req.files?.[field]?.[0]) return sendError(res, `${field} is required`, 400);
    }

    next();
  });
};
// Cleanup middleware
export const cleanupTempFiles = (req, res, next) => {
  res.on('finish', () => {
    if (req.files) {
      Object.values(req.files).forEach(arr =>
        arr.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            logger.info(`Cleaned up temp file: ${file.filename}`);
          } catch (err) {
            logger.error(`Failed to cleanup temp file: ${err.message}`);
          }
        })
      );
    }
  });
  next();
};

// Validate uploaded files dynamically
export const validateFiles = requiredFields => (req, res, next) => {
  for (let field of requiredFields) {
    const file = req.files?.[field]?.[0];
    if (!file) return sendError(res, `${field} is required`, 400);
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
      return sendError(res, `${field} must be JPEG or PNG`, 400);
    }
    if (file.size < 100) return sendError(res, `${field} is too small`, 400);
  }
  next();
};

// Specific configuration for driver photos
const driverPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename for driver photos
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `driver-photo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter for driver photos
const driverPhotoFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, and PNG images are allowed for driver photos'));
  }
};

// Multer configuration for driver photos
export const uploadDriverPhoto = multer({
  storage: driverPhotoStorage,
  fileFilter: driverPhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file
  }
}).single('driverPhoto');

export default upload;
