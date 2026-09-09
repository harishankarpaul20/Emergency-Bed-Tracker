const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Hospital ID is required for bed inventory'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Bed category type is required'],
      enum: {
        values: ['general', 'icu', 'oxygen', 'ventilator'],
        message: '{VALUE} is not a supported bed category',
      },
      index: true,
    },
    totalBeds: {
      type: Number,
      required: [true, 'Total beds must be specified'],
      min: [0, 'Total beds cannot be negative'],
    },
    occupiedBeds: {
      type: Number,
      required: true,
      min: [0, 'Occupied beds cannot be negative'],
      default: 0,
    },
    reservedBeds: {
      type: Number,
      required: true,
      min: [0, 'Reserved beds cannot be negative'],
      default: 0,
    },
    availableBeds: {
      type: Number,
      required: true,
      min: [0, 'Available beds cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for hospitalId referencing hospital ObjectId
bedSchema.virtual('hospitalId').get(function () {
  if (!this.hospital) return null;
  return this.hospital._id ? this.hospital._id.toString() : this.hospital.toString();
});

// Compound unique index: A hospital can have only one record per bed category
bedSchema.index({ hospital: 1, type: 1 }, { unique: true });

/**
 * Pre-validation hook:
 * Enforces business rule:
 * totalBeds >= 0, occupiedBeds >= 0, reservedBeds >= 0
 * occupiedBeds + reservedBeds <= totalBeds
 * availableBeds = totalBeds - occupiedBeds - reservedBeds
 */
bedSchema.pre('validate', function () {
  if (this.totalBeds === undefined || this.totalBeds === null) {
    this.totalBeds = 0;
  }
  if (this.occupiedBeds === undefined || this.occupiedBeds === null) {
    this.occupiedBeds = 0;
  }
  if (this.reservedBeds === undefined || this.reservedBeds === null) {
    this.reservedBeds = 0;
  }

  // Check constraint
  if (this.occupiedBeds + this.reservedBeds > this.totalBeds) {
    throw new Error(
      `Total beds (${this.totalBeds}) must be greater than or equal to occupied (${this.occupiedBeds}) + reserved (${this.reservedBeds})`
    );
  }

  // Calculate available beds strictly
  this.availableBeds = Math.max(0, this.totalBeds - this.occupiedBeds - this.reservedBeds);
  this.lastUpdated = new Date();
});

const Bed = mongoose.model('Bed', bedSchema);
module.exports = Bed;
