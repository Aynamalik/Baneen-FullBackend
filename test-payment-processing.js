import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TEST_TOKEN = process.env.TEST_ADMIN_TOKEN; // Set this in .env for testing

const testPaymentProcessing = async () => {
  console.log('🧪 Testing Payment Processing...\n');

  try {
    // Test 1: Process EasyPaisa payment
    console.log('1️⃣ Testing EasyPaisa Payment...');
    try {
      const easypaisaResponse = await axios.post(`${BASE_URL}/payments/process`, {
        amount: 500,
        method: 'easypaisa',
        rideId: '507f1f77bcf86cd799439011', // Mock ride ID
        orderId: `TEST-EP-${Date.now()}`
      }, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ EasyPaisa Payment Response:', easypaisaResponse.data);
    } catch (error) {
      console.log('❌ EasyPaisa Payment Failed:', error.response?.data || error.message);
    }

    // Test 2: Process JazzCash payment
    console.log('\n2️⃣ Testing JazzCash Payment...');
    try {
      const jazzcashResponse = await axios.post(`${BASE_URL}/payments/process`, {
        amount: 750,
        method: 'jazzcash',
        rideId: '507f1f77bcf86cd799439011', // Mock ride ID
        orderId: `TEST-JC-${Date.now()}`
      }, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ JazzCash Payment Response:', jazzcashResponse.data);
    } catch (error) {
      console.log('❌ JazzCash Payment Failed:', error.response?.data || error.message);
    }

    // Test 3: Process Card payment (Stripe)
    console.log('\n3️⃣ Testing Card Payment (Stripe)...');
    try {
      const cardResponse = await axios.post(`${BASE_URL}/payments/process`, {
        amount: 1000,
        method: 'card',
        rideId: '507f1f77bcf86cd799439011', // Mock ride ID
        orderId: `TEST-CARD-${Date.now()}`
      }, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Card Payment Response:', cardResponse.data);
    } catch (error) {
      console.log('❌ Card Payment Failed:', error.response?.data || error.message);
    }

    // Test 4: Get payment history
    console.log('\n4️⃣ Testing Payment History...');
    try {
      const historyResponse = await axios.get(`${BASE_URL}/payments/history`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      });

      console.log('✅ Payment History Response:', historyResponse.data);
    } catch (error) {
      console.log('❌ Payment History Failed:', error.response?.data || error.message);
    }

    // Test 5: Get payment statistics (Admin)
    console.log('\n5️⃣ Testing Payment Statistics (Admin)...');
    try {
      const statsResponse = await axios.get(`${BASE_URL}/payments/admin/stats`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      });

      console.log('✅ Payment Statistics Response:', statsResponse.data);
    } catch (error) {
      console.log('❌ Payment Statistics Failed:', error.response?.data || error.message);
    }

    console.log('\n🎉 Payment Processing Tests Completed!');

  } catch (error) {
    console.error('❌ Test Script Error:', error.message);
  }
};

// Run tests
testPaymentProcessing();