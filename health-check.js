// Health check script for Railway deployment debugging
import dotenv from 'dotenv';
import { connectDatabase } from './src/config/database.js';
import { uploadImage } from './src/config/cloudinary.js';

dotenv.config();

console.log('🏥 Railway Health Check');
console.log('=======================');

// Check environment
console.log('📊 Environment Variables:');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('  PORT:', process.env.PORT || 'undefined');
console.log('  MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
console.log('  CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');

// Check database connection
console.log('\n🗄️ Testing Database Connection...');
try {
  await connectDatabase();
  console.log('✅ Database connection successful');
} catch (error) {
  console.log('❌ Database connection failed:', error.message);
}

// Check Cloudinary (optional)
console.log('\n☁️ Testing Cloudinary...');
try {
  // This will test if Cloudinary credentials work
  await uploadImage(__filename, { folder: 'test' });
  console.log('✅ Cloudinary connection successful');
} catch (error) {
  if (error.message.includes('Cloudinary configuration')) {
    console.log('⚠️ Cloudinary not configured (expected in development)');
  } else {
    console.log('❌ Cloudinary connection failed:', error.message);
  }
}

// Check file system
console.log('\n📁 Testing File System...');
const fs = await import('fs');
const path = await import('path');

const testDir = process.env.RAILWAY_ENVIRONMENT ? '/tmp/test' : './test-temp';
try {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const testFile = path.join(testDir, 'test.txt');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('✅ File system access working');
} catch (error) {
  console.log('❌ File system access failed:', error.message);
}

console.log('\n🏁 Health check complete!');
console.log('If you see ❌ errors above, fix them before deployment.');
