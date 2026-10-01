const mongoose = require('mongoose');
const BloodRequest = require('../models/BloodRequest');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const {
  reserveBloodUnits,
  releaseReservedBloodUnits,
  completeReservedBloodUnits,
} = require('../services/bloodInventoryService');
const { escapeRegex } = require('../utils/regexUtils');

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

    // 2. Resolve Requester Details (The person who actually submitted the request)
    // CRITICAL: When the request is made by an authenticated user (req.user is set via JWT token),
    // we MUST determine the requester on the backend directly from req.user to ensure identity integrity.
    let resolvedUserId = req.user ? req.user._id : undefined;
    if (!resolvedUserId) {
      const fallbackAdmin = await User.findOne({ role: 'super_admin' }).lean();
      resolvedUserId = fallbackAdmin ? fallbackAdmin._id : undefined;
    }

    const isSelf = (requesterInput?.relationshipToPatient || relationshipToPatient) === 'Self';

    const resolvedRequester = {
      user: req.user ? req.user._id : resolvedUserId,
      userId: req.user ? req.user._id : resolvedUserId,
      name: req.user
        ? req.user.name
        : (requesterInput?.name || requesterName || (isSelf ? resolvedPatient.name : 'Citizen Requester')).trim(),
      contact: req.user
        ? (req.user.phone || req.user.email || requesterInput?.contact || '')
        : (requesterInput?.contact || requesterContact || (isSelf ? resolvedPatient.contactPhone : '')).trim(),
      role: req.user
        ? (req.user.role ? req.user.role.toUpperCase() : 'USER')
        : (requesterInput?.role || requesterRole || 'USER').toUpperCase(),
      relationshipToPatient: requesterInput?.relationshipToPatient || relationshipToPatient || (isSelf || (req.user && req.user.name === resolvedPatient.name) ? 'Self' : 'Friend'),
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
      .populate('requester.userId', 'name email phone role')
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
      filter['bloodRequirement.urgency'] = new RegExp('^' + escapeRegex(urgency.trim()) + '$', 'i');
    }
    if (bloodGroup && bloodGroup !== 'all') {
      filter['bloodRequirement.bloodGroup'] = bloodGroup;
    }

    // Role filtering & hospital isolation
    if (req.user.role === 'user') {
      filter.$or = [
        { 'requester.user': req.user._id },
        { 'requester.userId': req.user._id },
      ];
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
      .populate('requester.userId', 'name email phone')
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
 * Helper to extract an ID string from an ObjectId, string, or populated document
 */
const toIdString = (val) => {
  if (!val) return null;
  if (typeof val === 'object' && val._id) return val._id.toString();
  return val.toString();
};

/**
 * Checks whether an authenticated user is authorized to view a specific blood request.
 * Authorized if:
 * 1. User is super_admin
 * 2. User is the original requester (requester.user or requester.userId matches req.user._id)
 * 3. User belongs to a hospital legitimately associated with the request
 *    (recipients[].hospital, fulfillingHospital, sourceHospital, or patient.currentHospitalId)
 */
const isUserAuthorizedForBloodRequest = (user, bloodReq) => {
  if (!user || !bloodReq) return false;

  // 1. Super Admin has unrestricted system-wide access
  if (user.role === 'super_admin') return true;

  const currentUserId = user._id ? user._id.toString() : user.id?.toString();

  // 2. Check if user is the original requester
  const requesterUserId = toIdString(bloodReq.requester?.user) || toIdString(bloodReq.requester?.userId);
  if (currentUserId && requesterUserId && requesterUserId === currentUserId) {
    return true;
  }

  // 3. Hospital-affiliated roles: check association with the blood request
  const isHospitalRole = ['hospital_admin', 'blood_bank_staff', 'doctor', 'staff'].includes(user.role);
  if (!isHospitalRole) {
    return false;
  }

  const userHospId = user.hospital?._id
    ? user.hospital._id.toString()
    : (user.hospital ? user.hospital.toString() : (user.hospitalId ? user.hospitalId.toString() : null));

  if (!userHospId) {
    return false;
  }

  // Associated hospital check: fulfillingHospital, sourceHospital, patient.currentHospitalId
  if (toIdString(bloodReq.fulfillingHospital) === userHospId) return true;
  if (toIdString(bloodReq.sourceHospital) === userHospId) return true;
  if (toIdString(bloodReq.patient?.currentHospitalId) === userHospId) return true;

  // Associated hospital check: target recipients array
  if (Array.isArray(bloodReq.recipients)) {
    const isTargetRecipient = bloodReq.recipients.some(
      (r) => toIdString(r.hospital) === userHospId
    );
    if (isTargetRecipient) return true;
  }

  return false;
};

/**
 * @desc Get blood request details by ID or requestId (BR-XXXXX)
 * @route GET /api/blood-requests/:id
 * @access Private
 */
const getBloodRequestById = async (req, res, next) => {
  try {
    const idParam = (req.params.id || '').trim();
    const query = idParam.toUpperCase().startsWith('BR-')
      ? { requestId: idParam.toUpperCase() }
      : { _id: idParam };

    const reqDoc = await BloodRequest.findOne(query)
      .populate('recipients.hospital', 'name district area phone address')
      .populate('recipients.respondedBy', 'name email role')
      .populate('fulfillingHospital', 'name district area phone address')
      .populate('sourceHospital', 'name district phone address')
      .populate('requester.user', 'name email phone')
      .populate('requester.userId', 'name email phone')
      .populate('patient.emergencyIntake')
      .populate('patient.referral')
      .lean();

    if (!reqDoc) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    // SEC3-IDOR-01: Object-level authorization check
    if (!isUserAuthorizedForBloodRequest(req.user, reqDoc)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not authorized to view this blood request.',
        errors: [],
      });
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
    const orConditions = [
      { 'requester.user': req.user._id },
      { 'requester.userId': req.user._id },
    ];
    if (req.user.phone && String(req.user.phone).trim()) {
      const p = String(req.user.phone).trim();
      orConditions.push({ 'patient.contactPhone': p });
      orConditions.push({ 'requester.contact': p });
    }
    if (req.user.email && String(req.user.email).trim()) {
      orConditions.push({ 'requester.contact': String(req.user.email).trim() });
    }
    if (req.user.name && String(req.user.name).trim()) {
      orConditions.push({ 'requester.name': new RegExp('^' + escapeRegex(String(req.user.name).trim()) + '$', 'i') });
    }

    const requests = await BloodRequest.find({ $or: orConditions })
      .populate('recipients.hospital', 'name district area phone')
      .populate('fulfillingHospital', 'name district phone')
      .populate('requester.user', 'name email phone')
      .populate('requester.userId', 'name email phone')
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

    // 1. Hospital Ownership & Authorization (Step 5 & 16)
    const userHosp = req.user.hospital?._id
      ? req.user.hospital._id.toString()
      : (req.user.hospital?.toString() || req.user.hospitalId?.toString());

    if (!userHosp && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to a hospital.' });
    }

    const targetHospId = userHosp || bloodReq.recipients[0]?.hospital?.toString();
    if (!targetHospId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: No hospital context found.' });
    }

    const targetHospObjId = new mongoose.Types.ObjectId(targetHospId);

    // Verify authorized recipient
    const isRecipient = bloodReq.recipients && bloodReq.recipients.some(
      r => r.hospital && r.hospital.toString() === targetHospId
    );
    if (!isRecipient && req.user.role !== 'super_admin' && bloodReq.sourceHospital?.toString() !== targetHospId && bloodReq.fulfillingHospital?.toString() !== targetHospId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Hospital is not an authorized recipient for this blood request.',
      });
    }

    // 2. Invalid Request State Checks (Step 17)
    if (['BLOOD_RESERVED', 'ACCEPTED', 'READY_FOR_COLLECTION', 'COMPLETED'].includes(bloodReq.status)) {
      return res.status(409).json({
        success: false,
        message: `Conflict: Blood request has already been claimed or accepted (current status: ${bloodReq.status}).`,
      });
    }

    if (['CANCELLED', 'EXPIRED', 'REJECTED'].includes(bloodReq.status)) {
      return res.status(409).json({
        success: false,
        message: `Conflict: Cannot accept blood request in '${bloodReq.status}' status.`,
      });
    }

    if (bloodReq.status === 'PARTIALLY_ACCEPTED') {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Blood request has already been partially accepted. Please use the partial-accept endpoint.',
      });
    }

    const requestedQty = bloodReq.bloodRequirement?.quantity || 1;

    // 3. Atomic Single-Claim Database Operation (Step 4 & 6)
    // Only transitions if status is PENDING/SENT/VIEWED and no units have been claimed yet
    let claimedReq;
    if (isRecipient) {
      claimedReq = await BloodRequest.findOneAndUpdate(
        {
          _id: bloodReq._id,
          status: { $in: ['PENDING', 'SENT', 'VIEWED'] },
          $or: [
            { totalReservedUnits: { $exists: false } },
            { totalReservedUnits: 0 },
          ],
        },
        {
          $set: {
            status: 'BLOOD_RESERVED',
            fulfillingHospital: targetHospObjId,
            totalReservedUnits: requestedQty,
            'recipients.$[elem].status': 'ACCEPTED',
            'recipients.$[elem].respondedBy': req.user._id,
            'recipients.$[elem].respondedAt': new Date(),
            'recipients.$[elem].reservedUnits': requestedQty,
          },
        },
        {
          arrayFilters: [{ 'elem.hospital': targetHospObjId }],
          returnDocument: 'after',
        }
      );
    } else {
      // Super admin or newly associated facility
      claimedReq = await BloodRequest.findOneAndUpdate(
        {
          _id: bloodReq._id,
          status: { $in: ['PENDING', 'SENT', 'VIEWED'] },
          $or: [
            { totalReservedUnits: { $exists: false } },
            { totalReservedUnits: 0 },
          ],
        },
        {
          $set: {
            status: 'BLOOD_RESERVED',
            fulfillingHospital: targetHospObjId,
            totalReservedUnits: requestedQty,
          },
          $push: {
            recipients: {
              hospital: targetHospObjId,
              status: 'ACCEPTED',
              respondedBy: req.user._id,
              respondedAt: new Date(),
              reservedUnits: requestedQty,
            },
          },
        },
        {
          returnDocument: 'after',
        }
      );
    }

    // 4. Losing Hospital Handling (Step 7)
    if (!claimedReq) {
      const refreshed = await BloodRequest.findById(req.params.id);
      return res.status(409).json({
        success: false,
        message: `Conflict: Blood request has already been claimed or accepted by another hospital (current status: ${refreshed?.status || 'UNAVAILABLE'}).`,
      });
    }

    // 5. Atomic Inventory Reservation (Step 8 - SEC3-CONCUR-01B protected)
    const reserveResult = await reserveBloodUnits({
      hospitalId: targetHospId,
      bloodGroup: bloodReq.bloodRequirement.bloodGroup,
      component: bloodReq.bloodRequirement.component,
      quantity: requestedQty,
      userId: req.user._id,
      userName: req.user.name,
      requestId: bloodReq._id,
      role: req.user.role,
    });

    if (!reserveResult.success) {
      // Rollback the claim on inventory reservation failure (Step 18)
      if (isRecipient) {
        await BloodRequest.updateOne(
          { _id: bloodReq._id, fulfillingHospital: targetHospObjId, status: 'BLOOD_RESERVED' },
          {
            $set: {
              status: 'PENDING',
              totalReservedUnits: 0,
              'recipients.$[elem].status': 'PENDING',
              'recipients.$[elem].reservedUnits': 0,
              'recipients.$[elem].respondedBy': null,
              'recipients.$[elem].respondedAt': null,
            },
          },
          {
            arrayFilters: [{ 'elem.hospital': targetHospObjId }],
          }
        );
      } else {
        await BloodRequest.updateOne(
          { _id: bloodReq._id, fulfillingHospital: targetHospObjId, status: 'BLOOD_RESERVED' },
          {
            $set: {
              status: 'PENDING',
              totalReservedUnits: 0,
            },
            $pull: {
              recipients: { hospital: targetHospObjId },
            },
          }
        );
      }

      return res.status(400).json({
        success: false,
        message: reserveResult.message,
        availableUnits: reserveResult.availableUnits,
      });
    }

    // 6. Success Side Effects ONLY on successful atomic claim & reservation (Step 13)
    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_REQUEST_ACCEPTED',
      resourceType: 'BloodRequest',
      resourceId: claimedReq._id,
      hospital: targetHospId,
      details: {
        requestId: claimedReq.requestId,
        reservedUnits: requestedQty,
      },
    });

    if (req.io) {
      req.io.emit('bloodRequestUpdated', {
        id: claimedReq._id,
        requestId: claimedReq.requestId,
        status: 'BLOOD_RESERVED',
        fulfillingHospitalId: targetHospId,
      });
    }

    res.status(200).json({
      success: true,
      message: `Blood request ${claimedReq.requestId} accepted and ${requestedQty} units reserved successfully.`,
      data: claimedReq,
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

    // 1. Hospital Ownership & Authorization (Step 5 & 16)
    const userHosp = req.user.hospital?._id
      ? req.user.hospital._id.toString()
      : (req.user.hospital?.toString() || req.user.hospitalId?.toString());

    if (!userHosp && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to a hospital.' });
    }

    const targetHospId = userHosp || bloodReq.recipients[0]?.hospital?.toString();
    if (!targetHospId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: No hospital context found.' });
    }

    const targetHospObjId = new mongoose.Types.ObjectId(targetHospId);

    const isRecipient = bloodReq.recipients && bloodReq.recipients.some(
      r => r.hospital && r.hospital.toString() === targetHospId
    );
    if (!isRecipient && req.user.role !== 'super_admin' && bloodReq.sourceHospital?.toString() !== targetHospId && bloodReq.fulfillingHospital?.toString() !== targetHospId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Hospital is not an authorized recipient for this blood request.',
      });
    }

    // 2. Invalid Request State Checks (Step 17)
    if (['BLOOD_RESERVED', 'ACCEPTED', 'READY_FOR_COLLECTION', 'COMPLETED'].includes(bloodReq.status)) {
      return res.status(409).json({
        success: false,
        message: `Conflict: Blood request has already been fully claimed or completed (status: ${bloodReq.status}).`,
      });
    }

    if (['CANCELLED', 'EXPIRED', 'REJECTED'].includes(bloodReq.status)) {
      return res.status(409).json({
        success: false,
        message: `Conflict: Cannot partially accept blood request in '${bloodReq.status}' status.`,
      });
    }

    const totalNeeded = bloodReq.bloodRequirement?.quantity || 1;
    const currentReserved = bloodReq.totalReservedUnits || 0;
    const remainingNeeded = totalNeeded - currentReserved;

    if (remainingNeeded <= 0) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Blood request requirement has already been completely fulfilled.',
      });
    }

    if (partialQty > remainingNeeded) {
      return res.status(400).json({
        success: false,
        message: `Requested partial units (${partialQty}) exceeds remaining required units (${remainingNeeded}).`,
      });
    }

    // 3. Atomic Quantity Claim (Step 10 & 11)
    // Enforce invariant: totalReservedUnits + partialQty <= bloodRequirement.quantity
    let claimedReq;
    if (isRecipient) {
      claimedReq = await BloodRequest.findOneAndUpdate(
        {
          _id: bloodReq._id,
          status: { $in: ['PENDING', 'SENT', 'VIEWED', 'PARTIALLY_ACCEPTED'] },
          $expr: {
            $lte: [
              { $add: [{ $ifNull: ['$totalReservedUnits', 0] }, partialQty] },
              '$bloodRequirement.quantity',
            ],
          },
        },
        {
          $inc: { totalReservedUnits: partialQty },
          $set: {
            status: (currentReserved + partialQty >= totalNeeded) ? 'BLOOD_RESERVED' : 'PARTIALLY_ACCEPTED',
            fulfillingHospital: targetHospObjId,
            'recipients.$[elem].status': 'PARTIALLY_ACCEPTED',
            'recipients.$[elem].respondedBy': req.user._id,
            'recipients.$[elem].respondedAt': new Date(),
            'recipients.$[elem].reservedUnits': partialQty,
            'recipients.$[elem].partialUnitsAvailable': partialQty,
            'recipients.$[elem].notes': notes || (`Partial stock available: ${partialQty} of ${totalNeeded} units`),
          },
        },
        {
          arrayFilters: [{ 'elem.hospital': targetHospObjId }],
          returnDocument: 'after',
        }
      );
    } else {
      claimedReq = await BloodRequest.findOneAndUpdate(
        {
          _id: bloodReq._id,
          status: { $in: ['PENDING', 'SENT', 'VIEWED', 'PARTIALLY_ACCEPTED'] },
          $expr: {
            $lte: [
              { $add: [{ $ifNull: ['$totalReservedUnits', 0] }, partialQty] },
              '$bloodRequirement.quantity',
            ],
          },
        },
        {
          $inc: { totalReservedUnits: partialQty },
          $set: {
            status: (currentReserved + partialQty >= totalNeeded) ? 'BLOOD_RESERVED' : 'PARTIALLY_ACCEPTED',
            fulfillingHospital: targetHospObjId,
          },
          $push: {
            recipients: {
              hospital: targetHospObjId,
              status: 'PARTIALLY_ACCEPTED',
              respondedBy: req.user._id,
              respondedAt: new Date(),
              reservedUnits: partialQty,
              partialUnitsAvailable: partialQty,
              notes: notes || (`Partial stock available: ${partialQty} of ${totalNeeded} units`),
            },
          },
        },
        {
          returnDocument: 'after',
        }
      );
    }

    if (!claimedReq) {
      const refreshed = await BloodRequest.findById(req.params.id);
      const remaining = refreshed ? (refreshed.bloodRequirement.quantity - (refreshed.totalReservedUnits || 0)) : 0;
      return res.status(409).json({
        success: false,
        message: `Conflict: Could not claim ${partialQty} units. Only ${remaining} remaining or request already claimed.`,
      });
    }

    // Check if totalReservedUnits has now reached or exceeded the full requested quantity
    const totalRequired = claimedReq.bloodRequirement?.quantity || 1;
    if (claimedReq.totalReservedUnits >= totalRequired && claimedReq.status !== 'BLOOD_RESERVED') {
      claimedReq.status = 'BLOOD_RESERVED';
      await BloodRequest.updateOne({ _id: claimedReq._id }, { $set: { status: 'BLOOD_RESERVED' } });
    }

    // 4. Atomic Inventory Reservation (Step 8 - SEC3-CONCUR-01B protected)
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
      // Rollback the partial reservation claim
      const revertedUnits = Math.max(0, (claimedReq.totalReservedUnits || 0) - partialQty);
      await BloodRequest.updateOne(
        { _id: bloodReq._id },
        {
          $set: {
            totalReservedUnits: revertedUnits,
            status: revertedUnits > 0 ? 'PARTIALLY_ACCEPTED' : 'PENDING',
            'recipients.$[elem].status': 'PENDING',
            'recipients.$[elem].reservedUnits': 0,
            'recipients.$[elem].partialUnitsAvailable': 0,
          },
        },
        {
          arrayFilters: [{ 'elem.hospital': targetHospObjId }],
        }
      );

      return res.status(400).json({
        success: false,
        message: reserveResult.message,
        availableUnits: reserveResult.availableUnits,
      });
    }

    // 5. Success Side Effects ONLY on successful atomic claim & reservation (Step 13)
    await AuditLog.create({
      user: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'BLOOD_PARTIALLY_ACCEPTED',
      resourceType: 'BloodRequest',
      resourceId: claimedReq._id,
      hospital: targetHospId,
      details: {
        requestId: claimedReq.requestId,
        partialUnits: partialQty,
        totalReserved: claimedReq.totalReservedUnits,
      },
    });

    res.status(200).json({
      success: true,
      message: `Partially accepted with ${partialQty} units reserved.`,
      data: claimedReq,
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

    let recipient = bloodReq.recipients.find(r => r.hospital && r.hospital.toString() === targetHospId);
    if (!recipient) {
      recipient = { hospital: targetHospId, status: 'PENDING', reservedUnits: 0 };
      bloodReq.recipients.push(recipient);
    }

    // Release if held
    if (recipient.reservedUnits > 0) {
      const unitsToRelease = recipient.reservedUnits;
      await releaseReservedBloodUnits({
        hospitalId: targetHospId,
        bloodGroup: bloodReq.bloodRequirement.bloodGroup,
        component: bloodReq.bloodRequirement.component,
        quantity: unitsToRelease,
        userId: req.user._id,
        userName: req.user.name,
        requestId: bloodReq._id,
        reason: 'Request rejected: ' + reason.trim(),
      });
      recipient.reservedUnits = 0;
      bloodReq.totalReservedUnits = Math.max(0, (bloodReq.totalReservedUnits || 0) - unitsToRelease);
    }

    recipient.status = 'REJECTED';
    recipient.respondedBy = req.user._id;
    recipient.respondedAt = new Date();
    recipient.responseReason = reason.trim();

    // If all recipients rejected, update master status
    const allRejected = bloodReq.recipients.every(r => r.status === 'REJECTED');
    if (allRejected) {
      bloodReq.status = 'REJECTED';
    } else if ((bloodReq.totalReservedUnits || 0) === 0) {
      bloodReq.status = 'PENDING';
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
    bloodReq.totalReservedUnits = 0;
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
  isUserAuthorizedForBloodRequest,
};
