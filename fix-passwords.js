import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function fixPasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    const hashedPassword = await bcrypt.hash('test123', 10);

    await User.updateOne({ email: 'testpassenger@example.com' }, { password: hashedPassword });
    await User.updateOne({ email: 'testdriver@example.com' }, { password: hashedPassword });

    console.log('✅ Passwords fixed');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

fixPasswords();