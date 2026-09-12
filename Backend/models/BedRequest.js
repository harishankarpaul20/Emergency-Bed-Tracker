const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'SENT',
        'VIEWED',
        'ACCEPTED',
        'REJECTED',
        'PARTIALLY_ACCEPTED',
        'BLOOD_RESERVED',
        'READY_FOR_COLLECTION',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'PENDING',
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    respondedAt: {
      type: Date,
    },
    responseReason: {
      type: String,
      trim: true,
    },
    reservedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    partialUnitsAvailable: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: true, timestamps: true }
);

const bedRequestSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ['BED', 'BLOOD', 'REFERRAL'],
      default: 'BED',
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for a request'],
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: function () {
        return this.requestType === 'BED' || (!this.targetHospitals || this.targetHospitals.length === 0);
      },
      index: true,
    },
    // BED SPECIFIC FIELDS
    bed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: function () {
        return this.requestType === 'BED';
      },
      index: true,
    },
    bedType: {
      type: String,
      enum: ['general', 'icu', 'oxygen', 'ventilator'],
      required: function () {
        return this.requestType === 'BED';
      },
    },

    // PATIENT DETAILS
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      maxlength: [100, 'Patient name cannot exceed 100 characters'],
    },
    patientAge: {
      type: Number,
      min: 0,
      max: 125,
    },
    patientGender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say', 'male', 'female', 'other'],
    },
    patientId: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },

    // BLOOD SPECIFIC FIELDS
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: function () {
        return this.requestType === 'BLOOD';
      },
      index: true,
    },
    bloodComponent: {
      type: String,
      enum: ['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'],
      required: function () {
        return this.requestType === 'BLOOD';
      },
      index: true,
    },
    quantity: {
      type: Number,
      min: [1, 'Quantity must be at least 1 unit'],
      default: 1,
    },
    urgency: {
      type: String,
      enum: ['Normal', 'Urgent', 'Emergency', 'normal', 'urgent', 'emergency'],
      default: 'Normal',
      index: true,
    },
    requiredAt: {
      type: Date,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    requestingHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      index: true,
    },
    requestingDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    targetHospitals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
      },
    ],
    recipients: [recipientSchema],

    // LINKAGES
    emergencyIntake: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyIntake',
      index: true,
    },
    referral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Referral',
      index: true,
    },

    // COMMON FIELDS
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'completed',
        'PENDING',
        'SENT',
        'VIEWED',
        'ACCEPTED',
        'REJECTED',
        'PARTIALLY_ACCEPTED',
        'BLOOD_RESERVED',
        'READY_FOR_COLLECTION',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
      ],
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
  if (this.hospital) {
    return this.hospital._id ? this.hospital._id.toString() : this.hospital.toString();
  }
  if (this.targetHospitals && this.targetHospitals.length > 0) {
    const first = this.targetHospitals[0];
    return first._id ? first._id.toString() : first.toString();
  }
  return null;
});

// Indexes for query performance
bedRequestSchema.index({ hospital: 1, status: 1 });
bedRequestSchema.index({ user: 1, createdAt: -1 });
bedRequestSchema.index({ requestType: 1, status: 1 });
bedRequestSchema.index({ 'recipients.hospital': 1, requestType: 1 });
bedRequestSchema.index({ urgency: 1, createdAt: -1 });

const BedRequest = mongoose.model('BedRequest', bedRequestSchema);
module.exports = BedRequest;
