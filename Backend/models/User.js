const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a user name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Do not return passwordHash in standard queries
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'hospital_admin', 'doctor', 'blood_bank_staff', 'donor', 'super_admin'],
      default: 'user',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: 'Emergency Medicine',
    },
    specialization: {
      type: String,
      trim: true,
      default: 'Emergency Care',
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for hospitalId referencing hospital ObjectId
userSchema.virtual('hospitalId')
  .get(function () {
    if (!this.hospital) return null;
    return this.hospital._id ? this.hospital._id.toString() : this.hospital.toString();
  })
  .set(function (val) {
    this.hospital = val;
  });

// Pre-save hook to hash password before saving (Mongoose 8 async)
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.passwordHash) {
    throw new Error('Password hash not loaded in user document');
  }
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Safe JSON serialization (never include passwordHash)
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  obj.hospitalId = this.hospital ? (this.hospital._id ? this.hospital._id.toString() : this.hospital.toString()) : null;
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
