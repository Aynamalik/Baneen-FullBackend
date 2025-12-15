import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES, USER_STATUS } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      index: true,
    },
    cnic: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    cnicImage: {
      type: String,
      default: null,
    },
    cnicVerificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    cnicVerifiedAt: {
      type: Date,
      default: null,
    },
    cnicVerificationNotes: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

// Indexes (removed duplicates - already defined in schema fields)
userSchema.index({ role: 1, isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user is active
userSchema.methods.isUserActive = function () {
  return this.isActive && !this.isBlocked;
};

const User = mongoose.model('User', userSchema);

export default User;

