import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';

dotenv.config();

async function fixPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    // Hash the password the same way as admin
    const hashedPassword = await bcrypt.hash('test123', 10);

    // Update test passenger password
    const result = await User.updateOne(
      { email: 'testpassenger@example.com' },
      { password: hashedPassword }
    );

    console.log('Update result:', result);

    // Verify the password
    const user = await User.findOne({ email: 'testpassenger@example.com' }).select('+password');
    if (user) {
      const isValid = await bcrypt.compare('test123', user.password);
      console.log('Password verification:', isValid);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixPassword();