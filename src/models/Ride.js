import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  passengerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Passenger', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  rideType: { type: String, enum: ['one-time', 'subscription'], default: 'one-time' },
  vehicleType: { type: String, enum: ['car', 'bike', 'auto'], required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Location Data
  pickup: {
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    address: { type: String, required: true },
    timestamp: { type: Date }
  },
  destination: {
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    address: { type: String, required: true }
  },

  // Route & Distance Data
  route: {
    distance: { type: Number }, // in meters
    duration: { type: Number }, // in seconds
    polyline: { type: String }, // Google Maps polyline
    waypoints: [{
      latitude: Number,
      longitude: Number,
      timestamp: Date
    }]
  },

  // Fare Data
  fare: {
    estimated: { type: Number, required: true },
    final: { type: Number },
    cancellationFee: { type: Number, default: 0 },
    currency: { type: String, default: 'PKR' },
    breakdown: {
      baseFare: Number,
      distanceFare: Number,
      timeFare: Number,
      waitingFare: Number,
      surgeMultiplier: { type: Number, default: 1.0 }
    }
  },

  // Payment Data
  payment: {
    method: { type: String, enum: ['cash', 'easypaisa', 'jazzcash', 'card'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String },
    gateway: { type: String },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
    paidAt: { type: Date }
  },

  // Real-time Tracking Data
  tracking: {
    startLocation: {
      latitude: Number,
      longitude: Number
    },
    currentLocation: {
      latitude: Number,
      longitude: Number,
      timestamp: Date
    },
    endLocation: {
      latitude: Number,
      longitude: Number
    },
    path: [{
      latitude: Number,
      longitude: Number,
      timestamp: Date
    }],
    speed: Number,
    heading: Number
  },

  // Safety Features
  safety: {
    helmetDetected: { type: Boolean, default: false },
    seatbeltDetected: { type: Boolean, default: false },
    safetyImage: { type: String }, // URL to safety verification image
    driverPhoto: { type: String }, // URL to driver's identity photo (required before ride start)
    driverPhotoUploadedAt: { type: Date },
    verifiedAt: { type: Date },
    sosAlerts: [{
      triggeredAt: { type: Date },
      location: {
        latitude: Number,
        longitude: Number,
        address: String
      },
      emergencyContacts: [{
        name: String,
        phone: String,
        notified: { type: Boolean, default: false },
        notifiedAt: Date
      }],
      resolved: { type: Boolean, default: false },
      resolvedAt: Date,
      notes: String
    }]
  },

  // Ratings & Reviews
  rating: {
    passengerRating: { type: Number, min: 1, max: 5 },
    driverRating: { type: Number, min: 1, max: 5 },
    passengerReview: { type: String },
    driverReview: { type: String },
    ratedAt: { type: Date }
  },

  // Cancellation Data
  cancelledBy: { type: String, enum: ['passenger', 'driver', 'system'] },
  cancellationReason: { type: String },
  cancellationFee: { type: Number, default: 0 },

  // Timestamps
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },

  // Additional Metadata
  priority: { type: String, enum: ['normal', 'high', 'emergency'], default: 'normal' },
  notes: { type: String },
  tags: [{ type: String }], // For filtering and analytics

  // Subscription Reference (if applicable)
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
rideSchema.index({ passengerId: 1, status: 1 });
rideSchema.index({ driverId: 1, status: 1 });
rideSchema.index({ status: 1, createdAt: -1 });
rideSchema.index({ 'pickup.location': '2dsphere' });
rideSchema.index({ 'destination.location': '2dsphere' });
rideSchema.index({ 'tracking.currentLocation': '2dsphere' });

// Virtual for ride duration
rideSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return Math.floor((this.completedAt - this.startedAt) / 1000); // in seconds
  }
  return null;
});

// Virtual for ride distance traveled
rideSchema.virtual('distanceTraveled').get(function() {
  if (this.tracking && this.tracking.path && this.tracking.path.length > 1) {
    // Calculate distance from path points (simplified)
    let distance = 0;
    for (let i = 1; i < this.tracking.path.length; i++) {
      const prev = this.tracking.path[i-1];
      const curr = this.tracking.path[i];
      // Haversine formula for distance between points
      distance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    return distance; // in meters
  }
  return this.route ? this.route.distance : 0;
});

// Helper function for distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

const Ride = mongoose.model('Ride', rideSchema);

export default Ride;