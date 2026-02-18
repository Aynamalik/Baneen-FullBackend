import app from './app.js';
import { connectDatabase } from './config/database.js';
import { getRedisClient } from './config/redis.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';
import { createServer } from 'net';
import { createServer as createHttpServer } from 'http';
import socketService from './services/socket.service.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Function to find an available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port is in use, try next port
      resolve(findAvailablePort(parseInt(startPort) + 1));
    });
  });
};

connectDatabase()
  .then(async () => {
    logger.info('Database connected successfully');

    // Initialize Redis if configured (optional - falls back to in-memory)
    if (process.env.REDIS_URL) {
      getRedisClient();
    }

    const availablePort = await findAvailablePort(PORT);

    if (availablePort !== PORT) {
      logger.warn(`Port ${PORT} is in use, using port ${availablePort} instead`);
    }

    // Create HTTP server for both Express and Socket.io
    const server = createHttpServer(app);

    // Initialize Socket.io
    socketService.initialize(server);

    // Start server
    server.listen(availablePort, () => {
      logger.info(`Server running in ${NODE_ENV} mode on port ${availablePort}`);
      logger.info(`API available at http://localhost:${availablePort}/api/v1`);
      logger.info(`Socket.io ready for real-time connections`);
    });
  })
  .catch((error) => {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

