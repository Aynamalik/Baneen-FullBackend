import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000/api/v1';

const testForgotPasswordFlow = async () => {
  console.log('🧪 Testing Forgot Password Flow...\n');

  try {
    // Test 1: Request password reset with phone
    console.log('1️⃣ Testing Forgot Password Request (Phone)...');
    try {
      const forgotResponse = await axios.post(`${BASE_URL}/auth/forgot-password`, {
        phone: '03001234567' // Use test phone number that should skip SMS
      });

      console.log('✅ Forgot Password Request Response:', forgotResponse.data);
    } catch (error) {
      console.log('❌ Forgot Password Request Failed:');
      console.log('  Status:', error.response?.status);
      console.log('  Data:', error.response?.data);
      console.log('  Message:', error.message);
    }

    // Test 2: Request password reset with email
    console.log('\n2️⃣ Testing Forgot Password Request (Email)...');
    try {
      const forgotEmailResponse = await axios.post(`${BASE_URL}/auth/forgot-password`, {
        email: 'test@example.com' // Use a test email
      });

      console.log('✅ Forgot Password Request (Email) Response:', forgotEmailResponse.data);
    } catch (error) {
      console.log('❌ Forgot Password Request (Email) Failed:');
      console.log('  Status:', error.response?.status);
      console.log('  Data:', error.response?.data);
      console.log('  Message:', error.message);
    }

    // Test 3: Verify reset OTP (assuming we have an OTP)
    console.log('\n3️⃣ Testing Verify Reset OTP...');
    try {
      const verifyOtpResponse = await axios.post(`${BASE_URL}/auth/verify-reset-otp`, {
        identifier: '03001234567',
        otp: '123456' // This would need to be the actual OTP sent
      });

      console.log('✅ Verify Reset OTP Response:', verifyOtpResponse.data);
    } catch (error) {
      console.log('❌ Verify Reset OTP Failed:');
      console.log('  Status:', error.response?.status);
      console.log('  Data:', error.response?.data);
      console.log('  Message:', error.message);
    }

    // Test 4: Reset password (assuming we have a valid token)
    console.log('\n4️⃣ Testing Reset Password...');
    try {
      const resetPasswordResponse = await axios.post(`${BASE_URL}/auth/reset-password`, {
        token: 'fake-reset-token', // This would need to be a real token from step 3
        newPassword: 'newpassword123'
      });

      console.log('✅ Reset Password Response:', resetPasswordResponse.data);
    } catch (error) {
      console.log('❌ Reset Password Failed:');
      console.log('  Status:', error.response?.status);
      console.log('  Data:', error.response?.data);
      console.log('  Message:', error.message);
    }

    // Test 5: Invalid request (missing both email and phone)
    console.log('\n5️⃣ Testing Invalid Request (No email/phone)...');
    try {
      const invalidResponse = await axios.post(`${BASE_URL}/auth/forgot-password`, {});
      console.log('❌ Should have failed but got:', invalidResponse.data);
    } catch (error) {
      console.log('✅ Correctly rejected invalid request:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Forgot Password Flow Tests Completed!');

  } catch (error) {
    console.error('❌ Test Script Error:', error.message);
  }
};

// Run tests
testForgotPasswordFlow();