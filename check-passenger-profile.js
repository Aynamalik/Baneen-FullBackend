import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Passenger from './src/models/Passenger.js';

dotenv.config();

async function checkPassengerProfile() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    const testUser = await User.findOne({ email: 'testpassenger@example.com' });

    if (testUser) {
      console.log('✅ Test user found:', testUser._id);

      const passengerProfile = await Passenger.findOne({ userId: testUser._id });

      if (passengerProfile) {
        console.log('✅ Passenger profile found');
        console.log('- Name:', passengerProfile.name);
        console.log('- Rating:', passengerProfile.rating);
      } else {
        console.log('❌ Passenger profile NOT found');
      }
    } else {
      console.log('❌ Test user not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkPassengerProfile();