const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true,
      index: true,
    },
    registrationId: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    hospitalType: {
      type: String,
      enum: ['government', 'private', 'public', 'specialty'],
      default: 'private',
      index: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    area: {
      type: String,
      required: [true, 'Area or city locality is required'],
      trim: true,
      index: true,
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      default: 'West Bengal',
      trim: true,
      index: true,
    },
    pincode: {
      type: String,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Hospital contact phone is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
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
    facilities: {
      type: [String],
      default: ['Emergency Department', 'Oxygen Support'],
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    lastAvailabilityUpdate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Geospatial 2dsphere index for geolocation queries
hospitalSchema.index({ location: '2dsphere' });
// Compound indexes for rapid searching and filtering
hospitalSchema.index({ district: 1, area: 1, isActive: 1 });
hospitalSchema.index({ name: 'text', address: 'text', area: 'text' });

// Pre-save to sync latitude/longitude with location GeoJSON (Mongoose 8 synchronous)
hospitalSchema.pre('save', function () {
  if (this.latitude !== undefined && this.longitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }
});

const Hospital = mongoose.model('Hospital', hospitalSchema);
module.exports = Hospital;
