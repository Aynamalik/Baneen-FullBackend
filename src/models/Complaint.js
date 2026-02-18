import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
    complainantType: { type: String, enum: ['passenger', 'driver'], required: true },
    complainantId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'complainantType' },
    targetId: { type: mongoose.Schema.Types.ObjectId, refPath: 'targetType' },
    targetType: { type: String, enum: ['driver', 'passenger', 'app'], required: true },
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  }, { timestamps: true });

const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;