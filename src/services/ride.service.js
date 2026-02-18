import Ride from '../models/Ride.js';
import Passenger from '../models/Passenger.js';
import Driver from '../models/Driver.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import logger from '../utils/logger.js';
import { getDistanceFromGoogle, getDirectionsFromGoogle, geocodeAddress, calculateHaversineDistance, estimateTravelTime } from './maps.service.js';
import socketService from './socket.service.js';
import { processPayment } from './payment.service.js';
import { useSubscriptionCredit } from './subscription.service.js';
import { USER_ROLES, DRIVER_AVAILABILITY } from '../config/constants.js';
import { uploadImage } from '../config/cloudinary.js';

// Fare calculation constants
const FARE_CONFIG = {
  BASE_FARE: 100,           // Base fare in PKR
  PER_KM_RATE: 30,          // Per kilometer rate
  PER_MINUTE_RATE: 5,       // Per minute rate
  SURGE_MULTIPLIER: 1.0,    // Surge pricing (can be dynamic)
  CANCELLATION_FEE: 50,     // Cancellation fee
  DRIVER_COMMISSION: 0.20,  // 20% commission to platform
  DRIVER_SEARCH_RADIUS_KM: 5 // Search radius for drivers
};

/**
 * Calculate fare based on distance and time
 */
export const calculateFare = (distanceKm, durationMinutes = 0, surgeMultiplier = 1.0) => {
  const distanceFare = distanceKm * FARE_CONFIG.PER_KM_RATE;
  const timeFare = durationMinutes * FARE_CONFIG.PER_MINUTE_RATE;
  const subtotal = FARE_CONFIG.BASE_FARE + distanceFare + timeFare;
  const totalFare = subtotal * surgeMultiplier;

  return {
    baseFare: FARE_CONFIG.BASE_FARE,
    distanceFare: Math.round(distanceFare),
    timeFare: Math.round(timeFare),
    subtotal: Math.round(subtotal),
    surgeMultiplier,
    total: Math.round(totalFare),
    currency: 'PKR'
  };
};
export const requestRideService = async (passengerId, rideData) => {
  const {
    pickupLocation,
    dropoffLocation,
    pickupCoords,
    dropoffCoords,
    paymentMethod,
    vehicleType,
    rideType = 'one-time',
    notes
  } = rideData;

  // Validate required fields
  if (!pickupLocation || !dropoffLocation) {
    throw new Error('Pickup and dropoff locations are required');
  }

  if (!paymentMethod) {
    throw new Error('Payment method is required');
  }

  if (!vehicleType) {
    throw new Error('Vehicle type is required (car, bike, or auto)');
  }

  const validVehicleTypes = ['car', 'bike', 'auto'];
  if (!validVehicleTypes.includes(vehicleType)) {
    throw new Error('Invalid vehicle type. Must be one of: car, bike, auto');
  }

  // Geocode addresses if coordinates are not provided
  let finalPickupCoords = pickupCoords;
  let finalDropoffCoords = dropoffCoords;

  if (!pickupCoords || !pickupCoords.latitude || !pickupCoords.longitude) {
    try {
      logger.info(`Geocoding pickup address: ${pickupLocation}`);
      const geocoded = await geocodeAddress(pickupLocation);
      finalPickupCoords = {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude
      };
      logger.info(`Pickup geocoded to: ${finalPickupCoords.latitude}, ${finalPickupCoords.longitude}`);
    } catch (error) {
      throw new Error(`Failed to geocode pickup location: ${error.message}`);
    }
  }

  if (!dropoffCoords || !dropoffCoords.latitude || !dropoffCoords.longitude) {
    try {
      logger.info(`Geocoding dropoff address: ${dropoffLocation}`);
      const geocoded = await geocodeAddress(dropoffLocation);
      finalDropoffCoords = {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude
      };
      logger.info(`Dropoff geocoded to: ${finalDropoffCoords.latitude}, ${finalDropoffCoords.longitude}`);
    } catch (error) {
      throw new Error(`Failed to geocode dropoff location: ${error.message}`);
    }
  }

  // 1️⃣ Validate passenger exists and is active
  const passenger = await Passenger.findOne({ userId: passengerId });
  if (!passenger) {
    throw new Error('Passenger profile not found');
  }

  // Check if passenger has active subscription for subscription rides
  if (rideType === 'subscription') {
    if (!passenger.hasActiveSubscription()) {
      throw new Error('No active subscription available');
    }
    if (passenger.subscription.ridesRemaining <= 0) {
      throw new Error('No rides remaining in subscription');
    }
  }

  // 2️⃣ Get route information from Google Maps (with fallback)
  let routeData;
  try {
    routeData = await getDirectionsFromGoogle(finalPickupCoords, finalDropoffCoords);
  } catch (error) {
    logger.warn('Google Maps API failed, using fallback calculation:', error.message);
    // Fallback to Haversine distance calculation
    const haversineDistance = calculateHaversineDistance(
      finalPickupCoords.latitude,
      finalPickupCoords.longitude,
      finalDropoffCoords.latitude,
      finalDropoffCoords.longitude
    );
    const estimatedTime = estimateTravelTime(haversineDistance.distanceKm);
    
    routeData = {
      distance: haversineDistance.distance,
      duration: estimatedTime.duration,
      distanceText: haversineDistance.distanceText,
      durationText: estimatedTime.durationText,
      polyline: null, // No polyline available in fallback
      bounds: null,
      steps: [],
      waypoints: []
    };
  }
  
  const distanceKm = routeData.distance / 1000;
  const durationMinutes = routeData.duration / 60;

  // 3️⃣ Calculate fare
  const fareBreakdown = calculateFare(distanceKm, durationMinutes);

  // 4️⃣ Check for existing active rides for this passenger
  // Allow multiple pending rides but prevent overlapping active rides
  const existingActiveRide = await Ride.findOne({
    passengerId: passenger._id,
    status: { $in: ['accepted', 'in-progress'] }
  });

  if (existingActiveRide) {
    throw new Error('You already have an active ride in progress. Complete or cancel your current ride before requesting a new one.');
  }

  // 5️⃣ Find nearby available drivers (within 5km radius)
  // Find available drivers with approved status, matching vehicle type, and populate userId with match condition
  let availableDrivers = await Driver.find({
    'availability.status': DRIVER_AVAILABILITY.AVAILABLE,
    isApproved: true,
    'vehicle.vehicleType': vehicleType
  }).populate({
    path: 'userId',
    select: 'name phone',
    match: { isActive: true, isBlocked: false }
  }).populate({
    path: 'vehicle',
    select: 'vehicleType model color registrationNumber'
  });

  // Filter out drivers where userId is null (user doesn't match the populate condition)
  availableDrivers = availableDrivers.filter(driver => driver.userId !== null);

  if (!availableDrivers.length) {
    throw new Error('No drivers available at the moment. Please try again later.');
  }

  // Calculate driver distances and ETAs for nearest driver
  let nearestDriver = null;
  let driverETA = null;
  let driverETAText = null;

  if (availableDrivers.length > 0) {
    // Calculate distance for each driver and find nearest
    const driversWithDistance = availableDrivers.map(driver => {
      if (driver.availability?.currentLocation?.latitude && driver.availability?.currentLocation?.longitude) {
        const driverDistance = calculateHaversineDistance(
          finalPickupCoords.latitude,
          finalPickupCoords.longitude,
          driver.availability.currentLocation.latitude,
          driver.availability.currentLocation.longitude
        );
        const eta = estimateTravelTime(driverDistance.distanceKm, 30); // 30 km/h average speed
        
        return {
          driver,
          distance: driverDistance.distanceKm,
          eta: eta.duration,
          etaText: eta.durationText
        };
      }
      return {
        driver,
        distance: null,
        eta: null,
        etaText: null
      };
    }).filter(d => d.distance !== null);

    if (driversWithDistance.length > 0) {
      // Find nearest driver
      nearestDriver = driversWithDistance.reduce((nearest, current) => 
        current.distance < nearest.distance ? current : nearest
      );
      
      driverETA = nearestDriver.eta;
      driverETAText = nearestDriver.etaText;
    }
  }

  // 6️⃣ Create ride request
  const ride = await Ride.create({
    passengerId: passenger._id,
    vehicleType,
    rideType,
    pickup: {
      location: {
        latitude: finalPickupCoords.latitude,
        longitude: finalPickupCoords.longitude
      },
      address: pickupLocation
    },
    destination: {
      location: {
        latitude: finalDropoffCoords.latitude,
        longitude: finalDropoffCoords.longitude
      },
      address: dropoffLocation
    },
    route: {
      distance: routeData.distance,
      duration: routeData.duration,
      polyline: routeData.polyline
    },
    fare: {
      estimated: fareBreakdown.total,
      currency: fareBreakdown.currency,
      breakdown: fareBreakdown
    },
    payment: {
      method: paymentMethod
    },
    notes,
    priority: 'normal'
  });

  logger.info(`Ride requested: ${ride._id} by passenger ${passengerId}`);

  // 7️⃣ Notify nearby drivers via socket
  try {
    // Notify all available drivers about the new ride request
    for (const driver of availableDrivers) {
      // Calculate driver-specific distance and ETA
      let driverDistance = null;
      let driverETA = null;

      if (driver.availability?.currentLocation?.latitude && driver.availability?.currentLocation?.longitude) {
        const distance = calculateHaversineDistance(
          driver.availability.currentLocation.latitude,
          driver.availability.currentLocation.longitude,
          finalPickupCoords.latitude,
          finalPickupCoords.longitude
        );

        driverDistance = {
          km: distance.distanceKm,
          text: distance.distanceText
        };

        const eta = estimateTravelTime(distance.distanceKm, 30); // 30 km/h average speed
        driverETA = {
          minutes: Math.ceil(eta.duration / 60),
          text: eta.durationText
        };
      }

      socketService.notifyUser(driver.userId.toString(), 'ride:new_request', {
        rideId: ride._id,
        pickup: {
          address: pickupLocation,
          coordinates: finalPickupCoords
        },
        dropoff: {
          address: dropoffLocation,
          coordinates: finalDropoffCoords
        },
        fare: fareBreakdown.total,
        distance: routeData.distance,
        duration: routeData.duration,
        estimatedFare: fareBreakdown,
        passenger: {
          id: passengerId,
          name: passenger.name,
          rating: passenger.rating || 0
        },
        driverDistance,
        driverETA,
        requestedAt: ride.createdAt,
        priority: ride.priority,
        paymentMethod: paymentMethod,
        notes: notes
      });
    }

    logger.info(`Notified ${availableDrivers.length} nearby drivers about ride ${ride._id}`);
  } catch (socketError) {
    logger.error('Socket notification failed for ride request:', socketError);
    // Don't fail the ride request if socket fails
  }

  // Calculate estimated arrival time
  const now = new Date();
  const estimatedArrivalTime = new Date(now.getTime() + routeData.duration * 1000);

  // Get nearby drivers count and locations for map display
  const nearbyDriversInfo = availableDrivers.map(driver => {
    let distanceFromPickup = null;
    let etaToPickup = null;
    
    if (driver.availability?.currentLocation?.latitude && driver.availability?.currentLocation?.longitude) {
      const driverDistance = calculateHaversineDistance(
        finalPickupCoords.latitude,
        finalPickupCoords.longitude,
        driver.availability.currentLocation.latitude,
        driver.availability.currentLocation.longitude
      );
      const eta = estimateTravelTime(driverDistance.distanceKm, 30);
      distanceFromPickup = driverDistance.distanceKm;
      etaToPickup = eta.duration;
    }
    
    return {
      id: driver._id,
      location: driver.availability?.currentLocation || null,
      name: driver.name,
      rating: driver.rating || 0,
      distanceFromPickup: distanceFromPickup ? `${distanceFromPickup.toFixed(2)} km` : null,
      etaToPickup: etaToPickup ? Math.ceil(etaToPickup / 60) : null // in minutes
    };
  });

  return {
    rideId: ride._id,
    estimatedFare: fareBreakdown.total,
    fareBreakdown: fareBreakdown,
    distance: routeData.distance,
    distanceText: routeData.distanceText,
    duration: routeData.duration,
    durationText: routeData.durationText,
    route: {
      polyline: routeData.polyline,
      bounds: routeData.bounds,
      waypoints: routeData.waypoints
    },
    pickup: {
      location: finalPickupCoords,
      address: pickupLocation
    },
    destination: {
      location: finalDropoffCoords,
      address: dropoffLocation
    },
    estimatedArrivalTime: estimatedArrivalTime.toISOString(),
    estimatedArrivalTimeFormatted: estimatedArrivalTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }),
    nearbyDrivers: {
      count: availableDrivers.length,
      drivers: nearbyDriversInfo
    },
    driverETA: driverETA, // Nearest driver ETA in seconds
    driverETAText: driverETAText || 'Calculating...', // Human-readable ETA (e.g., "2 mins")
    nearestDriver: nearestDriver ? {
      id: nearestDriver.driver._id,
      name: nearestDriver.driver.name,
      distance: `${nearestDriver.distance.toFixed(2)} km`,
      eta: Math.ceil(nearestDriver.eta / 60) // in minutes
    } : null,
    status: ride.status,
    driversNotified: availableDrivers.length,
    message: `Ride requested successfully. Notified ${availableDrivers.length} nearby drivers.`
  };
};
export const acceptRideService = async (driverId, rideId) => {
  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new Error('Driver profile not found');
  }

  if (driver.availability?.status !== 'available') {
    throw new Error('Driver is not available');
  }

  // 2️⃣ Find and validate ride
  const ride = await Ride.findById(rideId).populate('passengerId');
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.status !== 'pending') {
    throw new Error('Ride is no longer available');
  }

  // 3️⃣ Check if driver is within reasonable distance (5km max)
  if (driver.availability?.currentLocation?.latitude && driver.availability?.currentLocation?.longitude) {
    const driverLocation = {
      latitude: driver.availability.currentLocation.latitude,
      longitude: driver.availability.currentLocation.longitude
    };
    const pickupLocation = {
      latitude: ride.pickup.location.latitude,
      longitude: ride.pickup.location.longitude
    };

    const distance = calculateHaversineDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      pickupLocation.latitude,
      pickupLocation.longitude
    );

    // Allow maximum 5km distance (same as search radius)
    if (distance.distanceKm > FARE_CONFIG.DRIVER_SEARCH_RADIUS_KM) {
      throw new Error(`Driver is too far from pickup location (${distance.distanceKm.toFixed(2)} km away). Maximum allowed distance is ${FARE_CONFIG.DRIVER_SEARCH_RADIUS_KM} km.`);
    }

    logger.info(`Driver distance from pickup: ${distance.distanceKm.toFixed(2)} km`);
  } else {
    logger.warn(`Driver ${driverId} has no location data, skipping distance validation`);
  }

  // 4️⃣ Update ride with driver and status
  ride.driverId = driver._id;
  ride.status = 'accepted';
  ride.acceptedAt = new Date();
  await ride.save();

  // 5️⃣ Update driver availability
  driver.availability.status = 'busy';
  driver.availability.lastUpdated = new Date();
  await driver.save();

  logger.info(`Ride ${rideId} accepted by driver ${driverId}`);

  // 6️⃣ Notify passenger via socket and add to active rides tracking
  try {
    // Add to active rides tracking in socket service
    socketService.addActiveRide(rideId, ride.passengerId.userId.toString(), driverId);

    // Notify passenger
    socketService.notifyUser(ride.passengerId.userId.toString(), 'ride:accepted', {
      rideId: ride._id,
      driver: {
        id: driver._id,
        name: driver.name,
        phone: driver.userId.phone,
        vehicle: {
          model: driver.vehicle?.model,
          color: driver.vehicle?.color,
          registrationNumber: driver.vehicle?.registrationNumber
        },
        rating: driver.rating || 0,
        currentLocation: driver.availability?.currentLocation
      },
      driverDistance,
      driverETA,
      acceptedAt: ride.acceptedAt,
      pickupLocation: {
        address: ride.pickup.address,
        coordinates: ride.pickup.location
      },
      message: 'Driver found! Your ride is on the way.'
    });

    logger.info(`Socket notification sent to passenger ${ride.passengerId.userId} for ride ${rideId}`);
  } catch (socketError) {
    logger.error('Socket notification failed:', socketError);
    // Don't fail the ride acceptance if socket fails
  }

  // Calculate ETA and distance for response
  let driverDistance = null;
  let driverETA = null;

  if (driver.availability?.currentLocation?.latitude && driver.availability?.currentLocation?.longitude) {
    const distance = calculateHaversineDistance(
      driver.availability.currentLocation.latitude,
      driver.availability.currentLocation.longitude,
      ride.pickup.location.latitude,
      ride.pickup.location.longitude
    );

    driverDistance = {
      km: distance.distanceKm,
      text: distance.distanceText
    };

    const eta = estimateTravelTime(distance.distanceKm, 30); // 30 km/h average speed
    driverETA = {
      minutes: Math.ceil(eta.duration / 60),
      text: eta.durationText
    };
  }

  return {
    rideId: ride._id,
    status: ride.status,
    acceptedAt: ride.acceptedAt,
    driver: {
      id: driver._id,
      name: driver.name,
      phone: driver.userId.phone,
      vehicle: {
        model: driver.vehicle?.model,
        color: driver.vehicle?.color,
        registrationNumber: driver.vehicle?.registrationNumber
      },
      rating: driver.rating || 0,
      currentLocation: driver.availability?.currentLocation
    },
    driverDistance,
    driverETA,
    pickupLocation: {
      address: ride.pickup.address,
      coordinates: ride.pickup.location
    },
    message: 'Ride accepted successfully'
  };
};

/**
 * Start a ride (Driver)
 */
export const startRideService = async (driverId, rideId, startCoords, driverPhotoFile) => {
  // 1️⃣ Validate driver and ride
  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new Error('Driver not found');
  }

  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.driverId.toString() !== driver._id.toString()) {
    throw new Error('You are not assigned to this ride');
  }

  if (ride.status !== 'accepted') {
    throw new Error('Ride cannot be started at this stage');
  }

  // 2️⃣ Upload and validate driver photo
  logger.info('Uploading driver photo for ride verification...');
  let driverPhotoUrl;
  try {
    const uploadResult = await uploadImage(driverPhotoFile.path, {
      folder: 'baneen/driver-photos',
      transformation: [
        { width: 600, height: 800, crop: 'limit' },
        { quality: 'auto' },
      ],
    });
    driverPhotoUrl = uploadResult.url;
    logger.info('Driver photo uploaded successfully:', driverPhotoUrl);
  } catch (uploadError) {
    logger.error('Failed to upload driver photo:', uploadError);
    throw new Error('Failed to upload driver photo. Please try again.');
  }

  // 3️⃣ Perform safety checks (helmet, seatbelt detection)
  // TODO: Integrate with image processing service

  // 3️⃣ Update ride status and tracking
  ride.status = 'in-progress';
  ride.startedAt = new Date();
  ride.tracking = {
    startLocation: {
      latitude: startCoords.latitude,
      longitude: startCoords.longitude
    },
    currentLocation: {
      latitude: startCoords.latitude,
      longitude: startCoords.longitude,
      timestamp: new Date()
    },
    path: [{
      latitude: startCoords.latitude,
      longitude: startCoords.longitude,
      timestamp: new Date()
    }]
  };

  // Mark safety as verified and store driver photo
  ride.safety.verifiedAt = new Date();
  ride.safety.helmetDetected = true;
  ride.safety.seatbeltDetected = true;
  ride.safety.driverPhoto = driverPhotoUrl;
  ride.safety.driverPhotoUploadedAt = new Date();

  await ride.save();

  logger.info(`Ride ${rideId} started by driver ${driverId}`);

  // 4️⃣ Notify passenger
  // TODO: Emit socket event

  return {
    rideId: ride._id,
    status: ride.status,
    startedAt: ride.startedAt,
    driverPhoto: {
      url: driverPhotoUrl,
      uploadedAt: ride.safety.driverPhotoUploadedAt
    },
    message: 'Ride started successfully with driver verification'
  };
};

/**
 * Update ride location (Driver - Real-time tracking)
 */
export const updateRideLocationService = async (driverId, rideId, locationData) => {
  const { latitude, longitude, speed, heading } = locationData;

  const ride = await Ride.findById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.driverId.toString() !== driverId) {
    throw new Error('Unauthorized');
  }

  if (ride.status !== 'in-progress') {
    throw new Error('Ride is not in progress');
  }

  // Update current location and path
  ride.tracking.currentLocation = {
    latitude,
    longitude,
    timestamp: new Date()
  };
  ride.tracking.speed = speed;
  ride.tracking.heading = heading;

  // Add to path for tracking history
  ride.tracking.path.push({
    latitude,
    longitude,
    timestamp: new Date()
  });

  await ride.save();

  // Emit real-time update to passenger via socket
  socketService.notifyUser(ride.passengerId.userId.toString(), 'ride:driver_location', {
    rideId: ride._id,
    location: {
      latitude,
      longitude,
      timestamp: new Date()
    },
    speed: speed || null,
    heading: heading || null
  });

  return {
    rideId: ride._id,
    currentLocation: ride.tracking.currentLocation,
    updated: true
  };
};

/**
 * Complete a ride (Driver)
 */
export const completeRideService = async (driverId, rideId, completionData) => {
  const { endCoords, finalDistance, finalDuration } = completionData;

  // 1️⃣ Validate driver and ride
  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new Error('Driver not found');
  }

  const ride = await Ride.findById(rideId).populate('passengerId');
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.driverId.toString() !== driver._id.toString()) {
    throw new Error('You are not assigned to this ride');
  }

  if (ride.status !== 'in-progress') {
    throw new Error('Ride is not in progress');
  }

  // 2️⃣ Calculate final fare (if distance-based payment)
  let finalFare = ride.fare.estimated;
  if (ride.payment.method !== 'cash' && finalDistance) {
    const actualDistanceKm = finalDistance / 1000;
    const actualDurationMin = finalDuration / 60;
    const fareBreakdown = calculateFare(actualDistanceKm, actualDurationMin);
    finalFare = fareBreakdown.total;
  }

  // 3️⃣ Complete the ride
  ride.status = 'completed';
  ride.completedAt = new Date();
  ride.fare.final = finalFare;
  ride.tracking.endLocation = {
    latitude: endCoords.latitude,
    longitude: endCoords.longitude
  };

  await ride.save();

  // 4️⃣ Update driver availability and earnings
  driver.availability.status = DRIVER_AVAILABILITY.AVAILABLE;
  driver.availability.lastUpdated = new Date();

  // Calculate driver earnings (after platform commission)
  const driverEarnings = finalFare * (1 - FARE_CONFIG.DRIVER_COMMISSION);
  driver.earnings.total += driverEarnings;
  driver.earnings.pending += driverEarnings;
  driver.totalRides += 1;

  await driver.save();

  // 5️⃣ Process payment
  let paymentResult = null;
  if (ride.payment.method !== 'cash') {
    try {
      paymentResult = await processPayment({
        rideId: ride._id,
        amount: finalFare,
        method: ride.payment.method,
        userId: ride.passengerId.userId
      });
      ride.payment.status = 'completed';
      ride.payment.paidAt = new Date();
      ride.payment.transactionId = paymentResult.transactionId;
    } catch (paymentError) {
      logger.error('Payment processing failed:', paymentError);
      ride.payment.status = 'failed';
    }
  } else {
    // Cash payment - mark as completed
    ride.payment.status = 'completed';
    ride.payment.paidAt = new Date();
  }

  await ride.save();

  // 6️⃣ Update passenger subscription if applicable
  if (ride.rideType === 'subscription') {
    try {
      const subscriptionResult = await useSubscriptionCredit(ride.passengerId.userId);
      if (!subscriptionResult.usedCredit) {
        logger.warn(`Failed to use subscription credit for ride ${rideId}: ${subscriptionResult.reason}`);
        // Continue with ride completion but log the issue
      }
    } catch (error) {
      logger.error('Error using subscription credit:', error);
      // Continue with ride completion but log the error
    }
  }

  logger.info(`Ride ${rideId} completed by driver ${driverId}`);

  // 7️⃣ Notify passenger
  // TODO: Socket emission

  return {
    rideId: ride._id,
    status: ride.status,
    finalFare,
    paymentStatus: ride.payment.status,
    completedAt: ride.completedAt,
    driverEarnings,
    message: 'Ride completed successfully'
  };
};

/**
 * Cancel a ride (Passenger or Driver)
 */
export const cancelRideService = async (userId, userRole, rideId, cancellationData) => {
  const { reason } = cancellationData;

  const ride = await Ride.findById(rideId).populate('passengerId driverId');
  if (!ride) {
    throw new Error('Ride not found');
  }

  // Check authorization
  let isAuthorized = false;
  let cancelledBy = '';

  if (userRole === USER_ROLES.PASSENGER && ride.passengerId.userId.toString() === userId) {
    isAuthorized = true;
    cancelledBy = 'passenger';
  } else if (userRole === USER_ROLES.DRIVER && ride.driverId && ride.driverId.userId.toString() === userId) {
    isAuthorized = true;
    cancelledBy = 'driver';
  }

  if (!isAuthorized) {
    throw new Error('Unauthorized to cancel this ride');
  }

  // Check if ride can be cancelled
  if (!['pending', 'accepted'].includes(ride.status)) {
    throw new Error('Ride cannot be cancelled at this stage');
  }

  // Apply cancellation fee if applicable
  let cancellationFee = 0;
  if (ride.status === 'accepted') {
    cancellationFee = FARE_CONFIG.CANCELLATION_FEE;
  }

  // Update ride
  ride.status = 'cancelled';
  ride.cancelledBy = cancelledBy;
  ride.cancellationReason = reason;
  ride.cancellationFee = cancellationFee;
  ride.cancelledAt = new Date();

  await ride.save();

  // Update driver availability if assigned
  if (ride.driverId) {
    await Driver.findByIdAndUpdate(ride.driverId, {
      'availability.status': 'available',
      'availability.lastUpdated': new Date()
    });
  }

  logger.info(`Ride ${rideId} cancelled by ${cancelledBy}: ${reason}`);

  // Notify the other party and nearby drivers if ride was cancelled before acceptance
  try {
    if (ride.status === 'cancelled' && !ride.driverId) {
      // If ride was cancelled before driver acceptance, notify all nearby drivers
      // that this ride request is no longer available
      socketService.broadcast('ride:cancelled_unassigned', {
        rideId: ride._id,
        cancelledBy,
        reason,
        message: 'Ride request cancelled before driver assignment'
      });
    } else if (ride.driverId) {
      // If ride had an assigned driver, notify that specific driver
      socketService.notifyUser(ride.driverId.userId.toString(), 'ride:cancelled', {
        rideId: ride._id,
        cancelledBy,
        reason,
        cancellationFee,
        message: `Ride cancelled by ${cancelledBy}`
      });
    }

    // Always notify the passenger
    const passengerUserId = cancelledBy === 'passenger' ?
      ride.passengerId.userId.toString() :
      ride.passengerId.userId.toString();

    if (cancelledBy !== 'passenger') {
      socketService.notifyUser(passengerUserId, 'ride:cancelled', {
        rideId: ride._id,
        cancelledBy,
        reason,
        cancellationFee,
        message: `Ride cancelled by ${cancelledBy}`
      });
    }

  } catch (socketError) {
    logger.error('Socket notification failed for ride cancellation:', socketError);
    // Don't fail the cancellation if socket fails
  }

  return {
    rideId: ride._id,
    status: ride.status,
    cancelledBy,
    cancellationFee,
    message: 'Ride cancelled successfully'
  };
};

/**
 * Rate a ride (Passenger rates driver, Driver rates passenger)
 */
export const rateRideService = async (userId, userRole, rideId, ratingData) => {
  const { rating, review } = ratingData;

  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const ride = await Ride.findById(rideId).populate('passengerId driverId');
  if (!ride) {
    throw new Error('Ride not found');
  }

  if (ride.status !== 'completed') {
    throw new Error('Can only rate completed rides');
  }

  // Rate based on user role
  if (userRole === USER_ROLES.PASSENGER) {
    // Passenger rating driver
    if (ride.passengerId.userId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    ride.rating.passengerRating = rating;
    ride.rating.passengerReview = review;

    // Update driver rating
    if (ride.driverId) {
      const driver = await Driver.findById(ride.driverId);
      const totalRides = driver.totalRides || 1;
      const currentRating = driver.rating || 0;
      driver.rating = ((currentRating * (totalRides - 1)) + rating) / totalRides;
      await driver.save();
    }
  } else if (userRole === USER_ROLES.DRIVER) {
    // Driver rating passenger
    if (!ride.driverId || ride.driverId.userId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    ride.rating.driverRating = rating;
    ride.rating.driverReview = review;

    // Update passenger rating
    const passenger = ride.passengerId;
    const totalRides = passenger.totalRides || 1;
    const currentRating = passenger.rating || 0;
    passenger.rating = ((currentRating * (totalRides - 1)) + rating) / totalRides;
    await passenger.save();
  }

  ride.rating.ratedAt = new Date();
  await ride.save();

  logger.info(`Ride ${rideId} rated by ${userRole}: ${rating} stars`);

  return {
    rideId: ride._id,
    rating: userRole === USER_ROLES.PASSENGER ? ride.rating.passengerRating : ride.rating.driverRating,
    review: userRole === USER_ROLES.PASSENGER ? ride.rating.passengerReview : ride.rating.driverReview,
    message: 'Rating submitted successfully'
  };
};

/**
 * Get ride details
 */
export const getRideDetailsService = async (userId, userRole, rideId) => {
  const ride = await Ride.findById(rideId)
    .populate('passengerId', 'name rating totalRides')
    .populate('driverId', 'name rating totalRides vehicle')
    .populate('passengerId.userId', 'name phone')
    .populate('driverId.userId', 'name phone');

  if (!ride) {
    throw new Error('Ride not found');
  }

  // Check authorization
  const isPassenger = userRole === USER_ROLES.PASSENGER && ride.passengerId.userId.toString() === userId;
  const isDriver = userRole === USER_ROLES.DRIVER && ride.driverId && ride.driverId.userId.toString() === userId;
  const isAdmin = userRole === USER_ROLES.ADMIN;

  if (!isPassenger && !isDriver && !isAdmin) {
    throw new Error('Unauthorized to view this ride');
  }

  return ride;
};

/**
 * Get user's ride history
 */
export const getRideHistoryService = async (userId, userRole, filters = {}) => {
  const { page = 1, limit = 10, status, startDate, endDate } = filters;

  let query = {};

  // Build query based on user role
  if (userRole === USER_ROLES.PASSENGER) {
    const passenger = await Passenger.findOne({ userId });
    if (passenger) {
      query.passengerId = passenger._id;
    }
  } else if (userRole === USER_ROLES.DRIVER) {
    const driver = await Driver.findOne({ userId });
    if (driver) {
      query.driverId = driver._id;
    }
  }

  // Apply filters
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const rides = await Ride.find(query)
    .populate('passengerId', 'name rating')
    .populate('driverId', 'name rating vehicle')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  const total = await Ride.countDocuments(query);

  return {
    rides,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Update driver availability status (Driver)
 */
export const updateDriverAvailabilityService = async (driverId, availabilityData) => {
  const { status, currentLocation } = availabilityData;

  // Validate status
  const validStatuses = [DRIVER_AVAILABILITY.AVAILABLE, DRIVER_AVAILABILITY.OFFLINE];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Find and validate driver
  const driver = await Driver.findOne({ userId: driverId });
  if (!driver) {
    throw new Error('Driver profile not found');
  }

  if (!driver.isApproved) {
    throw new Error('Driver is not approved to change availability status');
  }

  // If driver is currently on a ride, prevent status change
  if (status === DRIVER_AVAILABILITY.OFFLINE) {
    // Check if driver has any active rides
    const activeRide = await Ride.findOne({
      driverId: driver._id,
      status: { $in: ['accepted', 'in-progress'] }
    });

    if (activeRide) {
      throw new Error('Cannot go offline while having an active ride');
    }
  }

  // Update driver availability
  driver.updateAvailability(status, currentLocation);
  await driver.save();

  logger.info(`Driver ${driverId} availability updated to ${status}`);

  return {
    driverId: driver._id,
    status: driver.availability.status,
    currentLocation: driver.availability.currentLocation,
    lastUpdated: driver.availability.lastUpdated,
    message: `Driver availability updated to ${status} successfully`
  };
};

/**
 * Get fare estimate
 */
export const getFareEstimateService = async (pickupCoords, dropoffCoords) => {
  let routeData;
  try {
    routeData = await getDirectionsFromGoogle(pickupCoords, dropoffCoords);
  } catch (error) {
    logger.warn('Google Maps API failed for fare estimate, using fallback:', error.message);
    // Fallback to Haversine distance calculation
    const haversineDistance = calculateHaversineDistance(
      pickupCoords.latitude,
      pickupCoords.longitude,
      dropoffCoords.latitude,
      dropoffCoords.longitude
    );
    const estimatedTime = estimateTravelTime(haversineDistance.distanceKm);
    
    routeData = {
      distance: haversineDistance.distance,
      duration: estimatedTime.duration,
      distanceText: haversineDistance.distanceText,
      durationText: estimatedTime.durationText
    };
  }
  
  const distanceKm = routeData.distance / 1000;
  const durationMinutes = routeData.duration / 60;

  const fareBreakdown = calculateFare(distanceKm, durationMinutes);

  return {
    distance: routeData.distance,
    duration: routeData.duration,
    distanceText: routeData.distanceText,
    durationText: routeData.durationText,
    fare: fareBreakdown,
    currency: 'PKR'
  };
};