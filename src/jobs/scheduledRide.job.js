/**
 * Cron job to activate scheduled rides when pickup time is approaching
 * Runs every 5 minutes
 */
import cron from 'node-cron';
import { processScheduledRides } from '../services/scheduledRide.service.js';
import logger from '../utils/logger.js';

export function startScheduledRideJob() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await processScheduledRides();
      if (result.processed > 0) {
        logger.info(`Scheduled ride job: activated ${result.activated}/${result.processed} ride(s)`);
      }
    } catch (error) {
      logger.error('Scheduled ride job error:', error);
    }
  });

  logger.info('Scheduled ride activation job started (runs every 5 minutes)');
}
