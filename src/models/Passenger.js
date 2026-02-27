import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  relationship: {
    type: String,
    required: true,
  },
}, { _id: true });

const subscriptionSchema = new mongoose.Schema({
  isActive: {
    type: Boolean,
    default: false,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null,
  },
  ridesRemaining: {
    type: Number,
    default: 0,
  },
  expiryDate: {
    type: Date,
    default: null,
  },
});

const passengerSchema = new mongoose.Schema(
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
    emergencyContacts: [emergencyContactSchema],
    subscription: {
      type: subscriptionSchema,
      default: () => ({}),
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
    cnicImage: {
      type: String,
      // required: true,
    }
  },
  {
    timestamps: true,
  }
);

// Indexes
passengerSchema.index({ rating: -1 });

// Virtual for average rating calculation
passengerSchema.virtual('averageRating').get(function () {
  return this.rating || 0;
});

// Method to update rating
passengerSchema.methods.updateRating = function (newRating) {
  // Simple average calculation - can be enhanced with weighted average
  const totalRatings = this.totalRides || 1;
  this.rating = ((this.rating * (totalRatings - 1)) + newRating) / totalRatings;
};

// Method to check if subscription is active
passengerSchema.methods.hasActiveSubscription = function () {
  if (!this.subscription?.isActive) return false;
  if (this.subscription.expiryDate && this.subscription.expiryDate < new Date()) {
    return false;
  }
  return this.subscription.ridesRemaining > 0;
};

const Passenger = mongoose.model('Passenger', passengerSchema);

export default Passenger;

