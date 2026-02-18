import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Driver from './src/models/Driver.js';
import User from './src/models/User.js';

// Load environment variables
dotenv.config();

async function checkDrivers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/baneen', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');
    console.log('='.repeat(50));

    // Check total drivers
    const totalDrivers = await Driver.countDocuments();
    console.log(`Total drivers in database: ${totalDrivers}`);

    if (totalDrivers > 0) {
      // Check driver approval status
      const approvedDrivers = await Driver.countDocuments({ isApproved: true });
      const unapprovedDrivers = await Driver.countDocuments({ isApproved: false });
      console.log(`Approved drivers: ${approvedDrivers}`);
      console.log(`Unapproved drivers: ${unapprovedDrivers}`);

      // Check availability status
      const availableDrivers = await Driver.countDocuments({
        'availability.status': 'available',
        isApproved: true
      });
      const offlineDrivers = await Driver.countDocuments({
        'availability.status': 'offline',
        isApproved: true
      });
      const busyDrivers = await Driver.countDocuments({
        'availability.status': 'busy',
        isApproved: true
      });

      console.log(`Available approved drivers: ${availableDrivers}`);
      console.log(`Offline approved drivers: ${offlineDrivers}`);
      console.log(`Busy approved drivers: ${busyDrivers}`);

      console.log('\nSample drivers:');
      const sampleDrivers = await Driver.find({})
        .limit(5)
        .populate('userId', 'name email phone isActive isBlocked')
        .select('name isApproved availability.status userId');

      sampleDrivers.forEach((driver, i) => {
        console.log(`${i+1}. Name: ${driver.name}`);
        console.log(`   Approved: ${driver.isApproved}`);
        console.log(`   Status: ${driver.availability?.status || 'no status set'}`);
        console.log(`   User Active: ${driver.userId?.isActive}`);
        console.log(`   User Blocked: ${driver.userId?.isBlocked}`);
        console.log('');
      });

      // Check driver users
      const totalDriverUsers = await User.countDocuments({ role: 'driver' });
      const activeDriverUsers = await User.countDocuments({
        role: 'driver',
        isActive: true,
        isBlocked: false
      });

      console.log(`Total driver user accounts: ${totalDriverUsers}`);
      console.log(`Active unblocked driver users: ${activeDriverUsers}`);
    }

    console.log('='.repeat(50));

    if (totalDrivers === 0) {
      console.log('❌ SOLUTION: No drivers registered in the system');
      console.log('Register some drivers first through the admin panel or API');
    } else if (approvedDrivers === 0) {
      console.log('❌ SOLUTION: No drivers are approved');
      console.log('Approve drivers through the admin panel');
    } else if (availableDrivers === 0) {
      console.log('❌ SOLUTION: No approved drivers are available');
      console.log('Drivers need to set their availability status to "available"');
      console.log('This can be done through the driver app or by updating the database directly');
    }

  } catch (error) {
    console.error('Error checking drivers:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

checkDrivers();