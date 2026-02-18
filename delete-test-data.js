import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function deleteTestData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    // Delete test users
    const result = await User.deleteMany({
      email: { $in: ['testpassenger@example.com', 'testdriver@example.com'] }
    });

    console.log(`Deleted ${result.deletedCount} test users`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

deleteTestData();