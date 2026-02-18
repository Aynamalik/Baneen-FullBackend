import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Get distance and duration between two points using Google Maps Distance Matrix API
 */
export const getDistanceFromGoogle = async (pickupCoords, dropoffCoords) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${pickupCoords.latitude},${pickupCoords.longitude}&destinations=${dropoffCoords.latitude},${dropoffCoords.longitude}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    logger.info('Google Maps Distance Matrix API Response:', {
      status: response.data.status,
      origin: `${pickupCoords.latitude},${pickupCoords.longitude}`,
      destination: `${dropoffCoords.latitude},${dropoffCoords.longitude}`
    });

    if (response.data.status !== 'OK') {
      throw new Error(response.data.error_message || 'Google Maps API error');
    }

    const element = response.data.rows?.[0]?.elements?.[0];

    if (!element || element.status !== 'OK') {
      throw new Error('No route found between the specified locations');
    }

    return {
      distance: element.distance.value, // in meters
      duration: element.duration.value, // in seconds
      distanceText: element.distance.text,
      durationText: element.duration.text
    };
  } catch (error) {
    logger.error('Google Maps Distance API Error:', error.message);
    throw new Error('Failed to calculate distance. Please try again.');
  }
};

/**
 * Get directions and route information using Google Maps Directions API
 */
export const getDirectionsFromGoogle = async (pickupCoords, dropoffCoords) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickupCoords.latitude},${pickupCoords.longitude}&destination=${dropoffCoords.latitude},${dropoffCoords.longitude}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    logger.info('Google Maps Directions API Response:', {
      status: response.data.status,
      routes: response.data.routes?.length || 0
    });

    if (response.data.status !== 'OK') {
      throw new Error(response.data.error_message || 'Google Maps API error');
    }

    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No route found between the specified locations');
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    return {
      distance: leg.distance.value, // in meters
      duration: leg.duration.value, // in seconds
      distanceText: leg.distance.text,
      durationText: leg.duration.text,
      polyline: route.overview_polyline.points,
      bounds: route.bounds,
      steps: leg.steps.map(step => ({
        distance: step.distance.value,
        duration: step.duration.value,
        instructions: step.html_instructions,
        polyline: step.polyline.points
      })),
      waypoints: leg.steps.map(step => ({
        latitude: step.start_location.lat,
        longitude: step.start_location.lng
      }))
    };
  } catch (error) {
    logger.error('Google Maps Directions API Error:', error.message);
    throw new Error('Failed to get directions. Please try again.');
  }
};

/**
 * Geocode an address to coordinates using Google Maps Geocoding API
 */
export const geocodeAddress = async (address) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    logger.info('Google Maps Geocoding API Response:', {
      status: response.data.status,
      results: response.data.results?.length || 0
    });

    if (response.data.status !== 'OK') {
      throw new Error(response.data.error_message || 'Google Maps API error');
    }

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error('Address not found');
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      types: result.types,
      addressComponents: result.address_components
    };
  } catch (error) {
    logger.error('Google Maps Geocoding API Error:', error.message);
    throw new Error('Failed to geocode address. Please try again.');
  }
};

/**
 * Reverse geocode coordinates to address using Google Maps Geocoding API
 */
export const reverseGeocode = async (latitude, longitude) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

  try {
    const response = await axios.get(url);

    logger.info('Google Maps Reverse Geocoding API Response:', {
      status: response.data.status,
      results: response.data.results?.length || 0
    });

    if (response.data.status !== 'OK') {
      throw new Error(response.data.error_message || 'Google Maps API error');
    }

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error('Location not found');
    }

    const result = response.data.results[0];

    return {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      types: result.types,
      addressComponents: result.address_components,
      geometry: result.geometry
    };
  } catch (error) {
    logger.error('Google Maps Reverse Geocoding API Error:', error.message);
    throw new Error('Failed to reverse geocode location. Please try again.');
  }
};

/**
 * Search for places using Google Maps Places API
 */
export const searchPlaces = async (query, location = null, radius = 5000) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;

  if (location) {
    url += `&location=${location.latitude},${location.longitude}&radius=${radius}`;
  }

  try {
    const response = await axios.get(url);

    logger.info('Google Maps Places API Response:', {
      status: response.data.status,
      results: response.data.results?.length || 0
    });

    if (response.data.status !== 'OK') {
      throw new Error(response.data.error_message || 'Google Maps Places API error');
    }

    return response.data.results.map(place => ({
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      location: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng
      },
      types: place.types,
      rating: place.rating,
      priceLevel: place.price_level
    }));
  } catch (error) {
    logger.error('Google Maps Places API Error:', error.message);
    throw new Error('Failed to search places. Please try again.');
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Fallback when Google Maps API is not available
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers

  return {
    distance: distance * 1000, // Convert to meters
    distanceKm: distance,
    distanceText: `${distance.toFixed(1)} km`
  };
};

/**
 * Estimate travel time based on distance and average speed
 * Fallback when Google Maps API is not available
 */
export const estimateTravelTime = (distanceKm, averageSpeedKmh = 30) => {
  const durationHours = distanceKm / averageSpeedKmh;
  const durationMinutes = durationHours * 60;
  const durationSeconds = durationMinutes * 60;

  return {
    duration: Math.round(durationSeconds),
    durationMinutes: Math.round(durationMinutes),
    durationText: `${Math.round(durationMinutes)} mins`
  };
};