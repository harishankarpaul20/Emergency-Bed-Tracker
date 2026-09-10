const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const isObjectId = value => mongoose.Types.ObjectId.isValid(value);

const normalizeReferralPayload = (req, res, next) => {
  if (req.body.patientInfo) {
    if (!req.body.patientName && req.body.patientInfo.name) req.body.patientName = req.body.patientInfo.name;
    if (req.body.patientAge === undefined && req.body.patientInfo.age !== undefined) req.body.patientAge = req.body.patientInfo.age;
    if (!req.body.patientSex && (req.body.patientInfo.gender || req.body.patientInfo.sex)) {
      req.body.patientSex = req.body.patientInfo.gender || req.body.patientInfo.sex;
    }
    if (!req.body.contactPhone && req.body.patientInfo.contactPhone) req.body.contactPhone = req.body.patientInfo.contactPhone;
    if (!req.body.bloodGroup && req.body.patientInfo.bloodGroup) req.body.bloodGroup = req.body.patientInfo.bloodGroup;
  }
  if (req.body.clinicalHandoff) {
    if (!req.body.currentProblem && req.body.clinicalHandoff.presentingProblem) req.body.currentProblem = req.body.clinicalHandoff.presentingProblem;
    if (!req.body.symptoms && req.body.clinicalHandoff.symptoms) {
      req.body.symptoms = Array.isArray(req.body.clinicalHandoff.symptoms) ? req.body.clinicalHandoff.symptoms.join(', ') : req.body.clinicalHandoff.symptoms;
    }
    if (!req.body.diagnosis && req.body.clinicalHandoff.workingDiagnosis) req.body.diagnosis = req.body.clinicalHandoff.workingDiagnosis;
    if (!req.body.treatmentGiven && req.body.clinicalHandoff.treatmentGiven) req.body.treatmentGiven = req.body.clinicalHandoff.treatmentGiven;
    if (!req.body.currentCondition && req.body.clinicalHandoff.condition) req.body.currentCondition = req.body.clinicalHandoff.condition;
    if (!req.body.referralReason && req.body.clinicalHandoff.referralReason) req.body.referralReason = req.body.clinicalHandoff.referralReason;
    if (!req.body.medicationsGiven && req.body.clinicalHandoff.currentMedications) req.body.medicationsGiven = req.body.clinicalHandoff.currentMedications;
    if (!req.body.proceduresPerformed && req.body.clinicalHandoff.proceduresDone) req.body.proceduresPerformed = req.body.clinicalHandoff.proceduresDone;
    if (!req.body.vitalsObservations && req.body.clinicalHandoff.vitals) {
      req.body.vitalsObservations = typeof req.body.clinicalHandoff.vitals === 'object'
        ? Object.entries(req.body.clinicalHandoff.vitals).map(([k, v]) => `${k}: ${v}`).join(', ')
        : String(req.body.clinicalHandoff.vitals);
    }
    if (!req.body.specialRequirements && req.body.clinicalHandoff.specialRequirements) {
      req.body.specialRequirements = req.body.clinicalHandoff.specialRequirements;
    }
  }
  if (!req.body.destinationHospitalId && req.body.destinationHospital) req.body.destinationHospitalId = req.body.destinationHospital;
  if (!req.body.receivingDoctorId && req.body.receivingDoctor) req.body.receivingDoctorId = req.body.receivingDoctor;
  if (!req.body.emergencyType) req.body.emergencyType = 'General Emergency';
  if (!req.body.treatmentGiven) req.body.treatmentGiven = 'Initial resuscitation and clinical assessment.';
  if (!req.body.currentCondition) req.body.currentCondition = 'Serious';
  next();
};

const normalizeRejectionPayload = (req, res, next) => {
  if (!req.body.rejectionReason && req.body.reason) req.body.rejectionReason = req.body.reason;
  next();
};

const normalizeMoreInfoPayload = (req, res, next) => {
  if (!req.body.informationRequest && (req.body.message || req.body.note)) req.body.informationRequest = req.body.message || req.body.note;
  next();
};

const createReferralRules = [
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('destinationHospitalId').notEmpty().custom(isObjectId).withMessage('Valid destination hospital ID is required'),
  body('receivingDoctorId').notEmpty().custom(isObjectId).withMessage('Valid receiving doctor ID is required'),
];

const rejectionRules = [
  param('id').custom(isObjectId).withMessage('Invalid referral ID'),
  body('rejectionReason').trim().notEmpty().withMessage('Reason for rejection is mandatory'),
];

const moreInfoRules = [
  param('id').custom(isObjectId).withMessage('Invalid referral ID'),
  body('informationRequest').trim().notEmpty().withMessage('Information required description is mandatory'),
];

const referralIdParamRule = [
  param('id').custom(isObjectId).withMessage('Invalid referral ID'),
];

module.exports = {
  normalizeReferralPayload,
  normalizeRejectionPayload,
  normalizeMoreInfoPayload,
  createReferralRules,
  rejectionRules,
  moreInfoRules,
  referralIdParamRule,
};
