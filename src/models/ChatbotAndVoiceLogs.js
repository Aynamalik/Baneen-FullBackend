import mongoose from 'mongoose';

const aiInteractionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['voice', 'chat'], required: true },
    input: { type: String, required: true },
    response: { type: String },
    intent: { type: String },
  },
  { timestamps: true }
);

aiInteractionSchema.index({ user: 1, createdAt: -1 });
aiInteractionSchema.index({ type: 1, createdAt: -1 });

const AiInteraction = mongoose.model('AiInteraction', aiInteractionSchema);

export default AiInteraction;