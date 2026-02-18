import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Driver from './src/models/Driver.js';
import { USER_ROLES, DRIVER_AVAILABILITY } from './src/config/constants.js';

// Load environment variables
dotenv.config();

async function createTestDriver() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/baneen', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Test driver data
    const driverData = {
      email: 'testdriver@example.com',
      phone: '03001234568',
      password: 'test123',
      cnic: '1234567890124',
      role: USER_ROLES.DRIVER,
      name: 'Test Driver'
    };

    // Check if driver user already exists
    let driverUser = await User.findOne({ email: driverData.email });
    if (!driverUser) {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(driverData.password, saltRounds);

      // Create user
      driverUser = new User({
        email: driverData.email,
        phone: driverData.phone,
        password: hashedPassword,
        cnic: driverData.cnic,
        role: driverData.role,
        isActive: true,
        isBlocked: false,
        isVerified: true
      });

      await driverUser.save();
      console.log('✅ Driver user created');
    } else {
      console.log('✅ Driver user already exists');
    }

    // Check if driver profile exists
    let driver = await Driver.findOne({ userId: driverUser._id });
    if (!driver) {
      // Create driver profile
      driver = new Driver({
        userId: driverUser._id,
        name: driverData.name,
        licenseNumber: 'DRV123456789',
        licenseImage: 'https://example.com/license.jpg',
        vehicle: {
          registrationNumber: 'ABC-123',
          model: 'Honda City',
          year: 2020,
          color: 'White',
          insurance: {
            policyNumber: 'INS123456',
            expiryDate: new Date('2025-12-31')
          }
        },
        availability: {
          status: DRIVER_AVAILABILITY.AVAILABLE,
          currentLocation: {
            latitude: 31.5204,
            longitude: 74.3587,
            address: 'Lahore Railway Station'
          },
          lastUpdated: new Date()
        },
        rating: 4.5,
        totalRides: 25,
        completedRides: 23,
        cancelledRides: 2,
        earnings: {
          total: 15000,
          pending: 2000,
          withdrawn: 13000
        },
        isApproved: true,
        approvedAt: new Date()
      });

      await driver.save();
      console.log('✅ Driver profile created and approved');
    } else {
      // Update driver to be approved and available
      driver.isApproved = true;
      driver.approvedAt = new Date();
      driver.availability.status = DRIVER_AVAILABILITY.AVAILABLE;
      driver.availability.currentLocation = {
        latitude: 31.5204,
        longitude: 74.3587,
        address: 'Lahore Railway Station'
      };
      driver.availability.lastUpdated = new Date();

      await driver.save();
      console.log('✅ Driver profile updated to approved and available');
    }

    console.log('\n🎉 Test driver setup complete!');
    console.log('Email: testdriver@example.com');
    console.log('Password: test123');
    console.log('Status: Approved and Available');
    console.log('Location: Lahore Railway Station');

    // Verify the setup
    const totalDrivers = await Driver.countDocuments();
    const approvedDrivers = await Driver.countDocuments({ isApproved: true });
    const availableDrivers = await Driver.countDocuments({
      'availability.status': 'available',
      isApproved: true
    });

    console.log('\n📊 Database Status:');
    console.log(`Total drivers: ${totalDrivers}`);
    console.log(`Approved drivers: ${approvedDrivers}`);
    console.log(`Available approved drivers: ${availableDrivers}`);

  } catch (error) {
    console.error('Error creating test driver:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

createTestDriver();