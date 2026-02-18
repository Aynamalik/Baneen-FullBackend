import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

async function checkPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'testpassenger@example.com' }).select('+password');

    if (user) {
      console.log('User found');
      console.log('Password hash:', user.password);

      // Test password comparison
      const isValid = await bcrypt.compare('test123', user.password);
      console.log('Password "test123" valid:', isValid);
    } else {
      console.log('User not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkPassword();