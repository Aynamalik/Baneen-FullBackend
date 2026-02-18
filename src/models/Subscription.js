import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  ridesIncluded: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'PKR' },
  validityDays: { type: Number, required: true, min: 1 },
  isActive: { type: Boolean, default: true },

  // Features included
  features: {
    priorityBooking: { type: Boolean, default: true },
    dedicatedSupport: { type: Boolean, default: true },
    freeCancellations: { type: Number, default: 3 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 }
  },

  // Usage statistics
  totalSubscriptions: { type: Number, default: 0 },
  activeSubscriptions: { type: Number, default: 0 },

  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  sortOrder: { type: Number, default: 0 },

  // Popular plan indicator
  isPopular: { type: Boolean, default: false },
  badge: String, // e.g., "Most Popular", "Best Value"
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
subscriptionSchema.index({ isActive: 1, sortOrder: 1 });
// Note: name field already has unique: true, so no need for explicit index

// Virtual for price per ride
subscriptionSchema.virtual('pricePerRide').get(function() {
  return this.ridesIncluded > 0 ? (this.price / this.ridesIncluded).toFixed(2) : 0;
});

// Virtual for validity in months
subscriptionSchema.virtual('validityMonths').get(function() {
  return (this.validityDays / 30).toFixed(1);
});

// Pre-save middleware to update sort order if not set
subscriptionSchema.pre('save', async function(next) {
  if (this.isNew && this.sortOrder === 0) {
    const maxOrder = await this.constructor.findOne().sort({ sortOrder: -1 }).select('sortOrder');
    this.sortOrder = maxOrder ? maxOrder.sortOrder + 1 : 1;
  }
  next();
});

// Static method to get active plans
subscriptionSchema.statics.getActivePlans = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1 });
};

// Instance method to calculate savings
subscriptionSchema.methods.calculateSavings = function(singleRidePrice = 150) {
  const totalWithoutSubscription = this.ridesIncluded * singleRidePrice;
  const savings = totalWithoutSubscription - this.price;
  const savingsPercentage = ((savings / totalWithoutSubscription) * 100).toFixed(1);

  return {
    savings: savings,
    savingsPercentage: savingsPercentage,
    totalWithoutSubscription: totalWithoutSubscription
  };
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;