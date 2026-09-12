const mongoose = require('mongoose');

const bloodRecipientSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
      index: true,
    },
    bloodBankName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'PENDING',
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
      index: true,
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
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const bloodRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    requestType: {
      type: String,
      default: 'BLOOD',
      immutable: true,
    },

    // A. PATIENT DETAILS (May be a friend, family member, or in-patient)
    patient: {
      name: {
        type: String,
        required: [true, 'Patient name is required'],
        trim: true,
        maxlength: 120,
      },
      patientId: {
        type: String,
        trim: true,
      },
      age: {
        type: Number,
        min: 0,
        max: 130,
      },
      gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
        default: 'Other',
      },
      currentHospital: {
        type: String,
        trim: true,
      },
      currentHospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
      },
      attendingDoctor: {
        type: String,
        trim: true,
      },
      contactPhone: {
        type: String,
        trim: true,
      },
      emergencyIntake: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmergencyIntake',
      },
      referral: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Referral',
      },
    },

    // B. REQUESTER DETAILS (The person/doctor submitting the request)
    requester: {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
      name: {
        type: String,
        required: [true, 'Requester name is required'],
        trim: true,
      },
      contact: {
        type: String,
        trim: true,
      },
      role: {
        type: String,
        enum: [
          'PATIENT',
          'USER',
          'DOCTOR',
          'HOSPITAL_STAFF',
          'BLOOD_BANK_STAFF',
          'HOSPITAL_ADMIN',
          'SUPER_ADMIN',
        ],
        default: 'USER',
      },
      relationshipToPatient: {
        type: String,
        enum: ['Self', 'Friend', 'Family Member', 'Attending Clinician', 'Hospital Staff', 'Other'],
        default: 'Friend',
      },
    },

    // C. CLINICAL BLOOD REQUIREMENT
    bloodRequirement: {
      bloodGroup: {
        type: String,
        required: [true, 'Blood group is required'],
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        index: true,
      },
      component: {
        type: String,
        required: [true, 'Blood component is required'],
        enum: ['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'],
        default: 'Whole Blood',
        index: true,
      },
      quantity: {
        type: Number,
        required: [true, 'Quantity in units is required'],
        min: [1, 'Quantity must be at least 1 unit'],
        max: [50, 'Quantity cannot exceed 50 units per request'],
        default: 1,
      },
      urgency: {
        type: String,
        enum: ['EMERGENCY', 'URGENT', 'NORMAL', 'Emergency', 'Urgent', 'Normal', 'Standard'],
        default: 'EMERGENCY',
        index: true,
      },
      requiredAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    sourceHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
    },

    // D. MULTIPLE RECIPIENTS (Selected hospital blood banks)
    recipients: [bloodRecipientSchema],

    // Primary or fulfilling hospital
    fulfillingHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      index: true,
    },

    // Master request status
    status: {
      type: String,
      enum: [
        'PENDING',
        'PARTIALLY_ACCEPTED',
        'ACCEPTED',
        'BLOOD_RESERVED',
        'READY_FOR_COLLECTION',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED',
        'REJECTED',
      ],
      default: 'PENDING',
      index: true,
    },

    completedAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: 'bloodrequests', // STRICT: Target dedicated bloodrequests collection
  }
);

// Backward compatibility virtuals
bloodRequestSchema.virtual('patientName').get(function () {
  return this.patient?.name || '';
});

bloodRequestSchema.virtual('patientAge').get(function () {
  return this.patient?.age;
});

bloodRequestSchema.virtual('patientSex').get(function () {
  return this.patient?.gender || '';
});

bloodRequestSchema.virtual('contactPhone').get(function () {
  return this.patient?.contactPhone || this.requester?.contact || '';
});

bloodRequestSchema.virtual('bloodGroup').get(function () {
  return this.bloodRequirement?.bloodGroup || '';
});

bloodRequestSchema.virtual('bloodComponent').get(function () {
  return this.bloodRequirement?.component || '';
});

bloodRequestSchema.virtual('quantity').get(function () {
  return this.bloodRequirement?.quantity || 1;
});

bloodRequestSchema.virtual('urgency').get(function () {
  return this.bloodRequirement?.urgency || 'EMERGENCY';
});

bloodRequestSchema.virtual('targetHospitals').get(function () {
  return (this.recipients || []).map(r => r.hospital);
});

// Indexes
bloodRequestSchema.index({ status: 1, 'bloodRequirement.urgency': 1, createdAt: -1 });
bloodRequestSchema.index({ 'recipients.hospital': 1, status: 1 });
bloodRequestSchema.index({ 'requester.user': 1, createdAt: -1 });
bloodRequestSchema.index({ 'bloodRequirement.bloodGroup': 1, 'bloodRequirement.component': 1 });

const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);
module.exports = BloodRequest;
