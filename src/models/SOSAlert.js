import mongoose from 'mongoose';

const sosAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String }
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'false-alarm'],
    default: 'active'
  },
  emergencyContacts: [{
    name: String,
    phone: String,
    notified: { type: Boolean, default: false },
    notifiedAt: Date
  }],
  adminNotified: { type: Boolean, default: false },
  adminNotifiedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  resolvedAt: Date,
  notes: String,
  alertType: {
    type: String,
    enum: ['manual', 'automatic', 'driver_detected'],
    default: 'manual'
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high'
  },
  description: String,
  audioRecording: String, // URL to audio file if voice activated
  images: [String], // URLs to any images captured
  response: {
    policeNotified: { type: Boolean, default: false },
    policeNotifiedAt: Date,
    ambulanceNotified: { type: Boolean, default: false },
    ambulanceNotifiedAt: Date,
    responseNotes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
sosAlertSchema.index({ status: 1, createdAt: -1 });
sosAlertSchema.index({ userId: 1 });
sosAlertSchema.index({ rideId: 1 });
sosAlertSchema.index({ 'location': '2dsphere' });

// Virtual for duration
sosAlertSchema.virtual('duration').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return Math.floor((this.resolvedAt - this.createdAt) / 1000); // in seconds
  }
  return null;
});

// Static method to get active alerts count
sosAlertSchema.statics.getActiveCount = function() {
  return this.countDocuments({ status: 'active' });
};

// Instance method to resolve alert
sosAlertSchema.methods.resolve = function(adminId, notes) {
  this.status = 'resolved';
  this.resolvedBy = adminId;
  this.resolvedAt = new Date();
  this.notes = notes;
  return this.save();
};

const SOSAlert = mongoose.model('SOSAlert', sosAlertSchema);

export default SOSAlert;