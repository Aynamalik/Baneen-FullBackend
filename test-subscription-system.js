import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TEST_TOKEN = process.env.TEST_PASSENGER_TOKEN; // Set this in .env for testing
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN; // Admin token for admin operations

const testSubscriptionSystem = async () => {
  console.log('🧪 Testing Subscription System...\n');

  try {
    // Test 1: Get subscription plans
    console.log('1️⃣ Testing Get Subscription Plans...');
    try {
      const plansResponse = await axios.get(`${BASE_URL}/subscriptions/plans`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      });

      console.log('✅ Subscription Plans Response:', plansResponse.data);

      if (plansResponse.data.data && plansResponse.data.data.length > 0) {
        const firstPlan = plansResponse.data.data[0];

        // Test 2: Subscribe to a plan
        console.log('\n2️⃣ Testing Subscription Purchase...');
        try {
          const subscribeResponse = await axios.post(`${BASE_URL}/subscriptions/subscribe`, {
            planId: firstPlan.id,
            paymentMethod: 'easypaisa'
          }, {
            headers: {
              'Authorization': `Bearer ${TEST_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('✅ Subscription Purchase Response:', subscribeResponse.data);
        } catch (error) {
          console.log('❌ Subscription Purchase Failed:', error.response?.data || error.message);
        }

        // Test 3: Get subscription status
        console.log('\n3️⃣ Testing Subscription Status...');
        try {
          const statusResponse = await axios.get(`${BASE_URL}/subscriptions/status`, {
            headers: {
              'Authorization': `Bearer ${TEST_TOKEN}`
            }
          });

          console.log('✅ Subscription Status Response:', statusResponse.data);
        } catch (error) {
          console.log('❌ Subscription Status Failed:', error.response?.data || error.message);
        }
      }
    } catch (error) {
      console.log('❌ Get Subscription Plans Failed:', error.response?.data || error.message);
    }

    // Test 4: Admin - Get all subscription plans
    console.log('\n4️⃣ Testing Admin - Get All Subscription Plans...');
    try {
      const adminPlansResponse = await axios.get(`${BASE_URL}/subscriptions/admin/plans`, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      console.log('✅ Admin Subscription Plans Response:', adminPlansResponse.data);
    } catch (error) {
      console.log('❌ Admin Get Subscription Plans Failed:', error.response?.data || error.message);
    }

    // Test 5: Admin - Create subscription plan
    console.log('\n5️⃣ Testing Admin - Create Subscription Plan...');
    try {
      const createPlanResponse = await axios.post(`${BASE_URL}/subscriptions/admin/plans`, {
        name: 'Test Premium Plan',
        description: 'Premium subscription for testing',
        ridesIncluded: 50,
        price: 2500,
        currency: 'PKR',
        validityDays: 30,
        validityMonths: 1,
        pricePerRide: 50,
        features: ['Priority booking', 'Dedicated support', 'Free cancellation'],
        isPopular: false,
        badge: 'Premium'
      }, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Create Subscription Plan Response:', createPlanResponse.data);

      // Test 6: Admin - Update subscription plan
      if (createPlanResponse.data.success) {
        console.log('\n6️⃣ Testing Admin - Update Subscription Plan...');
        const planId = createPlanResponse.data.data._id;

        try {
          const updatePlanResponse = await axios.put(`${BASE_URL}/subscriptions/admin/plans/${planId}`, {
            name: 'Test Premium Plan Updated',
            price: 3000,
            ridesIncluded: 60
          }, {
            headers: {
              'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('✅ Update Subscription Plan Response:', updatePlanResponse.data);

          // Test 7: Admin - Delete subscription plan
          console.log('\n7️⃣ Testing Admin - Delete Subscription Plan...');
          try {
            const deletePlanResponse = await axios.delete(`${BASE_URL}/subscriptions/admin/plans/${planId}`, {
              headers: {
                'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
              }
            });

            console.log('✅ Delete Subscription Plan Response:', deletePlanResponse.data);
          } catch (error) {
            console.log('❌ Delete Subscription Plan Failed:', error.response?.data || error.message);
          }
        } catch (error) {
          console.log('❌ Update Subscription Plan Failed:', error.response?.data || error.message);
        }
      }
    } catch (error) {
      console.log('❌ Create Subscription Plan Failed:', error.response?.data || error.message);
    }

    // Test 8: Admin - Get subscription analytics
    console.log('\n8️⃣ Testing Admin - Subscription Analytics...');
    try {
      const analyticsResponse = await axios.get(`${BASE_URL}/subscriptions/admin/analytics`, {
        headers: {
          'Authorization': `Bearer ${TEST_ADMIN_TOKEN}`
        }
      });

      console.log('✅ Subscription Analytics Response:', analyticsResponse.data);
    } catch (error) {
      console.log('❌ Subscription Analytics Failed:', error.response?.data || error.message);
    }

    console.log('\n🎉 Subscription System Tests Completed!');

  } catch (error) {
    console.error('❌ Test Script Error:', error.message);
  }
};

// Run tests
testSubscriptionSystem();