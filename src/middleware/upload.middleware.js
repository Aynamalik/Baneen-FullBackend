import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sendError } from '../utils/response.js';
import logger from '../utils/logger.js';

const uploadsDir = path.join(process.cwd(), 'uploads', 'temp');
console.log('📁 Checking uploads directory:', uploadsDir);
if (!fs.existsSync(uploadsDir)) {
  console.log('📁 Creating uploads directory...');
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created');
} else {
  console.log('✅ Uploads directory exists');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cnic-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|heic|heif/;
  const ext = path.extname(file.originalname).toLowerCase().replace(/^\./, '');
  const extname = allowedTypes.test(ext);
  const mimetype = /^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(file.mimetype);

  if (mimetype || extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, WebP, and HEIC images are allowed for CNIC upload'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, 
    files: 4, 
  }
});
export const handleUploads = (fields) => (req, res, next) => {
  
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
    const processedFiles = {};
    const processedBody = {};

    Object.keys(req.body).forEach(key => {
      const values = req.body[key];

   
      const cleanKey = key.trim();

      
      if (Array.isArray(values) && values.length === 1) {
        processedBody[cleanKey] = values[0];
      } else if (!Array.isArray(values)) {
        processedBody[cleanKey] = values;
      }
    });

    
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

const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const validateFiles = requiredFields => (req, res, next) => {
  for (let field of requiredFields) {
    const file = req.files?.[field]?.[0];
    if (!file) return sendError(res, `${field} is required`, 400);
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      return sendError(res, `${field} must be JPEG, PNG, WebP, or HEIC`, 400);
    }
    if (file.size < 100) return sendError(res, `${field} is too small`, 400);
  }
  next();
};


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

const driverPhotoFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|heic|heif/;
  const ext = path.extname(file.originalname).toLowerCase().replace(/^\./, '');
  const extname = allowedTypes.test(ext);
  const mimetype = /^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(file.mimetype);

  if (mimetype || extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, WebP, and HEIC images are allowed for driver photos'));
  }
};

export const uploadDriverPhoto = multer({
  storage: driverPhotoStorage,
  fileFilter: driverPhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file
  }
}).single('driverPhoto');

export default upload;
