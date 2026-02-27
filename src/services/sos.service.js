import SOSAlert from '../models/SOSAlert.js';
import Ride from '../models/Ride.js';
import Passenger from '../models/Passenger.js';
import Driver from '../models/Driver.js';
import { sendSMS } from './sms.service.js';
import { notifyAdmins } from './notification.service.js';
import { formatPhoneNumber } from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { USER_ROLES, NOTIFICATION_TYPES } from '../config/constants.js';

/**
 * Find active ride for user (passenger or driver)
 */
const findActiveRideForUser = async (userId, userRole) => {
  if (userRole === USER_ROLES.PASSENGER) {
    const passenger = await Passenger.findOne({ userId });
    if (!passenger) return null;
    return Ride.findOne({
      passengerId: passenger._id,
      status: { $in: ['accepted', 'in-progress'] },
    });
  }
  if (userRole === USER_ROLES.DRIVER) {
    const driver = await Driver.findOne({ userId });
    if (!driver) return null;
    return Ride.findOne({
      driverId: driver._id,
      status: { $in: ['accepted', 'in-progress'] },
    });
  }
  return null;
};

/**
 * Notify emergency contacts via SMS with live location link
 */
const notifyEmergencyContacts = async (emergencyContacts, userName, location) => {
  const { latitude, longitude, address } = location || {};
  const mapsLink = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : null;
  const coordsText = latitude != null && longitude != null ? `Coordinates: ${latitude}, ${longitude}` : null;
  const locationText = address || coordsText || 'Location shared with emergency services';
  const mapsLine = mapsLink ? `\nOpen location: ${mapsLink}` : '';
  const message = `URGENT: ${userName || 'A Baneen user'} has triggered an SOS alert. Location: ${locationText}. Please check on them immediately.${mapsLine}`;

  const results = [];
  for (const contact of emergencyContacts || []) {
    if (!contact.phone) continue;
    const c = { name: contact.name, phone: contact.phone };
    try {
      const formattedPhone = formatPhoneNumber(contact.phone);
      await sendSMS(formattedPhone, message);
      results.push({ ...c, notified: true, notifiedAt: new Date() });
      logger.info(`SOS: Notified emergency contact ${contact.name} at ${formattedPhone}`);
    } catch (err) {
      logger.error(`SOS: Failed to notify ${contact.phone}:`, err.message);
      results.push({ ...c, notified: false });
    }
  }
  return results;
};

/**
 * Create SOS alert and optionally notify emergency contacts
 */
export const triggerSOSAlertService = async (userId, userRole, data) => {
  const { location: bodyLocation, rideId: bodyRideId, description, severity, alertType, source } = data;

  // Find active ride if not provided
  let ride = null;
  if (bodyRideId) {
    ride = await Ride.findById(bodyRideId);
  }
  if (!ride) {
    ride = await findActiveRideForUser(userId, userRole);
  }

  // Use live location: from body, or from ride's current tracking, or from ride's pickup
  let location = bodyLocation;
  if (!location?.latitude || !location?.longitude) {
    if (ride?.tracking?.currentLocation?.latitude != null && ride?.tracking?.currentLocation?.longitude != null) {
      location = {
        latitude: ride.tracking.currentLocation.latitude,
        longitude: ride.tracking.currentLocation.longitude,
        address: ride.pickup?.address || 'Live location from ride',
      };
    } else if (ride?.pickup?.location?.latitude != null && ride?.pickup?.location?.longitude != null) {
      location = {
        latitude: ride.pickup.location.latitude,
        longitude: ride.pickup.location.longitude,
        address: ride.pickup.address || 'Pickup location',
      };
    }
  }
  if (!location?.latitude || !location?.longitude) {
    throw new Error('Location (latitude and longitude) is required. Enable GPS and try again, or ensure you have an active ride.');
  }

  // Get emergency contacts from passenger profile
  let emergencyContacts = [];
  if (userRole === USER_ROLES.PASSENGER) {
    const passenger = await Passenger.findOne({ userId });
    if (passenger?.emergencyContacts?.length) {
      emergencyContacts = passenger.emergencyContacts.map((ec) => ({
        name: ec.name,
        phone: ec.phone,
        notified: false,
        notifiedAt: null,
      }));
    }
  }

  // Notify emergency contacts with live location (non-blocking)
  let notifiedContacts = [];
  try {
    const passenger = await Passenger.findOne({ userId });
    const userName = passenger?.name;
    notifiedContacts = await notifyEmergencyContacts(
      emergencyContacts,
      userName,
      {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      }
    );
  } catch (err) {
    logger.error('SOS: Emergency contact notification failed:', err);
  }

  const alert = await SOSAlert.create({
    userId,
    rideId: ride?._id || undefined,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
    },
    status: 'active',
    emergencyContacts: notifiedContacts.length ? notifiedContacts : emergencyContacts,
    adminNotified: false,
    alertType: alertType || (source === 'voice_command' ? 'automatic' : 'manual'),
    severity: severity || 'high',
    description: description || (source === 'voice_command' ? 'Voice-activated SOS' : 'Manual SOS alert'),
  });

  // Update ride's safety.sosAlerts if ride exists
  if (ride) {
    ride.safety = ride.safety || {};
    ride.safety.sosAlerts = ride.safety.sosAlerts || [];
    ride.safety.sosAlerts.push({
      triggeredAt: new Date(),
      location: alert.location,
      emergencyContacts: notifiedContacts.length ? notifiedContacts : emergencyContacts,
      resolved: false,
    });
    await ride.save();
  }

  logger.info(`SOS alert created: ${alert._id} for user ${userId}${ride ? `, ride ${ride._id}` : ''}`);

  // Notify all admins
  try {
    await notifyAdmins(
      NOTIFICATION_TYPES.SOS_ALERT,
      'SOS Alert Triggered',
      `A user has triggered an emergency SOS alert. Location: ${location?.address || 'Shared'}`,
      { alertId: alert._id, rideId: ride?._id, userId }
    );
  } catch (notifyErr) {
    logger.error('SOS: Failed to notify admins:', notifyErr);
  }

  return {
    alert: {
      _id: alert._id,
      status: alert.status,
      location: alert.location,
      createdAt: alert.createdAt,
      emergencyContactsNotified: notifiedContacts.filter((c) => c.notified).length,
    },
    rideId: ride?._id,
  };
};
