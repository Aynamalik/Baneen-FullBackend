/**
 * Scheduled Ride Activation Service
 * Activates scheduled rides when their pickup time is approaching (15 min before)
 * and notifies nearby drivers - same flow as immediate ride request
 */
import Ride from '../models/Ride.js';
import Driver from '../models/Driver.js';
import Passenger from '../models/Passenger.js';
import logger from '../utils/logger.js';
import socketService from './socket.service.js';
import { calculateHaversineDistance, estimateTravelTime } from './maps.service.js';
import { DRIVER_AVAILABILITY } from '../config/constants.js';

const ACTIVATION_BUFFER_MINUTES = 15;

/**
 * Activate a single scheduled ride - transition to pending and notify drivers
 */
export const activateScheduledRide = async (ride) => {
  try {
    const passenger = await Passenger.findById(ride.passengerId);
    if (!passenger) {
      logger.warn(`Scheduled ride ${ride._id}: passenger not found, skipping`);
      return { success: false, reason: 'passenger_not_found' };
    }

    const pickupLocation = ride.pickup.address;
    const dropoffLocation = ride.destination.address;
    const finalPickupCoords = ride.pickup.location;
    const finalDropoffCoords = ride.destination.location;
    const vehicleType = ride.vehicleType;
    const paymentMethod = ride.payment.method;
    const notes = ride.notes;

    // Find available drivers
    let availableDrivers = await Driver.find({
      'availability.status': DRIVER_AVAILABILITY.AVAILABLE,
      isApproved: true,
      'vehicle.vehicleType': vehicleType,
    })
      .populate({
        path: 'userId',
        select: 'name phone',
        match: { isActive: true, isBlocked: false },
      })
      .populate({
        path: 'vehicle',
        select: 'vehicleType model color registrationNumber',
      });

    availableDrivers = availableDrivers.filter((d) => d.userId !== null);

    // Update ride status to pending (now active, waiting for driver)
    ride.status = 'pending';
    await ride.save();

    logger.info(`Scheduled ride ${ride._id} activated, notifying ${availableDrivers.length} drivers`);

    // Notify drivers
    for (const driver of availableDrivers) {
      let driverDistance = null;
      let driverETA = null;

      if (
        driver.availability?.currentLocation?.latitude &&
        driver.availability?.currentLocation?.longitude
      ) {
        const distance = calculateHaversineDistance(
          driver.availability.currentLocation.latitude,
          driver.availability.currentLocation.longitude,
          finalPickupCoords.latitude,
          finalPickupCoords.longitude
        );
        const eta = estimateTravelTime(distance.distanceKm, 30);
        driverDistance = { km: distance.distanceKm, text: distance.distanceText };
        driverETA = { minutes: Math.ceil(eta.duration / 60), text: eta.durationText };
      }

      socketService.notifyUser(driver.userId.toString(), 'ride:new_request', {
        rideId: ride._id,
        pickup: { address: pickupLocation, coordinates: finalPickupCoords },
        dropoff: { address: dropoffLocation, coordinates: finalDropoffCoords },
        fare: ride.fare?.estimated,
        distance: ride.route?.distance,
        duration: ride.route?.duration,
        estimatedFare: ride.fare?.breakdown,
        passenger: {
          id: passenger.userId,
          name: passenger.name,
          rating: passenger.rating || 0,
        },
        driverDistance,
        driverETA,
        requestedAt: ride.updatedAt,
        priority: ride.priority,
        paymentMethod,
        notes,
        isScheduled: true,
        scheduledAt: ride.scheduledAt,
      });
    }

    // Notify passenger that their scheduled ride is now active
    socketService.notifyUser(passenger.userId.toString(), 'ride:scheduled_activated', {
      rideId: ride._id,
      message: 'Your scheduled ride is now active. Drivers are being notified.',
      driversNotified: availableDrivers.length,
    });

    return { success: true, driversNotified: availableDrivers.length };
  } catch (error) {
    logger.error(`Failed to activate scheduled ride ${ride._id}:`, error);
    return { success: false, reason: error.message };
  }
};

/**
 * Process all scheduled rides that are due for activation
 * Run via cron every 5-10 minutes
 */
export const processScheduledRides = async () => {
  const now = new Date();
  const activationThreshold = new Date(
    now.getTime() + ACTIVATION_BUFFER_MINUTES * 60 * 1000
  );

  const ridesToActivate = await Ride.find({
    status: 'scheduled',
    isScheduled: true,
    scheduledAt: { $lte: activationThreshold },
  }).populate('passengerId');

  if (ridesToActivate.length === 0) {
    return { processed: 0 };
  }

  logger.info(`Processing ${ridesToActivate.length} scheduled ride(s) for activation`);

  let activated = 0;
  for (const ride of ridesToActivate) {
    const result = await activateScheduledRide(ride);
    if (result.success) activated++;
  }

  return { processed: ridesToActivate.length, activated };
};
