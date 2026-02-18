const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Simple User schema for testing
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true, select: false },
  role: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  cnic: { type: String, required: true },
  lastLogin: { type: Date, default: null },
  refreshToken: { type: String, default: null },
}, { timestamps: true });

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

async function verifyAdmin() {
  try {
    console.log('🔄 Verifying admin user...');

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

    // Find admin user
    const adminUser = await User.findOne({
      role: 'admin',
      email: 'admin@baneen.com'
    }).select('+password');

    if (!adminUser) {
      console.log('❌ Admin user not found');
      console.log('💡 Creating admin user...');

      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const newAdmin = new User({
        email: 'admin@baneen.com',
        phone: '+923001234567',
        password: hashedPassword,
        cnic: '1111111111111',
        role: 'admin',
        isActive: true,
        isVerified: true,
        isBlocked: false,
      });

      await newAdmin.save();
      console.log('✅ Admin user created successfully');
      return;
    }

    console.log('✅ Admin user found:');
    console.log('   Email:', adminUser.email);
    console.log('   Role:', adminUser.role);
    console.log('   Verified:', adminUser.isVerified);
    console.log('   Active:', adminUser.isActive);
    console.log('   Blocked:', adminUser.isBlocked);

    // Test password verification
    console.log('🔐 Testing password verification...');
    const isValidPassword = await adminUser.comparePassword('admin123');
    console.log('   Password verification result:', isValidPassword ? 'SUCCESS' : 'FAILED');

    if (!isValidPassword) {
      console.log('❌ Password verification failed. Recreating admin user...');

      // Recreate with correct password
      const hashedPassword = await bcrypt.hash('admin123', 10);
      adminUser.password = hashedPassword;
      await adminUser.save();
      console.log('✅ Admin password reset successfully');
    }

    console.log('\n📋 Admin Login Credentials:');
    console.log('========================================');
    console.log('Email: admin@baneen.com');
    console.log('Password: admin123');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

verifyAdmin();