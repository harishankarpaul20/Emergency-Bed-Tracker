const mongoose = require('mongoose');

const bloodInventorySchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      required: [true, 'Hospital ID is required for blood inventory'],
      index: true,
    },
    bloodGroup: {
      type: String,
      required: [true, 'Blood group is required'],
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        message: '{VALUE} is not a valid blood group',
      },
      index: true,
    },
    component: {
      type: String,
      required: [true, 'Blood component is required'],
      enum: {
        values: ['Whole Blood', 'Packed RBC', 'Platelets', 'Plasma', 'Cryoprecipitate'],
        message: '{VALUE} is not a valid component type',
      },
      default: 'Whole Blood',
      index: true,
    },
    totalUnits: {
      type: Number,
      required: [true, 'Total units must be specified'],
      min: [0, 'Total units cannot be negative'],
      default: 0,
    },
    availableUnits: {
      type: Number,
      required: true,
      min: [0, 'Available units cannot be negative'],
      default: 0,
    },
    reservedUnits: {
      type: Number,
      required: true,
      min: [0, 'Reserved units cannot be negative'],
      default: 0,
    },
    usedUnits: {
      type: Number,
      required: true,
      min: [0, 'Used units cannot be negative'],
      default: 0,
    },
    expiredUnits: {
      type: Number,
      default: 0,
      min: [0, 'Expired units cannot be negative'],
    },
    minThreshold: {
      type: Number,
      default: 5,
      min: [0, 'Minimum threshold cannot be negative'],
    },
    batchId: {
      type: String,
      trim: true,
    },
    collectionDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // Standard ~35 days for Whole Blood
      index: true,
    },
    status: {
      type: String,
      enum: ['Available', 'Low Stock', 'Critical', 'Expired'],
      default: 'Available',
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

// Virtual for hospitalId
bloodInventorySchema.virtual('hospitalId').get(function () {
  if (!this.hospital) return null;
  return this.hospital._id ? this.hospital._id.toString() : this.hospital.toString();
});

// Compound unique index: hospital + bloodGroup + component
bloodInventorySchema.index({ hospital: 1, bloodGroup: 1, component: 1 }, { unique: true });
bloodInventorySchema.index({ bloodGroup: 1, component: 1, status: 1 });
bloodInventorySchema.index({ hospital: 1, status: 1 });

/**
 * Pre-validation hook:
 * Enforces business constraints:
 * - totalUnits >= 0, reservedUnits >= 0, usedUnits >= 0, expiredUnits >= 0
 * - reservedUnits + usedUnits <= totalUnits
 * - availableUnits = Math.max(0, totalUnits - reservedUnits - usedUnits - expiredUnits)
 * - Automatic status evaluation: Expired / Critical / Low Stock / Available
 */
bloodInventorySchema.pre('validate', function () {
  if (this.totalUnits === undefined || this.totalUnits === null) this.totalUnits = 0;
  if (this.reservedUnits === undefined || this.reservedUnits === null) this.reservedUnits = 0;
  if (this.usedUnits === undefined || this.usedUnits === null) this.usedUnits = 0;
  if (this.expiredUnits === undefined || this.expiredUnits === null) this.expiredUnits = 0;

  if (this.reservedUnits + this.usedUnits + this.expiredUnits > this.totalUnits) {
    throw new Error(
      'Total units (' + this.totalUnits + ') cannot be less than reserved (' +
        this.reservedUnits + ') + used (' + this.usedUnits + ') + expired (' + this.expiredUnits + ')'
    );
  }

  this.availableUnits = Math.max(0, this.totalUnits - this.reservedUnits - this.usedUnits - this.expiredUnits);

  const now = new Date();
  if (this.expiryDate && new Date(this.expiryDate) < now) {
    this.status = 'Expired';
    this.availableUnits = 0;
  } else if (this.availableUnits <= 1) {
    this.status = 'Critical';
  } else if (this.availableUnits <= (this.minThreshold || 5)) {
    this.status = 'Low Stock';
  } else {
    this.status = 'Available';
  }

  this.lastUpdated = now;
});

const BloodInventory = mongoose.model('BloodInventory', bloodInventorySchema);
module.exports = BloodInventory;
