import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ride from './src/models/Ride.js';

dotenv.config();

async function cleanupRides() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    // Find all rides with status pending, accepted, or in-progress
    const activeRides = await Ride.find({
      status: { $in: ['pending', 'accepted', 'in-progress'] }
    });

    console.log(`Found ${activeRides.length} active rides`);

    for (const ride of activeRides) {
      console.log(`Deleting ride ${ride._id} (status: ${ride.status})`);

      try {
        await Ride.findByIdAndDelete(ride._id);
        console.log(`✅ Ride ${ride._id} deleted`);
      } catch (deleteError) {
        console.log(`❌ Failed to delete ride ${ride._id}: ${deleteError.message}`);
      }
    }

    console.log('Cleanup completed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

cleanupRides();