import { geocodeAddress, reverseGeocode, searchPlaces, getDirectionsFromGoogle } from '../services/maps.service.js';
import logger from '../utils/logger.js';

export const geocode = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    const result = await geocodeAddress(address);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Geocode error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const reverseGeocodeController = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const result = await reverseGeocode(lat, lng);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Reverse geocode error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const searchPlacesController = async (req, res) => {
  try {
    const { query, latitude, longitude, radius } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const location = (latitude && longitude) ? {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    } : null;

    const searchRadius = radius ? parseInt(radius) : 5000;

    const results = await searchPlaces(query, location, searchRadius);

    res.json({
      success: true,
      data: {
        places: results,
        count: results.length
      }
    });

  } catch (error) {
    logger.error('Place search error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getDirections = async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({
        success: false,
        message: 'Origin and destination coordinates are required'
      });
    }

    const origin = {
      latitude: parseFloat(originLat),
      longitude: parseFloat(originLng)
    };

    const destination = {
      latitude: parseFloat(destLat),
      longitude: parseFloat(destLng)
    };

    if (isNaN(origin.latitude) || isNaN(origin.longitude) || 
        isNaN(destination.latitude) || isNaN(destination.longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const result = await getDirectionsFromGoogle(origin, destination);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Directions error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
