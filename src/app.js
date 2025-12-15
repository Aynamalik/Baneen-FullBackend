import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error.middleware.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const API_VERSION = process.env.API_VERSION || 'v1';

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// API routes
import authRoutes from './routes/auth.routes.js';
import cnicRoutes from './routes/cnic.routes.js';

app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/cnic`, cnicRoutes);

// Other routes will be added here
// app.use(`/api/${API_VERSION}/passengers`, passengerRoutes);
// app.use(`/api/${API_VERSION}/drivers`, driverRoutes);
// app.use(`/api/${API_VERSION}/rides`, rideRoutes);
// app.use(`/api/${API_VERSION}/admin`, adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;

