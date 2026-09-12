const BedRequest = require('../models/BedRequest');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const {
  reserveBloodUnits,
  releaseReservedBloodUnits,
  completeReservedBloodUnits,
} = require('../services/bloodInventoryService');

/**
 * @desc Create a multi-hospital blood request
 * @route POST /api/blood-requests
 * @access Public or Private (Citizens, Patients, Doctors)
 */
const createBloodRequest = async (req, res, next) => {
  try {
    const {
      patientName,
      patientAge,
      patientGender,
      patientId,
      contactPhone,
      bloodGroup,
      bloodComponent = 'Whole Blood',
      quantity = 1,
      urgency = 'Normal',
      requiredAt,
      reason,
      notes,
      targetHospitals = [],
      requestingHospitalId,
      emergencyIntakeId,
      referralId,
    } = req.body;

    if (!targetHospitals || !targetHospitals.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one target hospital / blood bank must be selected.',
      });
    }

    const parsedQty = parseInt(quantity, 10) || 1;
    const userId = req.user ? req.user._id : (await User.findOne({ role: 'super_admin' }))?._id;

    // Build recipients array
    const recipients = targetHospitals.map(hId => ({
      hospital: hId,
      status: 'PENDING',
      reservedUnits: 0,
    }));

    const primaryHosp = targetHospitals[0];

    const bloodReq = await BedRequest.create({
      requestType: 'BLOOD',
      user: userId,
      hospital: primaryHosp,
      targetHospitals,
      recipients,
      patientName: patientName.trim(),
      patientAge: patientAge ? parseInt(patientAge, 10) : undefined,
      patientGender,
      patientId: patientId || undefined,
      contactPhone: contactPhone.trim(),
      bloodGroup,
      bloodComponent,
      quantity: parsedQty,
      urgency: urgency || 'Normal',
      requiredAt: requiredAt ? new Date(requiredAt) : new Date(Date.now() + 24 * 3600000),
      reason: reason ? reason.trim() : 'Emergency patient blood requirement',
      notes: notes ? notes.trim() : '',
      requestingHospital: requestingHospitalId || req.user?.hospital || undefined,
      requestingDoctor: req.user?.role === 'doctor' ? req.user._id : undefined,
      emergencyIntake: emergencyIntakeId || undefined,
      referral: referralId || undefined,
      status: 'PENDING',
    });

    // Populate for response
    const populated = await BedRequest.findById(bloodReq._id)
      .populate('recipients.hospital', 'name district area phone')
      .populate('targetHospitals', 'name district area phone')
      .populate('requestingHospital', 'name district phone')
      .populate('requestingDoctor', 'name email specialization')
      .lean();

    // Audit log
    await AuditLog.create({
      user: userId,
      userName: req.user ? req.user.name : patientName,
      role: req.user ? req.user.role : 'patient',
      action: 'BLOOD_REQUEST_CREATED',
      resourceType: 'BedRequest',
      resourceId: bloodReq._id,
      details: {
        bloodGroup,
        bloodComponent,
        quantity: parsedQty,
        urgency,
        recipientsCount: targetHospitals.length,
      },
    });

    if (req.io) {
      req.io.emit('bloodRequestCreated', {
        requestId: bloodReq._id,
        patientName: bloodReq.patientName,
        bloodGroup,
        quantity: parsedQty,
        urgency,
        targetHospitals,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Blood request dispatched successfully to ' + targetHospitals.length + ' selected blood bank(s).',
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get blood requests with role and hospital isolation
 * @route GET /api/blood-requests
 * @access Private
 */
const getBloodRequests = async (req, res, next) => {
  try {
    const { status, urgency, bloodGroup, hospitalId } = req.query;
    const filter = { requestType: 'BLOOD' };

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (urgency && urgency !== 'all') {
      filter.urgency = new RegExp('^' + urgency.trim() + '$', 'i');
    }
    if (bloodGroup && bloodGroup !== 'all') {
      filter.bloodGroup = bloodGroup;
    }

    // Role filtering
    if (req.user.role === 'user') {
      filter.user = req.user._id;
    } else if (['hospital_admin', 'blood_bank_staff', 'doctor'].includes(req.user.role)) {
      const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
      if (!userHosp) {
        return res.status(200).json({ success: true, data: [] });
      }
      filter.$or = [
        { 'recipients.hospital': userHosp },
        { hospital: userHosp },
        { requestingHospital: userHosp },
      ];
    } else if (req.user.role === 'super_admin' && hospitalId) {
      filter.$or = [
        { 'recipients.hospital': hospitalId },
        { hospital: hospitalId },
      ];
    }

    // Sort: Emergency urgency first, then newest
    const requests = await BedRequest.find(filter)
      .populate('recipients.hospital', 'name district area phone')
      .populate('targetHospitals', 'name district area phone')
      .populate('requestingHospital', 'name district phone')
      .populate('requestingDoctor', 'name email specialization')
      .populate('user', 'name email phone')
      .sort({ urgency: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get blood request details by ID
 * @route GET /api/blood-requests/:id
 */
const getBloodRequestById = async (req, res, next) => {
  try {
    const reqDoc = await BedRequest.findOne({ _id: req.params.id, requestType: 'BLOOD' })
      .populate('recipients.hospital', 'name district area phone address')
      .populate('recipients.respondedBy', 'name email role')
      .populate('targetHospitals', 'name district area phone address')
      .populate('requestingHospital', 'name district phone address')
      .populate('requestingDoctor', 'name email phone specialization')
      .populate('user', 'name email phone')
      .populate('emergencyIntake')
      .populate('referral')
      .lean();

    if (!reqDoc) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    res.status(200).json({
      success: true,
      data: reqDoc,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Accept blood request and atomically reserve units
 * @route POST /api/blood-requests/:id/accept
 * @access Private (authorized hospital staff)
 */
const acceptBloodRequest = async (req, res, next) => {
  try {
    const bloodReq = await BedRequest.findOne({ _id: req.params.id, requestType: 'BLOOD' });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    if (!userHosp && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to a hospital.' });
    }

    const targetHospId = userHosp || bloodReq.targetHospitals[0]?.toString();

    // Check recipient entry
    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // Attempt atomic inventory reservation
    const reserveResult = await reserveBloodUnits({
      hospitalId: targetHospId,
      bloodGroup: bloodReq.bloodGroup,
      component: bloodReq.bloodComponent,
      quantity: bloodReq.quantity,
      userId: req.user._id,
      userName: req.user.name,
      requestId: bloodReq._id,
      role: req.user.role,
    });

    if (!reserveResult.success) {
      return res.status(400).json({
        success: false,
        message: reserveResult.message,
        availableUnits: reserveResult.availableUnits,
      });
    }

    // Update recipient
    recipient.status = 'ACCEPTED';
    recipient.respondedBy = req.user._id;
    recipient.respondedAt = new Date();
    recipient.reservedUnits = bloodReq.quantity;

    // Update master request status
    bloodReq.status = 'BLOOD_RESERVED';
    bloodReq.hospital = targetHospId; // Assigned fulfilling hospital
    await bloodReq.save();

    if (req.io) {
      req.io.emit('bloodRequestUpdated', {
        requestId: bloodReq._id,
        status: 'BLOOD_RESERVED',
        fulfillingHospitalId: targetHospId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Blood request accepted and ' + bloodReq.quantity + ' units reserved successfully.',
      data: bloodReq,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Partially accept blood request when available units < requested units
 * @route POST /api/blood-requests/:id/partial-accept
 * @access Private
 */
const partiallyAcceptBloodRequest = async (req, res, next) => {
  try {
    const { availableUnits, notes } = req.body;
    const partialQty = parseInt(availableUnits, 10);

    if (!partialQty || partialQty <= 0) {
      return res.status(400).json({ success: false, message: 'Valid available quantity must be provided.' });
    }

    const bloodReq = await BedRequest.findOne({ _id: req.params.id, requestType: 'BLOOD' });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    const targetHospId = userHosp || bloodReq.targetHospitals[0]?.toString();

    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // Reserve partial quantity
    const reserveResult = await reserveBloodUnits({
      hospitalId: targetHospId,
      bloodGroup: bloodReq.bloodGroup,
      component: bloodReq.bloodComponent,
      quantity: partialQty,
      userId: req.user._id,
      userName: req.user.name,
      requestId: bloodReq._id,
      role: req.user.role,
    });

    if (!reserveResult.success) {
      return res.status(400).json({
        success: false,
        message: reserveResult.message,
        availableUnits: reserveResult.availableUnits,
      });
    }

    recipient.status = 'PARTIALLY_ACCEPTED';
    recipient.respondedBy = req.user._id;
    recipient.respondedAt = new Date();
    recipient.reservedUnits = partialQty;
    recipient.partialUnitsAvailable = partialQty;
    recipient.notes = notes || ('Partial stock available: ' + partialQty + ' of ' + bloodReq.quantity + ' units');

    bloodReq.status = 'PARTIALLY_ACCEPTED';
    bloodReq.hospital = targetHospId;
    await bloodReq.save();

    res.status(200).json({
      success: true,
      message: 'Partially accepted with ' + partialQty + ' units reserved.',
      data: bloodReq,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Reject blood request with mandatory reason
 * @route POST /api/blood-requests/:id/reject
 * @access Private
 */
const rejectBloodRequest = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(422).json({ success: false, message: 'Reason for rejection is mandatory.' });
    }

    const bloodReq = await BedRequest.findOne({ _id: req.params.id, requestType: 'BLOOD' });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    const targetHospId = userHosp || bloodReq.targetHospitals[0]?.toString();

    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // If units were previously held, release them
    if (recipient.reservedUnits > 0) {
      await releaseReservedBloodUnits({
        hospitalId: targetHospId,
        bloodGroup: bloodReq.bloodGroup,
        component: bloodReq.bloodComponent,
        quantity: recipient.reservedUnits,
        userId: req.user._id,
        userName: req.user.name,
        requestId: bloodReq._id,
        reason: 'Request rejected: ' + reason.trim(),
      });
      recipient.reservedUnits = 0;
    }

    recipient.status = 'REJECTED';
    recipient.respondedBy = req.user._id;
    recipient.respondedAt = new Date();
    recipient.responseReason = reason.trim();

    // If all recipients rejected, update master status
    const allRejected = bloodReq.recipients.every(r => r.status === 'REJECTED');
    if (allRejected) {
      bloodReq.status = 'REJECTED';
    }

    await bloodReq.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_REQUEST_REJECTED',
      resourceType: 'BedRequest',
      resourceId: bloodReq._id,
      hospital: targetHospId,
      details: { reason: reason.trim() },
    });

    res.status(200).json({
      success: true,
      message: 'Blood request rejection recorded.',
      data: bloodReq,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Cancel blood request and safely return reserved inventory
 * @route POST /api/blood-requests/:id/cancel
 * @access Private
 */
const cancelBloodRequest = async (req, res, next) => {
  try {
    const bloodReq = await BedRequest.findOne({ _id: req.params.id, requestType: 'BLOOD' });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    // Release any reserved units from all accepting recipients
    for (const r of bloodReq.recipients) {
      if (r.reservedUnits > 0) {
        await releaseReservedBloodUnits({
          hospitalId: r.hospital,
          bloodGroup: bloodReq.bloodGroup,
          component: bloodReq.bloodComponent,
          quantity: r.reservedUnits,
          userId: req.user._id,
          userName: req.user.name,
          requestId: bloodReq._id,
          reason: 'Request cancelled by user',
        });
        r.reservedUnits = 0;
      }
      r.status = 'CANCELLED';
    }

    bloodReq.status = 'CANCELLED';
    bloodReq.cancelledAt = new Date();
    await bloodReq.save();

    res.status(200).json({
      success: true,
      message: 'Blood request cancelled and any held stock returned to available pool.',
      data: bloodReq,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Complete blood collection/transfusion
 * @route POST /api/blood-requests/:id/complete
 * @access Private
 */
const completeBloodRequest = async (req, res, next) => {
  try {
    const bloodReq = await BedRequest.findOne({ _id: req.params.id, requestType: 'BLOOD' });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    const targetHospId = userHosp || bloodReq.hospital?.toString();

    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (recipient && recipient.reservedUnits > 0) {
      await completeReservedBloodUnits({
        hospitalId: targetHospId,
        bloodGroup: bloodReq.bloodGroup,
        component: bloodReq.bloodComponent,
        quantity: recipient.reservedUnits,
        userId: req.user._id,
        userName: req.user.name,
        requestId: bloodReq._id,
      });
      recipient.reservedUnits = 0;
      recipient.status = 'COMPLETED';
    }

    bloodReq.status = 'COMPLETED';
    bloodReq.completedAt = new Date();
    await bloodReq.save();

    res.status(200).json({
      success: true,
      message: 'Blood collection confirmed and units finalized in inventory.',
      data: bloodReq,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBloodRequest,
  getBloodRequests,
  getBloodRequestById,
  acceptBloodRequest,
  partiallyAcceptBloodRequest,
  rejectBloodRequest,
  cancelBloodRequest,
  completeBloodRequest,
};
