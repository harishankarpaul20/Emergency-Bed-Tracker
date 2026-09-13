const mongoose = require('mongoose');

const medicalShopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medical shop name is required'],
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    area: {
      type: String,
      required: [true, 'Area or locality is required'],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      default: 'Kolkata',
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
    },
    pincode: {
      type: String,
      trim: true,
    },
    landmark: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    is24x7: {
      type: Boolean,
      default: true,
      index: true,
    },
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90'],
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180'],
    },
    googleMapsUrl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    services: {
      type: [String],
      default: ['Allopathic Medicines', 'Emergency First Aid', 'Life Saving Drugs'],
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

// Virtual for dynamic Google Maps URL (using coordinates or formatted address fallback)
medicalShopSchema.virtual('directionsUrl').get(function () {
  if (this.googleMapsUrl && this.googleMapsUrl.startsWith('http')) {
    return this.googleMapsUrl;
  }
  if (this.latitude != null && this.longitude != null && !isNaN(this.latitude) && !isNaN(this.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${this.latitude},${this.longitude}`;
  }
  const query = [this.name, this.address, this.area, this.city, this.district, 'West Bengal']
    .filter(Boolean)
    .join(', ');
  return query.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
});

// Indexes for query performance and geospatial filtering
medicalShopSchema.index({ district: 1, is24x7: 1, isActive: 1 });
medicalShopSchema.index({ name: 'text', area: 'text', city: 'text', address: 'text' });

// Explicit collection name 'medicalshops'
const MedicalShop = mongoose.model('MedicalShop', medicalShopSchema, 'medicalshops');

module.exports = MedicalShop;
