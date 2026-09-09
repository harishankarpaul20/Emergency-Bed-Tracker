const mongoose = require('mongoose');

const emergencyIntakeSchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      maxlength: [100, 'Patient name cannot exceed 100 characters'],
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [0, 'Age must be at least 0'],
      max: [120, 'Age cannot exceed 120'],
    },
    sex: {
      type: String,
      required: [true, 'Sex is required'],
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    },
    symptoms: {
      type: String,
      required: [true, 'Symptoms description is required'],
      trim: true,
      maxlength: [1000, 'Symptoms description cannot exceed 1000 characters'],
    },
    condition: {
      type: String,
      required: [true, 'Patient condition is required'],
      enum: [
        'Very Serious / Critical',
        'Serious',
        'Moderate',
        'Stable',
        'Unknown',
      ],
    },
    emergencyType: {
      type: String,
      required: [true, 'Emergency type is required'],
      enum: [
        'General Emergency',
        'Accident / Trauma',
        'Cardiac Emergency',
        'Breathing Problem',
        'Stroke Symptoms',
        'Severe Bleeding',
        'Burn',
        'Poisoning',
        'Pregnancy / Obstetric Emergency',
        'Pediatric Emergency',
        'Other',
      ],
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    attendantName: {
      type: String,
      trim: true,
      maxlength: [100, 'Attendant name cannot exceed 100 characters'],
      default: '',
    },
    ambulanceRequired: {
      type: String,
      enum: ['Yes', 'No', 'Not Sure'],
      default: 'Not Sure',
    },
    additionalInformation: {
      type: String,
      trim: true,
      maxlength: [1000, 'Additional information cannot exceed 1000 characters'],
      default: '',
    },
    district: {
      type: String,
      trim: true,
      default: '',
    },
    area: {
      type: String,
      trim: true,
      default: '',
    },
    applicationPriority: {
      type: String,
      enum: [
        'Immediate attention',
        'Urgent attention',
        'Prompt assessment',
        'Emergency assessment',
        'Professional assessment required',
      ],
      default: 'Emergency assessment',
    },
    status: {
      type: String,
      enum: ['received', 'triaged', 'referred', 'closed'],
      default: 'received',
    },
    matchedHospitals: [
      {
        hospital: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Hospital',
        },
        hospitalName: String,
        district: String,
        score: Number,
        matchReasons: [String],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance and district filtering
emergencyIntakeSchema.index({ district: 1, createdAt: -1 });
emergencyIntakeSchema.index({ emergencyType: 1, condition: 1 });

const EmergencyIntake = mongoose.model('EmergencyIntake', emergencyIntakeSchema);
module.exports = EmergencyIntake;
