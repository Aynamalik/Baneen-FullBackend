import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'card'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'refunded'], default: 'pending' },
  }, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;