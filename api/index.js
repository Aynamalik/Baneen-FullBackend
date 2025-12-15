// Vercel serverless function entry point
import app from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import logger from '../src/utils/logger.js';

// Ensure database connection for serverless functions
let isConnected = false;

const connectToDatabase = async () => {
  if (!isConnected) {
    try {
      await connectDatabase();
      isConnected = true;
      logger.info('Database connected in serverless function');
    } catch (error) {
      logger.error('Database connection failed in serverless function:', error);
      throw error;
    }
  }
};

// Export the app with database connection
const handler = async (req, res) => {
  try {
    await connectToDatabase();
    return app(req, res);
  } catch (error) {
    logger.error('Serverless function error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default handler;
