import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function checkTestUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('Connected to MongoDB');

    const testUser = await User.findOne({ email: 'testpassenger@example.com' });

    if (testUser) {
      console.log('✅ Test passenger found:');
      console.log('- Email:', testUser.email);
      console.log('- Phone:', testUser.phone);
      console.log('- Active:', testUser.isActive);
      console.log('- Blocked:', testUser.isBlocked);
      console.log('- Role:', testUser.role);
    } else {
      console.log('❌ Test passenger not found');
    }

    const allUsers = await User.find({}).select('email phone role isActive isBlocked');
    console.log('\nAll users in database:');
    allUsers.forEach((user, i) => {
      console.log(`${i+1}. ${user.email} (${user.role}) - Active: ${user.isActive}, Blocked: ${user.isBlocked}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkTestUser();