const BloodRequest = require('../models/BloodRequest');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const {
  reserveBloodUnits,
  releaseReservedBloodUnits,
  completeReservedBloodUnits,
} = require('../services/bloodInventoryService');

/**
 * Generate human-readable request ID format: BR-XXXXX
 */
function generateRequestId() {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `BR-${rand}`;
}

/**
 * @desc Create a multi-hospital blood request in dedicated bloodrequests collection
 * @route POST /api/blood-requests
 * @access Public or Private (Citizens, Patients, Doctors)
 */
const createBloodRequest = async (req, res, next) => {
  try {
    const {
      // Patient details (nested or flat)
      patient: patientInput,
      patientName,
      patientAge,
      patientGender,
      patientSex,
      patientId,
      contactPhone,
      currentHospital,
      admittedHospital,
      attendingDoctor,

      // Requester details (nested or flat)
      requester: requesterInput,
      requesterName,
      requesterContact,
      requesterRole,
      relationshipToPatient,

      // Requirement (nested or flat)
      bloodRequirement: bloodReqInput,
      bloodGroup,
      bloodComponent,
      quantity,
      urgency,
      requiredAt,

      // Context & links
      reason,
      notes,
      targetHospitals = [],
      requestingHospitalId,
      sourceHospitalId,
      emergencyIntakeId,
      referralId,
    } = req.body;

    if (!targetHospitals || !targetHospitals.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one target hospital / blood bank must be selected.',
      });
    }

    // 1. Resolve Patient Details (may be a friend, family member, or patient)
    const resolvedPatient = {
      name: (patientInput?.name || patientName || '').trim(),
      patientId: (patientInput?.patientId || patientId || '').trim() || undefined,
      age: parseInt(patientInput?.age || patientAge, 10) || undefined,
      gender: patientInput?.gender || patientGender || patientSex || 'Other',
      currentHospital: (patientInput?.currentHospital || currentHospital || admittedHospital || '').trim() || undefined,
      currentHospitalId: patientInput?.currentHospitalId || requestingHospitalId || undefined,
      attendingDoctor: (patientInput?.attendingDoctor || attendingDoctor || '').trim() || undefined,
      contactPhone: (patientInput?.contactPhone || contactPhone || '').trim(),
      emergencyIntake: patientInput?.emergencyIntake || emergencyIntakeId || undefined,
      referral: patientInput?.referral || referralId || undefined,
    };

    if (!resolvedPatient.name) {
      return res.status(422).json({ success: false, message: 'Patient full name is required.' });
    }

    // 2. Resolve Requester Details (the authenticated user or guest submitter)
    let defaultUserId = req.user ? req.user._id : undefined;
    if (!defaultUserId) {
      const fallbackAdmin = await User.findOne({ role: 'super_admin' }).lean();
      defaultUserId = fallbackAdmin ? fallbackAdmin._id : undefined;
    }

    const resolvedRequester = {
      user: req.user ? req.user._id : defaultUserId,
      name: (requesterInput?.name || requesterName || (req.user ? req.user.name : resolvedPatient.name)).trim(),
      contact: (requesterInput?.contact || requesterContact || (req.user ? (req.user.phone || req.user.email) : resolvedPatient.contactPhone) || '').trim(),
      role: (requesterInput?.role || requesterRole || (req.user ? req.user.role.toUpperCase() : 'USER')),
      relationshipToPatient: requesterInput?.relationshipToPatient || relationshipToPatient || (req.user && req.user.name === resolvedPatient.name ? 'Self' : 'Friend'),
    };

    // Standardize role enum
    if (!['PATIENT', 'USER', 'DOCTOR', 'HOSPITAL_STAFF', 'BLOOD_BANK_STAFF', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'].includes(resolvedRequester.role)) {
      resolvedRequester.role = 'USER';
    }

    // 3. Resolve Blood Requirement
    const resolvedBloodReq = {
      bloodGroup: bloodReqInput?.bloodGroup || bloodGroup,
      component: bloodReqInput?.component || bloodComponent || 'Whole Blood',
      quantity: parseInt(bloodReqInput?.quantity !== undefined ? bloodReqInput.quantity : quantity, 10) || 1,
      urgency: (bloodReqInput?.urgency || urgency || 'EMERGENCY').toUpperCase(),
      requiredAt: bloodReqInput?.requiredAt || requiredAt ? new Date(bloodReqInput?.requiredAt || requiredAt) : new Date(Date.now() + 24 * 3600000),
    };

    if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(resolvedBloodReq.bloodGroup)) {
      return res.status(422).json({ success: false, message: 'Valid blood group is required.' });
    }

    // 4. Build Recipients Array
    const recipients = targetHospitals.map(hId => ({
      hospital: hId,
      status: 'PENDING',
      reservedUnits: 0,
      partialUnitsAvailable: 0,
    }));

    // 5. Generate Unique Request ID (e.g. BR-10025)
    let generatedId = generateRequestId();
    let collisionCheck = await BloodRequest.findOne({ requestId: generatedId });
    while (collisionCheck) {
      generatedId = generateRequestId();
      collisionCheck = await BloodRequest.findOne({ requestId: generatedId });
    }

    const primaryHosp = targetHospitals[0];

    // 6. Create in dedicated bloodrequests collection
    const bloodReq = await BloodRequest.create({
      requestId: generatedId,
      requestType: 'BLOOD',
      patient: resolvedPatient,
      requester: resolvedRequester,
      bloodRequirement: resolvedBloodReq,
      reason: (reason || notes || 'Emergency patient blood requirement').trim(),
      notes: (notes || '').trim(),
      sourceHospital: sourceHospitalId || requestingHospitalId || req.user?.hospital || undefined,
      recipients,
      fulfillingHospital: primaryHosp,
      status: 'PENDING',
    });

    // Populate for response
    const populated = await BloodRequest.findById(bloodReq._id)
      .populate('recipients.hospital', 'name district area phone')
      .populate('fulfillingHospital', 'name district area phone')
      .populate('sourceHospital', 'name district phone')
      .populate('requester.user', 'name email phone role')
      .populate('patient.emergencyIntake')
      .populate('patient.referral')
      .lean();

    // Audit log
    await AuditLog.create({
      user: resolvedRequester.user,
      userName: resolvedRequester.name,
      role: req.user ? req.user.role : 'patient',
      action: 'BLOOD_REQUEST_CREATED',
      resourceType: 'BloodRequest',
      resourceId: bloodReq._id,
      details: {
        requestId: bloodReq.requestId,
        bloodGroup: resolvedBloodReq.bloodGroup,
        component: resolvedBloodReq.component,
        quantity: resolvedBloodReq.quantity,
        urgency: resolvedBloodReq.urgency,
        recipientsCount: targetHospitals.length,
        patientName: resolvedPatient.name,
        requesterName: resolvedRequester.name,
      },
    });

    // Socket.io dispatch
    if (req.io) {
      req.io.emit('bloodRequestCreated', {
        id: bloodReq._id,
        requestId: bloodReq.requestId,
        patientName: resolvedPatient.name,
        bloodGroup: resolvedBloodReq.bloodGroup,
        component: resolvedBloodReq.component,
        quantity: resolvedBloodReq.quantity,
        urgency: resolvedBloodReq.urgency,
        targetHospitals,
      });
    }

    res.status(201).json({
      success: true,
      message: `Blood request ${bloodReq.requestId} dispatched successfully to ${targetHospitals.length} selected blood bank(s).`,
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
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (urgency && urgency !== 'all') {
      filter['bloodRequirement.urgency'] = new RegExp('^' + urgency.trim() + '$', 'i');
    }
    if (bloodGroup && bloodGroup !== 'all') {
      filter['bloodRequirement.bloodGroup'] = bloodGroup;
    }

    // Role filtering & hospital isolation
    if (req.user.role === 'user') {
      filter['requester.user'] = req.user._id;
    } else if (['hospital_admin', 'blood_bank_staff', 'doctor'].includes(req.user.role)) {
      const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
      if (!userHosp) {
        return res.status(200).json({ success: true, data: [] });
      }
      filter.$or = [
        { 'recipients.hospital': userHosp },
        { fulfillingHospital: userHosp },
        { sourceHospital: userHosp },
      ];
    } else if (req.user.role === 'super_admin' && hospitalId) {
      filter.$or = [
        { 'recipients.hospital': hospitalId },
        { fulfillingHospital: hospitalId },
      ];
    }

    // Sort: Emergency urgency first, then newest
    const requests = await BloodRequest.find(filter)
      .populate('recipients.hospital', 'name district area phone')
      .populate('recipients.respondedBy', 'name email role')
      .populate('fulfillingHospital', 'name district area phone')
      .populate('sourceHospital', 'name district phone')
      .populate('requester.user', 'name email phone')
      .populate('patient.emergencyIntake')
      .populate('patient.referral')
      .sort({ 'bloodRequirement.urgency': 1, createdAt: -1 })
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
 * @desc Get blood request details by ID or requestId (BR-XXXXX)
 * @route GET /api/blood-requests/:id
 */
const getBloodRequestById = async (req, res, next) => {
  try {
    const idParam = req.params.id;
    const query = idParam.startsWith('BR-')
      ? { requestId: idParam }
      : { _id: idParam };

    const reqDoc = await BloodRequest.findOne(query)
      .populate('recipients.hospital', 'name district area phone address')
      .populate('recipients.respondedBy', 'name email role')
      .populate('fulfillingHospital', 'name district area phone address')
      .populate('sourceHospital', 'name district phone address')
      .populate('requester.user', 'name email phone')
      .populate('patient.emergencyIntake')
      .populate('patient.referral')
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
 * @desc Get blood requests created by logged in citizen / user
 * @route GET /api/blood-requests/my-requests
 * @access Private
 */
const getMyBloodRequests = async (req, res, next) => {
  try {
    const filter = {
      $or: [
        { 'requester.user': req.user._id },
        { 'patient.contactPhone': req.user.phone },
        { 'requester.contact': req.user.phone },
      ],
    };

    const requests = await BloodRequest.find(filter)
      .populate('recipients.hospital', 'name district area phone')
      .populate('fulfillingHospital', 'name district phone')
      .sort({ createdAt: -1 })
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
 * @desc Accept blood request and atomically reserve units
 * @route POST /api/blood-requests/:id/accept
 * @access Private (authorized hospital staff)
 */
const acceptBloodRequest = async (req, res, next) => {
  try {
    const bloodReq = await BloodRequest.findById(req.params.id);
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    if (!userHosp && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to a hospital.' });
    }

    const targetHospId = userHosp || bloodReq.recipients[0]?.hospital?.toString();

    // Check recipient entry
    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // Atomic inventory reservation
    const reserveResult = await reserveBloodUnits({
      hospitalId: targetHospId,
      bloodGroup: bloodReq.bloodRequirement.bloodGroup,
      component: bloodReq.bloodRequirement.component,
      quantity: bloodReq.bloodRequirement.quantity,
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
    recipient.reservedUnits = bloodReq.bloodRequirement.quantity;

    // Update master status
    bloodReq.status = 'BLOOD_RESERVED';
    bloodReq.fulfillingHospital = targetHospId;
    await bloodReq.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_REQUEST_ACCEPTED',
      resourceType: 'BloodRequest',
      resourceId: bloodReq._id,
      hospital: targetHospId,
      details: {
        requestId: bloodReq.requestId,
        reservedUnits: bloodReq.bloodRequirement.quantity,
      },
    });

    if (req.io) {
      req.io.emit('bloodRequestUpdated', {
        id: bloodReq._id,
        requestId: bloodReq.requestId,
        status: 'BLOOD_RESERVED',
        fulfillingHospitalId: targetHospId,
      });
    }

    res.status(200).json({
      success: true,
      message: `Blood request ${bloodReq.requestId} accepted and ${bloodReq.bloodRequirement.quantity} units reserved successfully.`,
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

    const bloodReq = await BloodRequest.findById(req.params.id);
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    const targetHospId = userHosp || bloodReq.recipients[0]?.hospital?.toString();

    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // Reserve partial quantity
    const reserveResult = await reserveBloodUnits({
      hospitalId: targetHospId,
      bloodGroup: bloodReq.bloodRequirement.bloodGroup,
      component: bloodReq.bloodRequirement.component,
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
    recipient.notes = notes || (`Partial stock available: ${partialQty} of ${bloodReq.bloodRequirement.quantity} units`);

    bloodReq.status = 'PARTIALLY_ACCEPTED';
    bloodReq.fulfillingHospital = targetHospId;
    await bloodReq.save();

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_PARTIALLY_ACCEPTED',
      resourceType: 'BloodRequest',
      resourceId: bloodReq._id,
      hospital: targetHospId,
      details: {
        requestId: bloodReq.requestId,
        partialUnits: partialQty,
      },
    });

    res.status(200).json({
      success: true,
      message: `Partially accepted with ${partialQty} units reserved.`,
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

    const bloodReq = await BloodRequest.findById(req.params.id);
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    const targetHospId = userHosp || bloodReq.recipients[0]?.hospital?.toString();

    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // Release if held
    if (recipient.reservedUnits > 0) {
      await releaseReservedBloodUnits({
        hospitalId: targetHospId,
        bloodGroup: bloodReq.bloodRequirement.bloodGroup,
        component: bloodReq.bloodRequirement.component,
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
      resourceType: 'BloodRequest',
      resourceId: bloodReq._id,
      hospital: targetHospId,
      details: {
        requestId: bloodReq.requestId,
        reason: reason.trim(),
      },
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
    const bloodReq = await BloodRequest.findById(req.params.id);
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    // Release any reserved units from all accepting recipients
    for (const r of bloodReq.recipients) {
      if (r.reservedUnits > 0) {
        await releaseReservedBloodUnits({
          hospitalId: r.hospital,
          bloodGroup: bloodReq.bloodRequirement.bloodGroup,
          component: bloodReq.bloodRequirement.component,
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

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_REQUEST_CANCELLED',
      resourceType: 'BloodRequest',
      resourceId: bloodReq._id,
      details: { requestId: bloodReq.requestId },
    });

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
    const bloodReq = await BloodRequest.findById(req.params.id);
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    const userHosp = req.user.hospital?._id ? req.user.hospital._id.toString() : (req.user.hospital?.toString() || req.user.hospitalId);
    const targetHospId = userHosp || bloodReq.fulfillingHospital?.toString();

    let recipient = bloodReq.recipients.find(r => r.hospital.toString() === targetHospId);
    if (recipient && recipient.reservedUnits > 0) {
      await completeReservedBloodUnits({
        hospitalId: targetHospId,
        bloodGroup: bloodReq.bloodRequirement.bloodGroup,
        component: bloodReq.bloodRequirement.component,
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

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_COMPLETED',
      resourceType: 'BloodRequest',
      resourceId: bloodReq._id,
      hospital: targetHospId,
      details: { requestId: bloodReq.requestId },
    });

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
  getMyBloodRequests,
  acceptBloodRequest,
  partiallyAcceptBloodRequest,
  rejectBloodRequest,
  cancelBloodRequest,
  completeBloodRequest,
};
