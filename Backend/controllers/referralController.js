const Referral = require('../models/Referral');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const BedRequest = require('../models/BedRequest');
const EmergencyIntake = require('../models/EmergencyIntake');
const { performReadinessCheck } = require('../services/readinessCheckService');
const { escapeRegex } = require('../utils/regexUtils');

const extractPayload = (body) => {
  const patientName = body.patientName || body.patientInfo?.name || '';
  const patientAge = body.patientAge !== undefined ? Number(body.patientAge) : (body.patientInfo?.age !== undefined ? Number(body.patientInfo.age) : undefined);
  const patientSex = body.patientSex || body.patientInfo?.gender || body.patientInfo?.sex || '';
  const contactPhone = body.contactPhone || body.patientInfo?.contactPhone || '';
  const bloodGroup = body.bloodGroup || body.patientInfo?.bloodGroup || '';
  const emergencyType = body.emergencyType || body.clinicalHandoff?.emergencyType || 'General Emergency';
  const currentProblem = body.currentProblem || body.clinicalHandoff?.presentingProblem || '';
  const symptoms = body.symptoms || (Array.isArray(body.clinicalHandoff?.symptoms) ? body.clinicalHandoff.symptoms.join(', ') : body.clinicalHandoff?.symptoms) || '';
  const diagnosis = body.diagnosis || body.clinicalHandoff?.workingDiagnosis || '';
  const treatmentGiven = body.treatmentGiven || body.clinicalHandoff?.treatmentGiven || '';
  const medicationsGiven = body.medicationsGiven || body.clinicalHandoff?.currentMedications || '';
  const proceduresPerformed = body.proceduresPerformed || body.clinicalHandoff?.proceduresDone || '';
  const currentCondition = body.currentCondition || body.clinicalHandoff?.condition || 'Serious';
  const referralReason = body.referralReason || body.clinicalHandoff?.referralReason || '';
  const specialRequirements = body.specialRequirements || body.clinicalHandoff?.specialRequirements || [];
  const additionalNotes = body.additionalNotes || '';
  const vitalsObservations = body.vitalsObservations || (body.clinicalHandoff?.vitals ? (typeof body.clinicalHandoff.vitals === 'object' ? Object.entries(body.clinicalHandoff.vitals).map(([k, v]) => `${k}: ${v}`).join(', ') : String(body.clinicalHandoff.vitals)) : '');
  const destinationHospitalId = body.destinationHospitalId || body.destinationHospital;
  const receivingDoctorId = body.receivingDoctorId || body.receivingDoctor;

  return {
    patientName,
    patientAge,
    patientSex,
    contactPhone,
    bloodGroup,
    emergencyType,
    currentProblem,
    symptoms,
    diagnosis,
    treatmentGiven,
    medicationsGiven,
    proceduresPerformed,
    currentCondition,
    referralReason,
    specialRequirements,
    additionalNotes,
    vitalsObservations,
    destinationHospitalId,
    receivingDoctorId,
    patientInfo: body.patientInfo || { name: patientName, age: patientAge, gender: patientSex, contactPhone, bloodGroup },
    clinicalHandoff: body.clinicalHandoff || {
      presentingProblem: currentProblem,
      symptoms: symptoms.split(',').map(s => s.trim()).filter(Boolean),
      workingDiagnosis: diagnosis,
      treatmentGiven,
      currentMedications: medicationsGiven,
      proceduresDone: proceduresPerformed,
      condition: currentCondition,
      vitals: vitalsObservations,
      referralReason,
      specialRequirements,
    },
  };
};

const checkReadiness = async (req, res, next) => {
  try {
    const userHospId = req.user.hospital
      ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString())
      : null;

    const data = extractPayload(req.body);

    const checkResult = await performReadinessCheck({
      patientData: {
        patientName: data.patientName,
        patientAge: data.patientAge,
        patientSex: data.patientSex,
        currentProblem: data.currentProblem,
        symptoms: data.symptoms,
        diagnosis: data.diagnosis,
        treatmentGiven: data.treatmentGiven,
        currentCondition: data.currentCondition,
        emergencyType: data.emergencyType,
        referralReason: data.referralReason,
        vitalsObservations: data.vitalsObservations,
      },
      referringHospitalId: userHospId,
      destinationHospitalId: data.destinationHospitalId,
      receivingDoctorId: data.receivingDoctorId,
      specialRequirements: data.specialRequirements,
    });

    res.status(200).json({
      success: true,
      data: checkResult,
    });
  } catch (error) {
    next(error);
  }
};

const createReferral = async (req, res, next) => {
  try {
    const userHospId = req.user.hospital
      ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString())
      : null;

    if (!userHospId && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: User is not associated with an authorized hospital.',
      });
    }

    const referringHospitalId = userHospId || req.body.referringHospitalId;
    const data = extractPayload(req.body);
    const { bedRequestId, emergencyIntakeId, patientId } = req.body;

    // Check duplicate active referral (defense-in-depth; DB unique index is authoritative)
    const activeStatuses = ['pending', 'accepted', 'more_information_requested', 'more_info_requested', 'transferred', 'received'];
    const duplicateQuery = {
      status: { $in: activeStatuses },
      $or: [],
    };
    if (data.patientName) {
      // SEC3-CONCUR-01F: Scope patientName check to same hospital pair
      // Same patient can legitimately be referred to different hospitals
      duplicateQuery.$or.push({
        patientName: new RegExp(`^${escapeRegex(data.patientName.trim())}$`, 'i'),
        referringHospital: referringHospitalId,
        receivingHospital: data.destinationHospitalId,
      });
    }
    if (bedRequestId) duplicateQuery.$or.push({ bedRequest: bedRequestId });
    if (emergencyIntakeId) duplicateQuery.$or.push({ emergencyIntake: emergencyIntakeId });

    if (duplicateQuery.$or.length > 0) {
      const existingActive = await Referral.findOne(duplicateQuery);
      if (existingActive) {
        return res.status(409).json({
          success: false,
          message: 'An active referral already exists for this patient or bed request.',
          data: { existingReferralId: existingActive._id },
        });
      }
    }

    // Run backend readiness check
    const readiness = await performReadinessCheck({
      patientData: {
        patientName: data.patientName,
        patientAge: data.patientAge,
        patientSex: data.patientSex,
        currentProblem: data.currentProblem,
        symptoms: data.symptoms,
        diagnosis: data.diagnosis,
        treatmentGiven: data.treatmentGiven,
        currentCondition: data.currentCondition,
        emergencyType: data.emergencyType,
        referralReason: data.referralReason,
        vitalsObservations: data.vitalsObservations,
      },
      referringHospitalId,
      destinationHospitalId: data.destinationHospitalId,
      receivingDoctorId: data.receivingDoctorId,
      specialRequirements: data.specialRequirements,
    });

    if (!readiness.isReady) {
      return res.status(400).json({
        success: false,
        message: 'Referral cannot be submitted due to readiness check hard blocks.',
        errors: readiness.blocks,
      });
    }

    const [refHosp, destHosp] = await Promise.all([
      Hospital.findById(referringHospitalId).select('name').lean(),
      Hospital.findById(data.destinationHospitalId).select('name').lean(),
    ]);

    const initialHistory = [
      {
        user: req.user._id,
        userName: req.user.name,
        hospital: referringHospitalId,
        hospitalName: refHosp ? refHosp.name : '',
        action: 'created',
        actionUpper: 'REFERRAL_CREATED',
        fromStatus: '',
        toStatus: 'pending',
        notes: `Referral created and dispatched to ${destHosp ? destHosp.name : 'Destination Hospital'}.`,
        timestamp: new Date(),
      },
    ];

    const referral = await Referral.create({
      patientId: patientId || null,
      bedRequest: bedRequestId || null,
      emergencyIntake: emergencyIntakeId || null,
      referringHospital: referringHospitalId,
      referringUser: req.user._id,
      receivingHospital: data.destinationHospitalId,
      receivingDoctor: data.receivingDoctorId,
      patientName: data.patientName,
      patientAge: data.patientAge,
      patientSex: data.patientSex,
      emergencyType: data.emergencyType,
      contactPhone: data.contactPhone,
      bloodGroup: data.bloodGroup,
      patientInfo: data.patientInfo,
      currentProblem: data.currentProblem,
      symptoms: data.symptoms,
      diagnosis: data.diagnosis,
      treatmentGiven: data.treatmentGiven,
      medicationsGiven: data.medicationsGiven,
      proceduresPerformed: data.proceduresPerformed,
      currentCondition: data.currentCondition,
      vitalsObservations: data.vitalsObservations,
      referralReason: data.referralReason,
      specialRequirements: data.specialRequirements,
      additionalNotes: data.additionalNotes,
      clinicalHandoff: data.clinicalHandoff,
      readinessCheck: readiness,
      status: 'pending',
      history: initialHistory,
      auditTrail: initialHistory,
    });

    const populated = await Referral.findById(referral._id)
      .populate('referringHospital', 'name district area phone')
      .populate('receivingHospital', 'name district area phone')
      .populate('referringUser', 'name email phone')
      .populate('receivingDoctor', 'name email phone department specialization')
      .lean();

    if (req.io) {
      req.io.emit('referral:created', { referralId: referral._id, receivingHospital: data.destinationHospitalId });
    }

    res.status(201).json({
      success: true,
      message: 'Emergency patient referral created and dispatched successfully.',
      data: populated,
    });
  } catch (error) {
    // SEC3-CONCUR-01F: Handle database-level duplicate key constraint
    if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) {
      return res.status(409).json({
        success: false,
        message: 'An active referral already exists for this patient, bed request, or emergency intake. Duplicate creation prevented.',
      });
    }
    next(error);
  }
};

const getReferrals = async (req, res, next) => {
  try {
    const type = req.referralType || req.query.type || ((req.path && req.path.includes('outgoing')) ? 'outgoing' : 'incoming');
    const { status } = req.query;
    const userHospId = req.user.hospital
      ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString())
      : null;

    let filter = {};

    if (req.user.role === 'super_admin') {
      if (status) filter.status = status;
      if (req.query.hospital) {
        filter.$or = [{ referringHospital: req.query.hospital }, { receivingHospital: req.query.hospital }];
      }
    } else {
      if (!userHospId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: User is not linked to an active hospital.',
        });
      }

      if (type === 'outgoing') {
        filter.$or = [{ referringHospital: userHospId }, { referringUser: req.user._id }];
      } else {
        filter.$or = [{ receivingHospital: userHospId }, { receivingDoctor: req.user._id }];
      }

      if (status) filter.status = status;
    }

    const referrals = await Referral.find(filter)
      .populate('referringHospital', 'name district area phone')
      .populate('receivingHospital', 'name district area phone')
      .populate('referringUser', 'name email phone')
      .populate('receivingDoctor', 'name email phone department specialization')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: referrals.length,
      data: referrals,
    });
  } catch (error) {
    next(error);
  }
};

const getReferralById = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('referringHospital', 'name district area phone')
      .populate('receivingHospital', 'name district area phone')
      .populate('referringUser', 'name email phone')
      .populate('receivingDoctor', 'name email phone department specialization');

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found.' });
    }

    const userHospId = req.user.hospital
      ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString())
      : null;

    const refHospId = referral.referringHospital._id.toString();
    const destHospId = referral.receivingHospital._id.toString();

    if (
      req.user.role !== 'super_admin' &&
      userHospId !== refHospId &&
      userHospId !== destHospId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not have permission to view this referral.',
      });
    }

    res.status(200).json({
      success: true,
      data: referral,
    });
  } catch (error) {
    next(error);
  }
};

const getDestinationHospitals = async (req, res, next) => {
  try {
    const userHospId = req.user.hospital
      ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString())
      : null;

    const query = { isActive: true };
    if (userHospId) {
      query._id = { $ne: userHospId };
    }

    const hospitals = await Hospital.find(query)
      .select('name district area phone address latitude longitude')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: hospitals.length,
      data: hospitals,
    });
  } catch (error) {
    next(error);
  }
};

const getDestinationDoctors = async (req, res, next) => {
  try {
    const hospitalId = req.params.hospitalId || req.query.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'hospitalId parameter is required.',
      });
    }

    const doctors = await User.find({
      hospital: hospitalId,
      role: { $in: ['doctor', 'hospital_admin'] },
      isActive: true,
    })
      .select('name email role department specialization')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
};

const buildAuditEntry = (referral, req, action, actionUpper, fromStatus, toStatus, notes) => ({
  user: req.user._id,
  userName: req.user.name,
  hospital: req.user.hospital ? (req.user.hospital._id || req.user.hospital) : referral.receivingHospital,
  action,
  actionUpper,
  fromStatus,
  toStatus,
  notes,
  timestamp: new Date(),
});

const appendAudit = (referral, req, action, actionUpper, fromStatus, toStatus, notes) => {
  const entry = buildAuditEntry(referral, req, action, actionUpper, fromStatus, toStatus, notes);
  referral.history.push(entry);
  referral.auditTrail.push(entry);
};

const acceptReferral = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.receivingHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only receiving hospital can accept.' });
    }

    const allowedPrevious = ['pending', 'more_information_requested', 'more_info_requested'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot accept referral with status '${referral.status}'. Expected 'pending' or 'more_info_requested'.`,
      });
    }

    const note = req.body.note || req.body.notes || 'Referral accepted.';
    const now = new Date();
    const auditEntry = buildAuditEntry(referral, req, 'accepted', 'REFERRAL_ACCEPTED', referral.status, 'accepted', note);

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: {
          status: 'accepted',
          acceptedAt: now,
        },
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot accept referral: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'accepted' });
    res.status(200).json({ success: true, message: 'Referral accepted.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

const rejectReferral = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.receivingHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only receiving hospital can reject.' });
    }

    const reason = req.body.rejectionReason || req.body.reason;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A specific reason for rejection is mandatory.' });
    }

    const allowedPrevious = ['pending', 'more_information_requested', 'more_info_requested'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot reject referral with status '${referral.status}'. Expected 'pending' or 'more_info_requested'.`,
      });
    }

    const now = new Date();
    const auditEntry = buildAuditEntry(referral, req, 'rejected', 'REFERRAL_REJECTED', referral.status, 'rejected', reason.trim());

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: {
          status: 'rejected',
          rejectedAt: now,
          rejectionReason: reason.trim(),
          rejectedBy: req.user._id,
        },
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot reject referral: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'rejected' });
    res.status(200).json({ success: true, message: 'Referral rejected.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

const requestMoreInfo = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.receivingHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only receiving hospital can request more info.' });
    }

    const note = req.body.informationRequest || req.body.message || req.body.note;
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Description of information required is mandatory.' });
    }

    const allowedPrevious = ['pending'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot request more information for referral with status '${referral.status}'. Expected 'pending'.`,
      });
    }

    const now = new Date();
    const auditEntry = buildAuditEntry(referral, req, 'more_info_requested', 'MORE_INFO_REQUESTED', referral.status, 'more_info_requested', note.trim());

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: {
          status: 'more_info_requested',
          informationRequest: note.trim(),
          moreInfoRequestedNote: note.trim(),
          informationRequestedAt: now,
          informationRequestedBy: req.user._id,
        },
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot request more information: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'more_info_requested' });
    res.status(200).json({ success: true, message: 'More information requested.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

const updateReferral = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.referringHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only referring hospital can update.' });
    }

    const allowedPrevious = ['more_info_requested', 'more_information_requested', 'pending'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot update referral with status '${referral.status}'. Expected 'more_info_requested' or 'pending'.`,
      });
    }

    const setFields = {
      status: 'pending',
    };

    if (req.body.clinicalHandoff) {
      for (const [k, v] of Object.entries(req.body.clinicalHandoff)) {
        setFields[`clinicalHandoff.${k}`] = v;
      }
      if (req.body.clinicalHandoff.proceduresDone) {
        setFields.proceduresPerformed = req.body.clinicalHandoff.proceduresDone;
      }
      if (req.body.clinicalHandoff.treatmentGiven) {
        setFields.treatmentGiven = req.body.clinicalHandoff.treatmentGiven;
      }
    }
    if (req.body.proceduresPerformed) setFields.proceduresPerformed = req.body.proceduresPerformed;
    if (req.body.treatmentGiven) setFields.treatmentGiven = req.body.treatmentGiven;

    const auditEntry = buildAuditEntry(referral, req, 'updated', 'CLINICAL_INFO_UPDATED', referral.status, 'pending', req.body.updateNotes || 'Clinical handoff updated.');

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: setFields,
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot update referral: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'pending' });
    res.status(200).json({ success: true, message: 'Referral updated and returned to pending review.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

const markTransferred = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.referringHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only referring hospital can mark transferred.' });
    }

    const allowedPrevious = ['accepted'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot mark referral as transferred with status '${referral.status}'. Expected 'accepted'.`,
      });
    }

    const now = new Date();
    const auditEntry = buildAuditEntry(referral, req, 'transferred', 'PATIENT_TRANSFERRED', referral.status, 'transferred', req.body.note || 'Patient transferred.');

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: {
          status: 'transferred',
          transferredAt: now,
        },
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot mark referral as transferred: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'transferred' });
    res.status(200).json({ success: true, message: 'Patient marked as transferred.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

const markReceived = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.receivingHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only receiving hospital can mark received.' });
    }

    const allowedPrevious = ['transferred'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot mark referral as received with status '${referral.status}'. Expected 'transferred'.`,
      });
    }

    const now = new Date();
    const auditEntry = buildAuditEntry(referral, req, 'received', 'PATIENT_RECEIVED', referral.status, 'received', req.body.note || 'Patient received.');

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: {
          status: 'received',
          receivedAt: now,
        },
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot mark referral as received: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'received' });
    res.status(200).json({ success: true, message: 'Patient marked as received.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

const completeReferral = async (req, res, next) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const userHospId = req.user.hospital ? (req.user.hospital._id ? req.user.hospital._id.toString() : req.user.hospital.toString()) : null;
    if (req.user.role !== 'super_admin' && userHospId !== referral.receivingHospital.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only receiving hospital can complete.' });
    }

    const allowedPrevious = ['received'];
    if (!allowedPrevious.includes(referral.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot complete referral with status '${referral.status}'. Expected 'received'.`,
      });
    }

    const now = new Date();
    const auditEntry = buildAuditEntry(referral, req, 'completed', 'REFERRAL_COMPLETED', referral.status, 'completed', req.body.note || 'Referral completed.');

    const updatedReferral = await Referral.findOneAndUpdate(
      {
        _id: req.params.id,
        status: { $in: allowedPrevious },
      },
      {
        $set: {
          status: 'completed',
          completedAt: now,
        },
        $push: {
          history: auditEntry,
          auditTrail: auditEntry,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedReferral) {
      const current = await Referral.findById(req.params.id).lean();
      return res.status(409).json({
        success: false,
        message: `Cannot complete referral: state transition conflict. Current status is '${current ? current.status : 'unknown'}'.`,
      });
    }

    if (req.io) req.io.emit('referral:status_change', { referralId: updatedReferral._id, status: 'completed' });
    res.status(200).json({ success: true, message: 'Referral marked as completed.', data: updatedReferral });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkReadiness,
  createReferral,
  getReferrals,
  getReferralById,
  getDestinationHospitals,
  getDestinationDoctors,
  acceptReferral,
  rejectReferral,
  requestMoreInfo,
  updateReferral,
  markTransferred,
  markReceived,
  completeReferral,
};
