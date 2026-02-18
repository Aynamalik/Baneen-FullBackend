import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Admin from './src/models/Admin.js';
import { USER_ROLES } from './src/config/constants.js';

// Load environment variables
dotenv.config();

async function createAdminUser() {
  try {
    console.log('🔄 Checking for admin user...');

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || 'baneen',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      role: USER_ROLES.ADMIN,
      email: 'admin@baneen.com'
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      console.log('📋 Admin Login Credentials:');
      console.log('='.repeat(40));
      console.log('Email: admin@baneen.com');
      console.log('Password: admin123');
      console.log('='.repeat(40));
      return;
    }

    // Create admin user
    console.log('👤 Creating admin user...');

    const adminPassword = await bcrypt.hash('admin123', 10);

    const adminUser = new User({
      email: 'admin@baneen.com',
      phone: '+923001234567',
      password: adminPassword,
      cnic: '1111111111111',
      role: USER_ROLES.ADMIN,
      isActive: true,
      isVerified: true,
      isBlocked: false,
      cnicVerificationStatus: 'verified',
      cnicVerifiedAt: new Date(),
    });

    await adminUser.save();

    // Create admin profile
    const adminProfile = new Admin({
      userId: adminUser._id,
      name: 'System Administrator',
      permissions: ['all'],
      lastLogin: new Date(),
    });

    await adminProfile.save();

    console.log('✅ Admin user created successfully!');
    console.log('📋 Admin Login Credentials:');
    console.log('='.repeat(40));
    console.log('Email: admin@baneen.com');
    console.log('Phone: +923001234567');
    console.log('Password: admin123');
    console.log('='.repeat(40));
    console.log('\n💡 You can now login to the admin panel at http://localhost:5173');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createAdminUser();