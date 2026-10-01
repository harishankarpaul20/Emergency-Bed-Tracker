const mongoose = require('mongoose');
const Bed = require('../models/Bed');
const BedRequest = require('../models/BedRequest');
const Hospital = require('../models/Hospital');
const { broadcastBedUpdate } = require('./bedService');

/**
 * Atomically reserve a bed and create a BedRequest within a MongoDB transaction
 */
async function createReservationRequest({
  user,
  hospitalId,
  bedType,
  patientName,
  contactPhone,
  notes,
  io,
}) {
  const hospital = await Hospital.findOne({ _id: hospitalId, isActive: true });
  if (!hospital) {
    const err = new Error('Hospital not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const session = await mongoose.startSession();
  let updatedBed;
  let bedRequest;

  try {
    await session.withTransaction(async () => {
      // ATOMIC CONDITIONAL UPDATE:
      // Decrement availableBeds and increment reservedBeds ONLY if availableBeds > 0
      updatedBed = await Bed.findOneAndUpdate(
        {
          hospital: hospitalId,
          type: bedType,
          availableBeds: { $gt: 0 },
          isActive: true,
        },
        {
          $inc: { reservedBeds: 1, availableBeds: -1 },
          $set: { lastUpdated: new Date() },
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedBed) {
        const err = new Error(
          `No available ${bedType} beds currently at ${hospital.name}.`
        );
        err.statusCode = 409;
        throw err;
      }

      // Create request document linked to the reserved bed within the SAME session
      const createdRequests = await BedRequest.create(
        [
          {
            user: user._id,
            hospital: hospitalId,
            bed: updatedBed._id,
            bedType,
            patientName,
            contactPhone,
            notes,
            status: 'pending',
          },
        ],
        { session }
      );
      bedRequest = createdRequests[0];
    });
  } finally {
    await session.endSession();
  }

  // Real-time broadcast strictly AFTER transaction commit
  broadcastBedUpdate(io, {
    hospitalId: hospitalId.toString(),
    bedType: updatedBed.type,
    availableBeds: updatedBed.availableBeds,
    totalBeds: updatedBed.totalBeds,
    occupiedBeds: updatedBed.occupiedBeds,
    reservedBeds: updatedBed.reservedBeds,
    lastUpdated: updatedBed.lastUpdated,
  });

  return bedRequest;
}

/**
 * Approve a pending bed request (moves reserved bed to occupied) within a MongoDB transaction
 */
async function approveRequest(requestId, io) {
  const session = await mongoose.startSession();
  let request;
  let updatedBed;

  try {
    await session.withTransaction(async () => {
      // ATOMIC CONDITIONAL CLAIM within transaction
      request = await BedRequest.findOneAndUpdate(
        { _id: requestId, status: { $in: ['pending', 'PENDING'] } },
        {
          $set: {
            status: 'approved',
            approvedAt: new Date(),
          },
        },
        { session, returnDocument: 'after' }
      );

      if (!request) {
        const existing = await BedRequest.findById(requestId).session(session);
        if (!existing) {
          const err = new Error('Bed request not found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(`Cannot approve request with status '${existing.status}'`);
        err.statusCode = 400;
        throw err;
      }

      // Atomically move 1 bed from reserved to occupied within SAME session
      updatedBed = await Bed.findOneAndUpdate(
        { _id: request.bed, reservedBeds: { $gt: 0 } },
        {
          $inc: { reservedBeds: -1, occupiedBeds: 1 },
          $set: { lastUpdated: new Date() },
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedBed) {
        const err = new Error('Failed to allocate bed: no reserved beds available to occupy');
        err.statusCode = 409;
        throw err;
      }
    });
  } finally {
    await session.endSession();
  }

  broadcastBedUpdate(io, {
    hospitalId: updatedBed.hospital.toString(),
    bedType: updatedBed.type,
    availableBeds: updatedBed.availableBeds,
    totalBeds: updatedBed.totalBeds,
    occupiedBeds: updatedBed.occupiedBeds,
    reservedBeds: updatedBed.reservedBeds,
    lastUpdated: updatedBed.lastUpdated,
  });

  return request;
}

/**
 * Reject a pending bed request (releases reserved bed back to available) within a MongoDB transaction
 */
async function rejectRequest(requestId, io) {
  const session = await mongoose.startSession();
  let request;
  let updatedBed;

  try {
    await session.withTransaction(async () => {
      // ATOMIC CONDITIONAL CLAIM within transaction
      request = await BedRequest.findOneAndUpdate(
        { _id: requestId, status: { $in: ['pending', 'PENDING'] } },
        {
          $set: {
            status: 'rejected',
            rejectedAt: new Date(),
          },
        },
        { session, returnDocument: 'after' }
      );

      if (!request) {
        const existing = await BedRequest.findById(requestId).session(session);
        if (!existing) {
          const err = new Error('Bed request not found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error(`Cannot reject request with status '${existing.status}'`);
        err.statusCode = 400;
        throw err;
      }

      // Release 1 reserved bed back to available within SAME session
      updatedBed = await Bed.findOneAndUpdate(
        { _id: request.bed, reservedBeds: { $gt: 0 } },
        {
          $inc: { reservedBeds: -1, availableBeds: 1 },
          $set: { lastUpdated: new Date() },
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedBed) {
        const err = new Error('Failed to release bed: no reserved beds available to release');
        err.statusCode = 409;
        throw err;
      }
    });
  } finally {
    await session.endSession();
  }

  broadcastBedUpdate(io, {
    hospitalId: updatedBed.hospital.toString(),
    bedType: updatedBed.type,
    availableBeds: updatedBed.availableBeds,
    totalBeds: updatedBed.totalBeds,
    occupiedBeds: updatedBed.occupiedBeds,
    reservedBeds: updatedBed.reservedBeds,
    lastUpdated: updatedBed.lastUpdated,
  });

  return request;
}

/**
 * Cancel a pending bed request by patient or staff (releases reserved bed) within a MongoDB transaction
 */
async function cancelRequest(requestId, io) {
  const session = await mongoose.startSession();
  let request;
  let updatedBed;

  try {
    await session.withTransaction(async () => {
      // ATOMIC CONDITIONAL CLAIM within transaction
      request = await BedRequest.findOneAndUpdate(
        { _id: requestId, status: { $in: ['pending', 'PENDING'] } },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        },
        { session, returnDocument: 'after' }
      );

      if (!request) {
        const existing = await BedRequest.findById(requestId).session(session);
        if (!existing) {
          const err = new Error('Bed request not found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error('Only pending requests can be cancelled');
        err.statusCode = 400;
        throw err;
      }

      updatedBed = await Bed.findOneAndUpdate(
        { _id: request.bed, reservedBeds: { $gt: 0 } },
        {
          $inc: { reservedBeds: -1, availableBeds: 1 },
          $set: { lastUpdated: new Date() },
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedBed) {
        const err = new Error('Failed to release bed: no reserved beds available to cancel');
        err.statusCode = 409;
        throw err;
      }
    });
  } finally {
    await session.endSession();
  }

  broadcastBedUpdate(io, {
    hospitalId: updatedBed.hospital.toString(),
    bedType: updatedBed.type,
    availableBeds: updatedBed.availableBeds,
    totalBeds: updatedBed.totalBeds,
    occupiedBeds: updatedBed.occupiedBeds,
    reservedBeds: updatedBed.reservedBeds,
    lastUpdated: updatedBed.lastUpdated,
  });

  return request;
}

/**
 * Mark request completed upon patient discharge (releases occupied bed) within a MongoDB transaction
 */
async function completeRequest(requestId, io) {
  const session = await mongoose.startSession();
  let request;
  let updatedBed;

  try {
    await session.withTransaction(async () => {
      // ATOMIC CONDITIONAL CLAIM within transaction
      request = await BedRequest.findOneAndUpdate(
        { _id: requestId, status: { $in: ['approved', 'APPROVED'] } },
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
          },
        },
        { session, returnDocument: 'after' }
      );

      if (!request) {
        const existing = await BedRequest.findById(requestId).session(session);
        if (!existing) {
          const err = new Error('Bed request not found');
          err.statusCode = 404;
          throw err;
        }
        const err = new Error('Only approved requests can be marked completed');
        err.statusCode = 400;
        throw err;
      }

      updatedBed = await Bed.findOneAndUpdate(
        { _id: request.bed, occupiedBeds: { $gt: 0 } },
        {
          $inc: { occupiedBeds: -1, availableBeds: 1 },
          $set: { lastUpdated: new Date() },
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedBed) {
        const err = new Error('Failed to release bed: no occupied beds available to discharge');
        err.statusCode = 409;
        throw err;
      }
    });
  } finally {
    await session.endSession();
  }

  broadcastBedUpdate(io, {
    hospitalId: updatedBed.hospital.toString(),
    bedType: updatedBed.type,
    availableBeds: updatedBed.availableBeds,
    totalBeds: updatedBed.totalBeds,
    occupiedBeds: updatedBed.occupiedBeds,
    reservedBeds: updatedBed.reservedBeds,
    lastUpdated: updatedBed.lastUpdated,
  });

  return request;
}

module.exports = {
  createReservationRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  completeRequest,
};
