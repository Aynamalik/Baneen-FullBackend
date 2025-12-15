/**
 * Create .env file for local development
 * Run: node create-env.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envContent = `# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database - Update with your MongoDB connection string
# For local MongoDB: mongodb://localhost:27017/baneen
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/baneen
MONGODB_URI=mongodb://localhost:27017/baneen
MONGODB_DB_NAME=baneen

# JWT Configuration - Change these in production!
JWT_SECRET=test-jwt-secret-key-change-in-production-minimum-32-characters-long-12345
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=test-refresh-secret-key-change-in-production-minimum-32-characters-long-12345
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Log Level
LOG_LEVEL=info
`;

const envPath = join(__dirname, '.env');

try {
  writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ .env file created successfully!');
  console.log('📝 Please update MONGODB_URI with your MongoDB connection string');
  console.log('⚠️  Remember to change JWT secrets in production!');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  process.exit(1);
}

