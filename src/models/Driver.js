import mongoose from 'mongoose';
import { DRIVER_AVAILABILITY } from '../config/constants.js';

const vehicleSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null,
  },
  registrationNumber: {
    type: String,
    required: false,
    default: null,
    // unique: true,
  },
  model: {
    type: String,
    required: false,
    default: null,
  },
  year: {
    type: Number,
    required: false,
    default: null,
  },
  color: {
    type: String,
    required: false,
    default: null,
  },
  vehicleType: {
    type: String,
    enum: ['car', 'bike'],
    required: true,
  },
  vehicleName: {
    type: String,
    required: true,
  },
  owner: {
    type: String,
    required: true,
  },
  insurance: {
    policyNumber: {
      type: String,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    document: {
      type: String,
      default: null,
    },
  },
});

const availabilitySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: Object.values(DRIVER_AVAILABILITY),
    default: DRIVER_AVAILABILITY.OFFLINE,
  },
  currentLocation: {
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const earningsSchema = new mongoose.Schema({
  total: {
    type: Number,
    default: 0,
    min: 0,
  },
  pending: {
    type: Number,
    default: 0,
    min: 0,
  },
  withdrawn: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: false,
      default: null,
      // unique: true,
      sparse: true,
      index: true,
    },
    licenseImage: {
      type: String,
      default: null,
    },
    vehicle: {
      type: vehicleSchema,
      default: null,
    },
    availability: {
      type: availabilitySchema,
      default: () => ({
        status: DRIVER_AVAILABILITY.OFFLINE,
        lastUpdated: Date.now(),
      }),
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    completedRides: {
      type: Number,
      default: 0,
    },
    cancelledRides: {
      type: Number,
      default: 0,
    },
    earnings: {
      type: earningsSchema,
      default: () => ({
        total: 0,
        pending: 0,
        withdrawn: 0,
      }),
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['OFFLINE', 'ONLINE', 'ON_RIDE'],
      default: 'OFFLINE'
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
driverSchema.index({ 'availability.status': 1 });
driverSchema.methods.updateAvailability = function (status, location) {
  this.availability.status = status;
  if (location) {
    this.availability.currentLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || null,
    };
  }
  this.availability.lastUpdated = new Date();
};

// Method to check if driver is available
driverSchema.methods.isAvailable = function () {
  return (
    this.isApproved &&
    this.availability.status === DRIVER_AVAILABILITY.AVAILABLE
  );
};

// Method to update earnings
driverSchema.methods.addEarning = function (amount) {
  this.earnings.total += amount;
  this.earnings.pending += amount;
};

// Method to update rating
driverSchema.methods.updateRating = function (newRating) {
  const totalRatings = this.totalRides || 1;
  this.rating = ((this.rating * (totalRatings - 1)) + newRating) / totalRatings;
};

const Driver = mongoose.model('Driver', driverSchema);

export default Driver;

