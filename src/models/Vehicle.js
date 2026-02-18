import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['car', 'bike', 'auto'],
      required: true,
    },
    make: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: new Date().getFullYear() + 1,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    capacity: {
      type: Number,
      default: 4,
      min: 1,
      max: 8,
    },
    images: [{
      type: String, // URLs to uploaded images
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    documents: {
      registration: {
        type: String, // URL to registration document
        default: null,
      },
      insurance: {
        type: String, // URL to insurance document
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vehicleSchema.index({ type: 1 });
vehicleSchema.index({ isActive: 1 });

// Virtual for full vehicle name
vehicleSchema.virtual('fullName').get(function () {
  return `${this.year} ${this.make} ${this.model}`;
});

// Method to check if vehicle is available
vehicleSchema.methods.isAvailable = function () {
  return this.isActive;
};

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;