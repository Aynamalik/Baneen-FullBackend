import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';

dotenv.config();

async function checkDriverPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'testdriver@example.com' }).select('+password');

    if (user) {
      console.log('Driver user found');
      console.log('Password hash:', user.password);

      // Test password comparison
      const isValid = await bcrypt.compare('test123', user.password);
      console.log('Password "test123" valid:', isValid);

      // Fix the password if it's not valid
      if (!isValid) {
        console.log('Fixing driver password...');
        const hashedPassword = await bcrypt.hash('test123', 10);
        await User.updateOne({ email: 'testdriver@example.com' }, { password: hashedPassword });

        const updatedUser = await User.findOne({ email: 'testdriver@example.com' }).select('+password');
        const newValid = await bcrypt.compare('test123', updatedUser.password);
        console.log('Password fixed. New validation:', newValid);
      }
    } else {
      console.log('Driver user not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkDriverPassword();