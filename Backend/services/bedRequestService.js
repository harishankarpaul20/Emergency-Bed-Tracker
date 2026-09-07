const Bed = require('../models/Bed');
const BedRequest = require('../models/BedRequest');
const Hospital = require('../models/Hospital');
const { broadcastBedUpdate } = require('./bedService');

/**
 * Atomically reserve a bed and create a BedRequest
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

  // ATOMIC CONDITIONAL UPDATE:
  // Decrement availableBeds and increment reservedBeds ONLY if availableBeds > 0
  const updatedBed = await Bed.findOneAndUpdate(
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
    { returnDocument: 'after' }
  );

  if (!updatedBed) {
    const err = new Error(
      `No available ${bedType} beds currently at ${hospital.name}.`
    );
    err.statusCode = 409;
    throw err;
  }

  // Create request document linked to the reserved bed
  const bedRequest = await BedRequest.create({
    user: user._id,
    hospital: hospitalId,
    bed: updatedBed._id,
    bedType,
    patientName,
    contactPhone,
    notes,
    status: 'pending',
  });

  // Real-time broadcast
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
 * Approve a pending bed request (moves reserved bed to occupied)
 */
async function approveRequest(requestId, io) {
  const request = await BedRequest.findById(requestId);
  if (!request) {
    const err = new Error('Bed request not found');
    err.statusCode = 404;
    throw err;
  }

  if (request.status !== 'pending') {
    const err = new Error(`Cannot approve request with status '${request.status}'`);
    err.statusCode = 400;
    throw err;
  }

  // Move 1 bed from reserved to occupied
  const updatedBed = await Bed.findOneAndUpdate(
    { _id: request.bed, reservedBeds: { $gt: 0 } },
    {
      $inc: { reservedBeds: -1, occupiedBeds: 1 },
      $set: { lastUpdated: new Date() },
    },
    { returnDocument: 'after' }
  );

  request.status = 'approved';
  request.approvedAt = new Date();
  await request.save();

  if (updatedBed) {
    broadcastBedUpdate(io, {
      hospitalId: updatedBed.hospital.toString(),
      bedType: updatedBed.type,
      availableBeds: updatedBed.availableBeds,
      totalBeds: updatedBed.totalBeds,
      occupiedBeds: updatedBed.occupiedBeds,
      reservedBeds: updatedBed.reservedBeds,
      lastUpdated: updatedBed.lastUpdated,
    });
  }

  return request;
}

/**
 * Reject a pending bed request (releases reserved bed back to available)
 */
async function rejectRequest(requestId, io) {
  const request = await BedRequest.findById(requestId);
  if (!request) {
    const err = new Error('Bed request not found');
    err.statusCode = 404;
    throw err;
  }

  if (request.status !== 'pending') {
    const err = new Error(`Cannot reject request with status '${request.status}'`);
    err.statusCode = 400;
    throw err;
  }

  // Release 1 reserved bed back to available
  const updatedBed = await Bed.findOneAndUpdate(
    { _id: request.bed, reservedBeds: { $gt: 0 } },
    {
      $inc: { reservedBeds: -1, availableBeds: 1 },
      $set: { lastUpdated: new Date() },
    },
    { returnDocument: 'after' }
  );

  request.status = 'rejected';
  request.rejectedAt = new Date();
  await request.save();

  if (updatedBed) {
    broadcastBedUpdate(io, {
      hospitalId: updatedBed.hospital.toString(),
      bedType: updatedBed.type,
      availableBeds: updatedBed.availableBeds,
      totalBeds: updatedBed.totalBeds,
      occupiedBeds: updatedBed.occupiedBeds,
      reservedBeds: updatedBed.reservedBeds,
      lastUpdated: updatedBed.lastUpdated,
    });
  }

  return request;
}

/**
 * Cancel a pending bed request by patient or staff (releases reserved bed)
 */
async function cancelRequest(requestId, io) {
  const request = await BedRequest.findById(requestId);
  if (!request) {
    const err = new Error('Bed request not found');
    err.statusCode = 404;
    throw err;
  }

  if (request.status !== 'pending') {
    const err = new Error(`Only pending requests can be cancelled`);
    err.statusCode = 400;
    throw err;
  }

  const updatedBed = await Bed.findOneAndUpdate(
    { _id: request.bed, reservedBeds: { $gt: 0 } },
    {
      $inc: { reservedBeds: -1, availableBeds: 1 },
      $set: { lastUpdated: new Date() },
    },
    { returnDocument: 'after' }
  );

  request.status = 'cancelled';
  request.cancelledAt = new Date();
  await request.save();

  if (updatedBed) {
    broadcastBedUpdate(io, {
      hospitalId: updatedBed.hospital.toString(),
      bedType: updatedBed.type,
      availableBeds: updatedBed.availableBeds,
      totalBeds: updatedBed.totalBeds,
      occupiedBeds: updatedBed.occupiedBeds,
      reservedBeds: updatedBed.reservedBeds,
      lastUpdated: updatedBed.lastUpdated,
    });
  }

  return request;
}

/**
 * Mark request completed upon patient discharge (releases occupied bed)
 */
async function completeRequest(requestId, io) {
  const request = await BedRequest.findById(requestId);
  if (!request) {
    const err = new Error('Bed request not found');
    err.statusCode = 404;
    throw err;
  }

  if (request.status !== 'approved') {
    const err = new Error(`Only approved requests can be marked completed`);
    err.statusCode = 400;
    throw err;
  }

  const updatedBed = await Bed.findOneAndUpdate(
    { _id: request.bed, occupiedBeds: { $gt: 0 } },
    {
      $inc: { occupiedBeds: -1, availableBeds: 1 },
      $set: { lastUpdated: new Date() },
    },
    { returnDocument: 'after' }
  );

  request.status = 'completed';
  request.completedAt = new Date();
  await request.save();

  if (updatedBed) {
    broadcastBedUpdate(io, {
      hospitalId: updatedBed.hospital.toString(),
      bedType: updatedBed.type,
      availableBeds: updatedBed.availableBeds,
      totalBeds: updatedBed.totalBeds,
      occupiedBeds: updatedBed.occupiedBeds,
      reservedBeds: updatedBed.reservedBeds,
      lastUpdated: updatedBed.lastUpdated,
    });
  }

  return request;
}

module.exports = {
  createReservationRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
  completeRequest,
};
