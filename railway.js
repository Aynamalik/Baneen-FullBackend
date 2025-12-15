// Railway-specific server startup
import app from './src/app.js';
import { connectDatabase } from './src/config/database.js';
import logger from './src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Railway assigns PORT automatically
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('🚂 Starting Railway deployment...');
console.log('📊 Environment:', NODE_ENV);
console.log('🌐 Port:', PORT);

// Connect to database
connectDatabase()
  .then(() => {
    console.log('✅ Database connected successfully');

    // Start server with Railway-assigned port
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
      console.log(`📡 API available at http://0.0.0.0:${PORT}/api/v1`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to connect to database:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
