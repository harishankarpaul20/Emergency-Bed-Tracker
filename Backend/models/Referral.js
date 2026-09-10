const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    // Associated records
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bedRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BedRequest',
      default: null,
      index: true,
    },
    emergencyIntake: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyIntake',
      default: null,
      index: true,
    },

    // Referring hospital and clinician
    referringHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Referring hospital is required'],
      index: true,
    },
    referringUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Referring user is required'],
      index: true,
    },

    // Destination hospital and receiving doctor
    receivingHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Destination hospital is required'],
      index: true,
    },
    receivingDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiving doctor is required'],
      index: true,
    },

    // Patient Demographics (both flat and nested support)
    patientName: { type: String, required: true, trim: true },
    patientAge: { type: Number, default: 0 },
    patientSex: { type: String, default: 'Other' },
    emergencyType: { type: String, default: 'General Emergency' },
    contactPhone: { type: String, default: '' },
    bloodGroup: { type: String, default: '' },
    patientInfo: {
      name: { type: String, default: '' },
      age: { type: Number, default: 0 },
      gender: { type: String, default: '' },
      contactPhone: { type: String, default: '' },
      bloodGroup: { type: String, default: '' },
    },

    // Clinical Handoff (both flat and nested support)
    currentProblem: { type: String, default: '' },
    symptoms: { type: String, default: '' },
    diagnosis: { type: String, default: '' },
    treatmentGiven: { type: String, default: '' },
    medicationsGiven: { type: String, default: '' },
    proceduresPerformed: { type: String, default: '' },
    currentCondition: { type: String, default: 'Serious' },
    vitalsObservations: { type: String, default: '' },
    referralReason: { type: String, default: '' },
    specialRequirements: { type: mongoose.Schema.Types.Mixed, default: [] },
    additionalNotes: { type: String, default: '' },
    clinicalHandoff: {
      presentingProblem: { type: String, default: '' },
      symptoms: { type: mongoose.Schema.Types.Mixed, default: [] },
      workingDiagnosis: { type: String, default: '' },
      treatmentGiven: { type: String, default: '' },
      currentMedications: { type: String, default: '' },
      proceduresDone: { type: String, default: '' },
      condition: { type: String, default: '' },
      vitals: { type: mongoose.Schema.Types.Mixed, default: {} },
      referralReason: { type: String, default: '' },
      specialRequirements: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // Automatic Referral Readiness Check Summary Snapshot
    readinessCheck: {
      isReady: { type: Boolean, default: true },
      isComplete: { type: Boolean, default: true },
      hospitalVerified: { type: Boolean, default: true },
      doctorVerified: { type: Boolean, default: true },
      bedCapacityStatus: { type: String, default: 'suitable' },
      approxDistanceKm: { type: Number, default: null },
      distanceKm: { type: Number, default: null },
      estimatedTransitMinutes: { type: Number, default: null },
      evaluatedAt: { type: Date, default: Date.now },
      warnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
      blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },

    // Referral Lifecycle Status
    status: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'rejected',
        'more_information_requested',
        'more_info_requested',
        'transferred',
        'received',
        'completed',
      ],
      default: 'pending',
      index: true,
    },

    // Lifecycle timestamps
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    transferredAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Rejection details
    rejectionReason: { type: String, trim: true, default: '' },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // More Information details
    informationRequest: { type: String, trim: true, default: '' },
    moreInfoRequestedNote: { type: String, trim: true, default: '' },
    informationRequestedAt: { type: Date, default: null },
    informationRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Audit Trail History
    history: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, default: '' },
        hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
        hospitalName: { type: String, default: '' },
        action: { type: String, default: '' },
        actionUpper: { type: String, default: '' },
        fromStatus: { type: String, default: '' },
        toStatus: { type: String, default: '' },
        notes: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    auditTrail: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, default: '' },
        hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
        hospitalName: { type: String, default: '' },
        action: { type: String, default: '' },
        actionUpper: { type: String, default: '' },
        fromStatus: { type: String, default: '' },
        toStatus: { type: String, default: '' },
        notes: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

referralSchema.index({ referringHospital: 1, status: 1 });
referralSchema.index({ receivingHospital: 1, status: 1 });
referralSchema.index({ receivingDoctor: 1, status: 1 });

module.exports = mongoose.model('Referral', referralSchema);
