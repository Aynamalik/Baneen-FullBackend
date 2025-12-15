import app from './app.js';
import { connectDatabase } from './config/database.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';
import { createServer } from 'net';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
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
      resolve(findAvailablePort(startPort + 1));
    });
  });
};

// Connect to database
connectDatabase()
  .then(async () => {
    logger.info('Database connected successfully');

    // Find available port if default is in use
    const availablePort = await findAvailablePort(PORT);

    if (availablePort !== PORT) {
      logger.warn(`Port ${PORT} is in use, using port ${availablePort} instead`);
    }

    // Start server
    app.listen(availablePort, () => {
      logger.info(`Server running in ${NODE_ENV} mode on port ${availablePort}`);
      logger.info(`API available at http://localhost:${availablePort}/api/v1`);
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

