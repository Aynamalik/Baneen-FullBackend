import express from 'express';
import {
  geocode,
  reverseGeocodeController,
  searchPlacesController,
  getDirections
} from '../controllers/maps.controller.js';

const router = express.Router();

router.get('/geocode', geocode);
router.get('/reverse-geocode', reverseGeocodeController);
router.get('/places/search', searchPlacesController);
router.get('/directions', getDirections);

export default router;
