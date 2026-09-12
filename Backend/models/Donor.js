const mongoose = require('mongoose');

const donationRecordSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
    },
    hospitalName: String,
    bloodGroup: String,
    units: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['Completed', 'Deferred', 'Screening Failed'],
      default: 'Completed',
    },
    notes: String,
  },
  { _id: true, timestamps: true }
);

const donorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Donor name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [18, 'Donor must be at least 18 years old'],
      max: [65, 'Donor age cannot exceed 65 years'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    },
    bloodGroup: {
      type: String,
      required: [true, 'Blood group is required'],
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      select: false, // Protected by default from public queries
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      select: false,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, 'City or Area is required'],
      trim: true,
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastDonationDate: {
      type: Date,
    },
    donationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    donations: [donationRecordSchema],
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

donorSchema.index({ bloodGroup: 1, district: 1, isAvailable: 1 });

const Donor = mongoose.model('Donor', donorSchema);
module.exports = Donor;
