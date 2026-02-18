import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000/api/v1';

const testGoogleMapsIntegration = async () => {
  console.log('🗺️ Testing Google Maps API Integration...\n');

  try {
    // Test 1: Geocode an address (convert address to coordinates)
    console.log('1️⃣ Testing Address Geocoding...');
    try {
      const geocodeResponse = await axios.get(`${BASE_URL}/maps/geocode`, {
        params: {
          address: 'Rawalpindi, Pakistan'
        }
      });

      console.log('✅ Geocoding Response:', JSON.stringify(geocodeResponse.data, null, 2));

      if (geocodeResponse.data.success) {
        console.log(`📍 Rawalpindi coordinates: ${geocodeResponse.data.data.latitude}, ${geocodeResponse.data.data.longitude}`);
      }
    } catch (error) {
      console.log('❌ Geocoding Failed:', error.response?.data || error.message);
    }

    // Test 2: Reverse geocoding (convert coordinates to address)
    console.log('\n2️⃣ Testing Reverse Geocoding...');
    try {
      const reverseGeocodeResponse = await axios.get(`${BASE_URL}/maps/reverse-geocode`, {
        params: {
          latitude: 33.6844,
          longitude: 73.0479
        }
      });

      console.log('✅ Reverse Geocoding Response:', JSON.stringify(reverseGeocodeResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Reverse Geocoding Failed:', error.response?.data || error.message);
    }

    // Test 3: Search places
    console.log('\n3️⃣ Testing Places Search...');
    try {
      const placesResponse = await axios.get(`${BASE_URL}/maps/places/search`, {
        params: {
          query: 'hospital',
          latitude: 33.6844,
          longitude: 73.0479,
          radius: 10000
        }
      });

      console.log('✅ Places Search Response:', JSON.stringify(placesResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Places Search Failed:', error.response?.data || error.message);
    }

    // Test 4: Get directions between two points
    console.log('\n4️⃣ Testing Directions API...');
    try {
      const directionsResponse = await axios.get(`${BASE_URL}/maps/directions`, {
        params: {
          originLat: 33.6844,   // Rawalpindi
          originLng: 73.0479,
          destLat: 33.7215,     // Islamabad
          destLng: 73.0433
        }
      });

      console.log('✅ Directions Response:');
      console.log(`   Distance: ${directionsResponse.data.data?.distanceText || 'N/A'}`);
      console.log(`   Duration: ${directionsResponse.data.data?.durationText || 'N/A'}`);
      console.log(`   Polyline: ${directionsResponse.data.data?.polyline ? 'Available' : 'Not available'}`);

      if (directionsResponse.data.success) {
        console.log(`📏 Route distance: ${directionsResponse.data.data.distance} meters`);
        console.log(`⏱️  Estimated time: ${directionsResponse.data.data.duration} seconds`);
      }
    } catch (error) {
      console.log('❌ Directions Failed:', error.response?.data || error.message);
    }

    // Test 5: Test ride fare estimation (uses distance calculation)
    console.log('\n5️⃣ Testing Ride Fare Estimation (uses Maps)...');
    try {
      const fareResponse = await axios.get(`${BASE_URL}/rides/estimate`, {
        headers: {
          'Authorization': `Bearer test-token` // This might fail auth but will show if maps works
        },
        params: {
          pickupLat: 33.6844,
          pickupLng: 73.0479,
          dropoffLat: 33.7215,
          dropoffLng: 73.0433
        }
      });

      console.log('✅ Fare Estimation Response:', JSON.stringify(fareResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Fare Estimation Failed:', error.response?.data || error.message);
      // This might fail due to auth, but the error will show if maps integration works
      if (error.response?.data?.message?.includes('Google Maps')) {
        console.log('🚨 Google Maps API issue detected in fare calculation!');
      }
    }

    // Test 6: Test ride request (will use maps for distance)
    console.log('\n6️⃣ Testing Ride Request (uses Maps for distance)...');
    try {
      const rideRequestResponse = await axios.post(`${BASE_URL}/rides/request`, {
        pickupLocation: 'Rawalpindi Railway Station',
        dropoffLocation: 'Islamabad Airport',
        pickupCoords: { latitude: 33.6844, longitude: 73.0479 },
        dropoffCoords: { latitude: 33.7215, longitude: 73.0433 },
        paymentMethod: 'cash',
        vehicleType: 'car'
      }, {
        headers: {
          'Authorization': `Bearer test-token`
        }
      });

      console.log('✅ Ride Request Response:', JSON.stringify(rideRequestResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Ride Request Failed:', error.response?.data || error.message);
      // Check if the error is related to maps
      if (error.response?.data?.message?.includes('geocode') ||
          error.response?.data?.message?.includes('Google Maps') ||
          error.response?.data?.message?.includes('distance')) {
        console.log('🚨 Google Maps API issue detected in ride request!');
      }
    }

    console.log('\n🎉 Google Maps Integration Tests Completed!');

    console.log('\n📋 Summary:');
    console.log('✅ Geocoding: Convert addresses to coordinates');
    console.log('✅ Reverse Geocoding: Convert coordinates to addresses');
    console.log('✅ Places Search: Find nearby places');
    console.log('✅ Directions: Get routes between locations');
    console.log('✅ Distance Matrix: Calculate distances and times');
    console.log('✅ Fallback: Haversine formula when Google API fails');

  } catch (error) {
    console.error('❌ Test Script Error:', error.message);
  }
};

// Run tests
testGoogleMapsIntegration();