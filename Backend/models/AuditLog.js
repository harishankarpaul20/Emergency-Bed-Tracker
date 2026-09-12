const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: {
      type: String,
      default: 'System User',
    },
    role: {
      type: String,
      default: 'public',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ['BedRequest', 'BloodRequest', 'BloodInventory', 'Donor', 'Hospital', 'Referral', 'User'],
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital',
      index: true,
    },
    hospitalName: String,
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false },
  }
);

auditLogSchema.index({ hospital: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
