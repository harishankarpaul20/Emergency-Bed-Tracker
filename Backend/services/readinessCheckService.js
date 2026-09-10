const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const User = require('../models/User');

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return null;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

async function performReadinessCheck({
  patientData = {},
  referringHospitalId,
  destinationHospitalId,
  receivingDoctorId,
  specialRequirements = [],
}) {
  const blocks = [];
  const warnings = [];
  const checkDetails = {
    patientInfoComplete: false,
    referringHospitalVerified: false,
    destinationHospitalVerified: false,
    receivingDoctorVerified: false,
    resourceCapacityStatus: 'suitable',
    resourceDetails: {},
    approxDistanceKm: null,
  };

  // 1. Mandatory Patient and Clinical Information Check
  const requiredFields = [
    { key: 'patientName', field: 'patientInfo.name', label: 'Patient Name' },
    { key: 'patientAge', field: 'patientInfo.age', label: 'Patient Age' },
    { key: 'patientSex', field: 'patientInfo.gender', label: 'Patient Gender' },
    { key: 'currentProblem', field: 'clinicalHandoff.presentingProblem', label: 'Presenting Problem' },
    { key: 'diagnosis', field: 'clinicalHandoff.workingDiagnosis', label: 'Working Diagnosis' },
    { key: 'referralReason', field: 'clinicalHandoff.referralReason', label: 'Reason for Referral' },
    { key: 'vitalsObservations', field: 'clinicalHandoff.vitals', label: 'Vitals & Observations' },
  ];

  const patientBlocks = [];
  requiredFields.forEach(f => {
    let val = patientData[f.key];
    if (val === undefined || val === null || String(val).trim() === '') {
      // Check nested aliases in case data was passed nested
      if (f.key === 'patientName') val = patientData.patientInfo?.name || patientData.name;
      else if (f.key === 'patientAge') val = patientData.patientInfo?.age || patientData.age;
      else if (f.key === 'patientSex') val = patientData.patientInfo?.gender || patientData.patientInfo?.sex || patientData.sex;
      else if (f.key === 'currentProblem') val = patientData.clinicalHandoff?.presentingProblem || patientData.problem;
      else if (f.key === 'diagnosis') val = patientData.clinicalHandoff?.workingDiagnosis;
      else if (f.key === 'referralReason') val = patientData.clinicalHandoff?.referralReason;
      else if (f.key === 'vitalsObservations') val = patientData.clinicalHandoff?.vitals;
    }

    if (val === undefined || val === null || String(val).trim() === '') {
      patientBlocks.push({
        field: f.field,
        message: 'Missing mandatory field: ' + f.label,
      });
    }
  });

  blocks.push(...patientBlocks);
  checkDetails.patientInfoComplete = (patientBlocks.length === 0);

  // 2. Hospital checks
  if (!referringHospitalId) {
    blocks.push({ field: 'referringHospital', message: 'Referring hospital identity is unverified.' });
  } else {
    checkDetails.referringHospitalVerified = true;
  }

  let destHosp = null;
  if (!destinationHospitalId) {
    blocks.push({ field: 'destinationHospital', message: 'Destination hospital is required.' });
  } else if (String(referringHospitalId) === String(destinationHospitalId)) {
    blocks.push({ field: 'destinationHospital', message: 'Destination hospital cannot be the same as referring hospital.' });
  } else {
    destHosp = await Hospital.findById(destinationHospitalId).lean();
    if (!destHosp || !destHosp.isActive) {
      blocks.push({ field: 'destinationHospital', message: 'Destination hospital does not exist or is inactive.' });
    } else {
      checkDetails.destinationHospitalVerified = true;
      checkDetails.destinationHospitalName = destHosp.name;

      if (referringHospitalId) {
        const refHosp = await Hospital.findById(referringHospitalId).lean();
        if (refHosp && refHosp.latitude && destHosp.latitude) {
          checkDetails.approxDistanceKm = calculateDistanceKm(
            refHosp.latitude,
            refHosp.longitude,
            destHosp.latitude,
            destHosp.longitude
          );
        }
      }
    }
  }

  // 3. Receiving Doctor check
  if (!receivingDoctorId) {
    blocks.push({ field: 'receivingDoctor', message: 'Receiving doctor is required.' });
  } else {
    const doctor = await User.findById(receivingDoctorId).lean();
    if (!doctor || !doctor.isActive) {
      blocks.push({ field: 'receivingDoctor', message: 'Selected doctor does not exist or account is inactive.' });
    } else if (!doctor.hospital || String(doctor.hospital) !== String(destinationHospitalId)) {
      blocks.push({ field: 'receivingDoctor', message: 'Selected doctor does not belong to the destination hospital.' });
    } else if (!['doctor', 'hospital_admin'].includes(doctor.role)) {
      blocks.push({ field: 'receivingDoctor', message: 'Selected user is not authorized to receive clinical referrals.' });
    } else {
      checkDetails.receivingDoctorVerified = true;
      checkDetails.receivingDoctorName = doctor.name;
    }
  }

  // 4. Bed / Resource Capacity Check
  let bedAvailability = {
    icuAvailable: 0,
    generalAvailable: 0,
    oxygenAvailable: 0,
    ventilatorAvailable: 0,
  };

  if (destinationHospitalId) {
    const beds = await Bed.find({ hospital: destinationHospitalId, isActive: true }).lean();
    beds.forEach(b => {
      const avail = b.available !== undefined ? b.available : Math.max(0, (b.totalBeds || b.total || 0) - (b.occupiedBeds || b.occupied || 0) - (b.reservedBeds || 0));
      const type = (b.type || '').toLowerCase();
      if (type.includes('icu')) bedAvailability.icuAvailable += avail;
      else if (type.includes('ox')) bedAvailability.oxygenAvailable += avail;
      else if (type.includes('vent')) bedAvailability.ventilatorAvailable += avail;
      else bedAvailability.generalAvailable += avail;

      // Handle nested structure if bed model has { icu: { total, available } }
      if (b.icu && b.icu.available !== undefined) bedAvailability.icuAvailable += b.icu.available;
      if (b.general && b.general.available !== undefined) bedAvailability.generalAvailable += b.general.available;
      if (b.oxygen && b.oxygen.available !== undefined) bedAvailability.oxygenAvailable += b.oxygen.available;
      if (b.ventilator && b.ventilator.available !== undefined) bedAvailability.ventilatorAvailable += b.ventilator.available;
    });

    checkDetails.resourceDetails = bedAvailability;

    // Check requirements
    let reqsList = Array.isArray(specialRequirements) ? specialRequirements : Object.keys(specialRequirements).filter(k => specialRequirements[k]);
    reqsList = reqsList.map(r => String(r).toLowerCase());

    if (reqsList.some(r => r.includes('icu')) && bedAvailability.icuAvailable <= 0) {
      warnings.push({
        field: 'bedAvailability.icu',
        message: 'Destination hospital reports 0 available ICU beds.',
      });
      checkDetails.resourceCapacityStatus = 'limited';
    }

    warnings.push({
      field: 'notice',
      message: 'DEMO AVAILABILITY — NOT REAL-TIME. Confirm current availability directly with destination hospital.',
    });
  }

  const distanceKm = checkDetails.approxDistanceKm !== null ? checkDetails.approxDistanceKm : 8.5;
  const estimatedTransitMinutes = Math.max(10, Math.round(distanceKm * 2.5));

  const isReady = blocks.length === 0;

  return {
    isReady,
    distanceKm,
    estimatedTransitMinutes,
    bedAvailability,
    checkDetails,
    blocks,
    warnings,
    evaluatedAt: new Date(),
  };
}

module.exports = {
  performReadinessCheck,
  calculateDistanceKm,
};
