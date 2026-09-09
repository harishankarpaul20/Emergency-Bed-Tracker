const EmergencyIntake = require('../models/EmergencyIntake');
const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const { formatBedSummary } = require('./bedService');
const logger = require('../utils/logger');

/**
 * Haversine formula to calculate distance in km between two geo-coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Map patient condition to Application Priority indicator
 * NOTE: Explicitly marked as Application Priority and NOT a medical diagnosis.
 */
function mapConditionToPriority(condition) {
  switch (condition) {
    case 'Very Serious / Critical':
      return 'Immediate attention';
    case 'Serious':
      return 'Urgent attention';
    case 'Moderate':
      return 'Prompt assessment';
    case 'Stable':
      return 'Emergency assessment';
    case 'Unknown':
    default:
      return 'Professional assessment required';
  }
}

/**
 * Mask contact phone number for privacy preservation in responses
 */
function maskContactNumber(phone) {
  if (!phone || phone.length < 4) return '******';
  return phone.slice(0, 2) + '******' + phone.slice(-2);
}

/**
 * Prioritizes existing hospitals based on emergency type, condition, bed availability,
 * facilities, district/area, and proximity.
 */
async function prioritizeHospitals(intakeData) {
  const {
    emergencyType,
    condition,
    district,
    area,
    ambulanceRequired,
    lat,
    lng,
  } = intakeData;

  // Retrieve all active hospitals
  const activeHospitals = await Hospital.find({ isActive: true }).lean();
  if (!activeHospitals.length) {
    return [];
  }

  const hospitalIds = activeHospitals.map((h) => h._id);

  // Retrieve active bed records for all hospitals
  const allBeds = await Bed.find({
    hospital: { $in: hospitalIds },
    isActive: true,
  }).lean();

  const bedsByHospital = {};
  for (const b of allBeds) {
    const hid = b.hospital.toString();
    if (!bedsByHospital[hid]) bedsByHospital[hid] = [];
    bedsByHospital[hid].push(b);
  }

  const scoredHospitals = [];

  for (const h of activeHospitals) {
    const hBeds = bedsByHospital[h._id.toString()] || [];
    const summary = formatBedSummary(hBeds);
    const facilities = h.facilities || [];

    let score = 0;
    const matchReasons = [];

    // 1. District & Locality Match
    if (district && district.trim() && district.toLowerCase() !== 'all') {
      if (h.district.toLowerCase() === district.trim().toLowerCase()) {
        score += 50;
        matchReasons.push(`Located in ${h.district}`);
      }
    }

    if (area && area.trim()) {
      if (h.area.toLowerCase().includes(area.trim().toLowerCase())) {
        score += 25;
        matchReasons.push(`In immediate vicinity of ${h.area}`);
      }
    }

    // Distance calculation if coordinates available
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;
    let distance = null;
    if (userLat && userLng) {
      distance = calculateDistance(userLat, userLng, h.latitude, h.longitude);
      if (distance !== null) {
        if (distance <= 5) score += 20;
        else if (distance <= 15) score += 12;
        else if (distance <= 30) score += 5;
        else if (distance > 100) score -= 15; // Far away penalty
      }
    }

    // 2. Bed Overall Availability
    if (summary.status === 'available') {
      score += 30;
      matchReasons.push('Beds currently available');
    } else if (summary.status === 'limited') {
      score += 15;
      matchReasons.push('Limited beds available');
    } else if (summary.status === 'full') {
      score -= 35; // Heavy penalty if hospital is completely full
    }

    // 3. Clinical Emergency Type Matching
    const hasEmergencyDept = facilities.some((f) =>
      /emergency/i.test(f)
    );
    if (hasEmergencyDept) {
      score += 20;
      matchReasons.push('24/7 Emergency Department');
    }

    const hasAmbulanceSupport = facilities.some((f) =>
      /ambulance/i.test(f)
    );
    if (ambulanceRequired === 'Yes' && hasAmbulanceSupport) {
      score += 25;
      matchReasons.push('Active Ambulance Support');
    }

    switch (emergencyType) {
      case 'Cardiac Emergency':
        if (summary.icuBeds > 0) {
          score += 40;
          matchReasons.push(`ICU Beds available (${summary.icuBeds})`);
        }
        if (summary.oxygenBeds > 0) {
          score += 15;
        }
        if (facilities.some((f) => /diagnostic|icu/i.test(f))) {
          score += 15;
          matchReasons.push('Advanced cardiac diagnostic & ICU facilities');
        }
        break;

      case 'Breathing Problem':
        if (summary.oxygenBeds > 0) {
          score += 35;
          matchReasons.push(`Oxygen Support Beds available (${summary.oxygenBeds})`);
        }
        if (summary.ventilators > 0) {
          score += 30;
          matchReasons.push(`Ventilator support available (${summary.ventilators})`);
        }
        if (facilities.some((f) => /oxygen/i.test(f))) {
          score += 15;
          matchReasons.push('Dedicated Oxygen Support facility');
        }
        break;

      case 'Accident / Trauma':
      case 'Severe Bleeding':
        if (hasEmergencyDept) score += 20;
        if (summary.generalBeds > 0) {
          score += 20;
          matchReasons.push(`General Emergency Beds available (${summary.generalBeds})`);
        }
        if (summary.icuBeds > 0) {
          score += 25;
          matchReasons.push(`Trauma/ICU backup available (${summary.icuBeds} ICU beds)`);
        }
        if (hasAmbulanceSupport) score += 15;
        break;

      case 'Stroke Symptoms':
        if (summary.icuBeds > 0) {
          score += 35;
          matchReasons.push(`Critical ICU capability (${summary.icuBeds} beds)`);
        }
        if (facilities.some((f) => /diagnostic/i.test(f))) {
          score += 20;
          matchReasons.push('Emergency Diagnostic Services on site');
        }
        break;

      case 'Burn':
        if (summary.icuBeds > 0) {
          score += 30;
          matchReasons.push(`ICU beds for critical burn care (${summary.icuBeds})`);
        }
        if (summary.oxygenBeds > 0) score += 15;
        break;

      case 'Pregnancy / Obstetric Emergency':
        if (summary.generalBeds > 0) {
          score += 25;
          matchReasons.push(`Inpatient maternity beds available (${summary.generalBeds})`);
        }
        if (summary.icuBeds > 0) score += 15;
        if (hasAmbulanceSupport) score += 15;
        break;

      case 'Pediatric Emergency':
        if (facilities.some((f) => /pediatric/i.test(f))) {
          score += 30;
          matchReasons.push('Specialized Pediatric Care');
        }
        if (summary.icuBeds > 0) {
          score += 20;
          matchReasons.push(`Pediatric/ICU beds available (${summary.icuBeds})`);
        }
        break;

      case 'Poisoning':
      case 'General Emergency':
      case 'Other':
      default:
        if (summary.generalBeds > 0) {
          score += 20;
          matchReasons.push(`General beds available (${summary.generalBeds})`);
        }
        if (summary.oxygenBeds > 0) score += 15;
        break;
    }

    // 4. Condition Severity Multiplier
    if (condition === 'Very Serious / Critical') {
      if (summary.icuBeds > 0 || summary.ventilators > 0) {
        score += 35;
        matchReasons.push('Immediate critical care / ventilator capability');
      } else {
        score -= 20; // Critical patient needs ICU/ventilator
      }
    } else if (condition === 'Serious') {
      if (summary.icuBeds > 0 || summary.oxygenBeds > 0) {
        score += 20;
      }
    } else if (condition === 'Moderate') {
      if (summary.generalBeds > 0 || summary.oxygenBeds > 0) {
        score += 15;
      }
    }

    // 5. Verification status boost
    if (h.isVerified) {
      score += 5;
    }

    scoredHospitals.push({
      id: h._id.toString(),
      _id: h._id,
      name: h.name,
      district: h.district,
      area: h.area,
      address: h.address,
      phone: h.phone,
      hospitalType: h.hospitalType,
      isVerified: h.isVerified,
      facilities,
      latitude: h.latitude,
      longitude: h.longitude,
      distance: distance !== null ? distance : 3.5, // Default realistic display distance
      ...summary,
      score,
      matchReasons: [...new Set(matchReasons)],
    });
  }

  // Sort by highest priority score descending, then by distance ascending
  scoredHospitals.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.distance || 0) - (b.distance || 0);
  });

  return scoredHospitals;
}

/**
 * Handles the complete patient intake lifecycle:
 * 1. Computes Application Priority
 * 2. Matches & prioritizes hospitals
 * 3. Persists intake record to MongoDB
 * 4. Returns formatted sanitized response
 */
async function processEmergencyIntake(intakeData) {
  const applicationPriority = mapConditionToPriority(intakeData.condition);

  // Match and prioritize hospitals
  const prioritized = await prioritizeHospitals(intakeData);

  // Top 10 recommendations for display
  const topRecommendations = prioritized.slice(0, 10);

  // Prepare matched summaries for database persistence
  const matchedHospitalsSummary = topRecommendations.slice(0, 5).map((h) => ({
    hospital: h._id,
    hospitalName: h.name,
    district: h.district,
    score: h.score,
    matchReasons: h.matchReasons,
  }));

  // Create persistent intake record
  const intakeRecord = await EmergencyIntake.create({
    patientName: intakeData.patientName.trim(),
    age: Number(intakeData.age),
    sex: intakeData.sex,
    symptoms: intakeData.symptoms.trim(),
    condition: intakeData.condition,
    emergencyType: intakeData.emergencyType,
    contactNumber: intakeData.contactNumber.trim(),
    attendantName: (intakeData.attendantName || '').trim(),
    ambulanceRequired: intakeData.ambulanceRequired || 'Not Sure',
    additionalInformation: (intakeData.additionalInformation || '').trim(),
    district: (intakeData.district || '').trim(),
    area: (intakeData.area || '').trim(),
    applicationPriority,
    status: 'received',
    matchedHospitals: matchedHospitalsSummary,
  });

  logger.info(
    `🚨 Emergency Intake logged [ID: ${intakeRecord._id}] for ${intakeData.emergencyType} (Priority: ${applicationPriority})`
  );

  return {
    intakeId: intakeRecord._id,
    applicationPriority,
    condition: intakeData.condition,
    emergencyType: intakeData.emergencyType,
    patientName: intakeData.patientName,
    maskedContact: maskContactNumber(intakeData.contactNumber),
    district: intakeData.district || '',
    area: intakeData.area || '',
    ambulanceRequired: intakeData.ambulanceRequired || 'Not Sure',
    matchedCount: prioritized.length,
    recommendedHospitals: topRecommendations,
    disclaimers: {
      medical:
        'This application does not replace professional medical assessment. For life-threatening emergencies, contact emergency services immediately.',
      demoData:
        'DEMO DATA — HOSPITAL AVAILABILITY IS NOT REAL-TIME. Always confirm current bed availability directly with the hospital.',
    },
    emergencyHotlines: [
      { name: 'National Emergency', number: '112', action: 'tel:112' },
      { name: 'Ambulance', number: '108', action: 'tel:108' },
      { name: 'Police', number: '100', action: 'tel:100' },
      { name: 'Fire Service', number: '101', action: 'tel:101' },
    ],
  };
}

module.exports = {
  mapConditionToPriority,
  calculateDistance,
  prioritizeHospitals,
  processEmergencyIntake,
};
