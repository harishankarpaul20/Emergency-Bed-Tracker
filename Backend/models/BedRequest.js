const mongoose = require('mongoose');

const bedRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for a bed request'],
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Hospital ID is required for a bed request'],
      index: true,
    },
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: [true, 'Bed record reference is required'],
      index: true,
    },
    bedType: {
      type: String,
      enum: ['general', 'icu', 'oxygen', 'ventilator'],
      required: [true, 'Bed category type is required'],
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      maxlength: [100, 'Patient name cannot exceed 100 characters'],
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for hospitalId referencing hospital ObjectId
bedRequestSchema.virtual('hospitalId').get(function () {
  if (!this.hospital) return null;
  return this.hospital._id ? this.hospital._id.toString() : this.hospital.toString();
});

// Indexes for query performance
bedRequestSchema.index({ hospital: 1, status: 1 });
bedRequestSchema.index({ user: 1, createdAt: -1 });

const BedRequest = mongoose.model('BedRequest', bedRequestSchema);
module.exports = BedRequest;
