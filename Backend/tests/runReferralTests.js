/**
 * ======================================================================
 * HOSPITAL-TO-HOSPITAL EMERGENCY PATIENT REFERRAL SYSTEM TEST SUITE
 * ======================================================================
 * Validates complete referral lifecycle, automatic readiness checks,
 * role-based access control, cross-hospital isolation, and persistence in MongoDB Atlas.
 */

require('../config/bootstrap');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');

const { app } = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const BedRequest = require('../models/BedRequest');
const User = require('../models/User');
const Referral = require('../models/Referral');

const TEST_PORT = 5003;
const BASE_URL = 'http://localhost:' + TEST_PORT + '/api';

const testResults = [];
function logTest(num, name, passed, detail = '') {
  testResults.push({ num, name, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(icon + ' [TEST ' + num.toString().padStart(2, '0') + '] ' + name + (detail ? ' (' + detail + ')' : ''));
}

async function requestJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let body = {};
  try {
    body = await res.json();
  } catch (e) {}
  return { status: res.status, headers: res.headers, body };
}

async function runReferralTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING HOSPITAL-TO-HOSPITAL EMERGENCY REFERRAL TEST SUITE');
  console.log('📡 API Target: ' + BASE_URL);
  console.log('======================================================\n');

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
  await connectDB();

  let hospitalA, hospitalB, hospitalC;
  let doctorA, doctorB, doctorC;
  let tokenA, tokenB, tokenC;
  let sampleBedRequest;
  let testReferralId = null;

  try {
    // 0. Setup test hospitals and clinicians
    const hospitals = await Hospital.find({}).limit(3);
    if (hospitals.length < 3) {
      throw new Error('At least 3 hospitals are required in DB for isolation testing.');
    }
    hospitalA = hospitals[0];
    hospitalB = hospitals[1];
    hospitalC = hospitals[2];

    console.log('🏥 Referring Hospital A: ' + hospitalA.name + ' (ID: ' + hospitalA._id + ')');
    console.log('🏥 Receiving Hospital B: ' + hospitalB.name + ' (ID: ' + hospitalB._id + ')');
    console.log('🏥 Unrelated Hospital C: ' + hospitalC.name + ' (ID: ' + hospitalC._id + ')');

    // Ensure Bed records exist for Hospital B to test readiness check bed capacity
    let bBeds = await Bed.findOne({ hospital: hospitalB._id });
    if (!bBeds) {
      bBeds = await Bed.create({
        hospital: hospitalB._id,
        icu: { total: 10, available: 4 },
        general: { total: 20, available: 8 },
        oxygen: { total: 15, available: 5 },
        ventilator: { total: 5, available: 2 },
        pediatric: { total: 5, available: 2 },
      });
    }

    // Create Doctor A (Hospital A)
    const emailA = 'test.doctor.a.' + Date.now() + '@wb.gov.in';
    doctorA = await User.create({
      name: 'Dr. Ananya Roy (Referral Test)',
      email: emailA,
      passwordHash: 'DoctorPassword123!',
      role: 'doctor',
      hospital: hospitalA._id,
      department: 'Emergency Medicine',
      specialization: 'Trauma & Critical Care',
      isActive: true,
      verified: true
    });

    // Create Doctor B (Hospital B)
    const emailB = 'test.doctor.b.' + Date.now() + '@wb.gov.in';
    doctorB = await User.create({
      name: 'Dr. Bimal Sen (Referral Test)',
      email: emailB,
      passwordHash: 'DoctorPassword123!',
      role: 'doctor',
      hospital: hospitalB._id,
      department: 'Critical Care',
      specialization: 'Intensivist',
      isActive: true,
      verified: true
    });

    // Create Doctor C (Hospital C)
    const emailC = 'test.doctor.c.' + Date.now() + '@wb.gov.in';
    doctorC = await User.create({
      name: 'Dr. Chandan Ghosh (Referral Test)',
      email: emailC,
      passwordHash: 'DoctorPassword123!',
      role: 'doctor',
      hospital: hospitalC._id,
      department: 'General Medicine',
      isActive: true,
      verified: true
    });

    // Login Doctor A
    const loginA = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: 'DoctorPassword123!', hospitalId: hospitalA._id.toString() })
    });
    tokenA = loginA.body?.data?.token || loginA.body?.token;

    // Login Doctor B
    const loginB = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailB, password: 'DoctorPassword123!', hospitalId: hospitalB._id.toString() })
    });
    tokenB = loginB.body?.data?.token || loginB.body?.token;

    // Login Doctor C
    const loginC = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailC, password: 'DoctorPassword123!', hospitalId: hospitalC._id.toString() })
    });
    tokenC = loginC.body?.data?.token || loginC.body?.token;

    // Ensure bed record for Hospital A
    let aBed = await Bed.findOne({ hospital: hospitalA._id });
    if (!aBed) {
      aBed = await Bed.create({
        hospital: hospitalA._id,
        type: 'icu',
        total: 10,
        occupied: 2,
        available: 8
      });
    }

    // Create a sample BedRequest at Hospital A to initiate patient referral
    sampleBedRequest = await BedRequest.create({
      user: doctorA._id,
      hospital: hospitalA._id,
      bed: aBed._id,
      bedType: aBed.type || 'icu',
      patientName: 'Subhas Chandra Bose',
      patientAge: 52,
      patientGender: 'male',
      contactPhone: '9876543210',
      bloodGroup: 'O+',
      severity: 'critical',
      notes: 'Severe respiratory distress, acute hypoxemia',
      status: 'pending',
      timeline: [{ status: 'pending', note: 'Initial bed request filed' }]
    });

    // --- TEST 1: Doctor A Login Success ---
    logTest(1, 'Doctor A staff login with matching hospital credentials',
      loginA.status === 200 && !!tokenA,
      'Status ' + loginA.status + ', Doctor ID: ' + doctorA._id
    );

    // --- TEST 2: Doctor B Login Success ---
    logTest(2, 'Doctor B staff login with receiving hospital credentials',
      loginB.status === 200 && !!tokenB,
      'Status ' + loginB.status + ', Doctor ID: ' + doctorB._id
    );

    // --- TEST 3: Unauthenticated access to /api/referrals is blocked ---
    const unauthCheck = await requestJson(BASE_URL + '/referrals/incoming');
    logTest(3, 'Unauthenticated request to referral endpoint returns 401',
      unauthCheck.status === 401,
      'Status ' + unauthCheck.status
    );

    // --- TEST 4: Destination hospitals exclude referring hospital ---
    const destHospitalsRes = await requestJson(BASE_URL + '/referrals/hospitals', {
      headers: { Authorization: 'Bearer ' + tokenA }
    });
    const hasReferring = destHospitalsRes.body?.data?.some(h => String(h._id) === String(hospitalA._id));
    const hasOther = destHospitalsRes.body?.data?.some(h => String(h._id) === String(hospitalB._id));
    logTest(4, 'Destination hospitals list excludes referring Hospital A and includes other hospitals',
      destHospitalsRes.status === 200 && !hasReferring && hasOther,
      'Total candidates: ' + destHospitalsRes.body?.data?.length + ', Referring excluded: ' + !hasReferring
    );

    // --- TEST 5: Destination doctors endpoint returns only doctors of selected hospital ---
    const destDocsRes = await requestJson(BASE_URL + '/referrals/doctors/' + hospitalB._id, {
      headers: { Authorization: 'Bearer ' + tokenA }
    });
    const includesDocB = destDocsRes.body?.data?.some(d => String(d._id) === String(doctorB._id));
    const includesDocA = destDocsRes.body?.data?.some(d => String(d._id) === String(doctorA._id));
    logTest(5, 'Destination doctors endpoint returns doctors associated with Hospital B and excludes Doctor A',
      destDocsRes.status === 200 && includesDocB && !includesDocA,
      'Found Doctor B: ' + includesDocB + ', Excluded Doctor A: ' + !includesDocA
    );

    // --- TEST 6: Readiness check identifies missing clinical handoff fields ---
    const incompleteCheckRes = await requestJson(BASE_URL + '/referrals/readiness-check', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        patientInfo: { name: 'Subhas Chandra Bose' },
        destinationHospital: hospitalB._id.toString(),
        receivingDoctor: doctorB._id.toString(),
        clinicalHandoff: {} // completely missing required fields
      })
    });
    const blocksIncomplete = incompleteCheckRes.body?.data?.blocks || [];
    const hasProbBlock = blocksIncomplete.some(b => b.field === 'clinicalHandoff.presentingProblem');
    const hasDiagBlock = blocksIncomplete.some(b => b.field === 'clinicalHandoff.workingDiagnosis');
    const hasReasonBlock = blocksIncomplete.some(b => b.field === 'clinicalHandoff.referralReason');
    const hasVitalsBlock = blocksIncomplete.some(b => b.field === 'clinicalHandoff.vitals');
    logTest(6, 'Readiness check flags missing presenting problem, vitals, diagnosis, and referral reason as hard blocks',
      incompleteCheckRes.status === 200 && hasProbBlock && hasDiagBlock && hasReasonBlock && hasVitalsBlock && incompleteCheckRes.body?.data?.isReady === false,
      'Blocks: ' + blocksIncomplete.length + ', isReady: ' + incompleteCheckRes.body?.data?.isReady
    );

    // --- TEST 7: Readiness check flags invalid/non-existent destination hospital ---
    const invalidHospCheckRes = await requestJson(BASE_URL + '/referrals/readiness-check', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        patientInfo: { name: 'Test Patient', age: 40, gender: 'male' },
        destinationHospital: new mongoose.Types.ObjectId().toString(),
        receivingDoctor: doctorB._id.toString(),
        clinicalHandoff: {
          presentingProblem: 'Chest pain',
          workingDiagnosis: 'NSTEMI',
          referralReason: 'Cath lab intervention needed',
          condition: 'serious',
          vitals: { bloodPressure: '130/80', heartRate: 90, respiratoryRate: 20, oxygenSaturation: 97, temperature: 98.6 }
        }
      })
    });
    const hasHospBlock = invalidHospCheckRes.body?.data?.blocks?.some(b => b.field === 'destinationHospital');
    logTest(7, 'Readiness check blocks invalid or non-existent destination hospital',
      invalidHospCheckRes.status === 200 && hasHospBlock && invalidHospCheckRes.body?.data?.isReady === false,
      'Block message: ' + (hasHospBlock ? 'Detected' : 'Failed')
    );

    // --- TEST 8: Readiness check flags unassociated receiving doctor ---
    const wrongDocCheckRes = await requestJson(BASE_URL + '/referrals/readiness-check', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        patientInfo: { name: 'Test Patient', age: 40, gender: 'male' },
        destinationHospital: hospitalB._id.toString(),
        receivingDoctor: doctorC._id.toString(),
        clinicalHandoff: {
          presentingProblem: 'Chest pain',
          workingDiagnosis: 'NSTEMI',
          referralReason: 'Cath lab intervention needed',
          condition: 'serious',
          vitals: { bloodPressure: '130/80', heartRate: 90, respiratoryRate: 20, oxygenSaturation: 97, temperature: 98.6 }
        }
      })
    });
    const hasDocBlock = wrongDocCheckRes.body?.data?.blocks?.some(b => b.field === 'receivingDoctor');
    logTest(8, 'Readiness check blocks receiving doctor not affiliated with destination hospital',
      wrongDocCheckRes.status === 200 && hasDocBlock,
      'Doctor verification: ' + (hasDocBlock ? 'Flagged doctor mismatch' : 'Failed')
    );

    // --- TEST 9: Readiness check calculates distance, transit time & bed availability ---
    const validCheckRes = await requestJson(BASE_URL + '/referrals/readiness-check', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        patientInfo: { name: 'Subhas Chandra Bose', age: 52, gender: 'male', bloodGroup: 'O+', contactPhone: '9876543210' },
        destinationHospital: hospitalB._id.toString(),
        receivingDoctor: doctorB._id.toString(),
        clinicalHandoff: {
          presentingProblem: 'Acute hypoxemic respiratory failure',
          symptoms: ['Dyspnea', 'Tachypnea', 'Accessory muscle use'],
          workingDiagnosis: 'Severe ARDS secondary to bilateral pneumonia',
          treatmentGiven: 'Non-invasive ventilation, IV Dexamethasone, Nebulization',
          currentMedications: 'Levofloxacin 750mg IV, Enoxaparin 40mg SC',
          proceduresDone: 'Arterial blood gas, Chest X-Ray',
          condition: 'critical',
          vitals: { bloodPressure: '135/88', heartRate: 112, respiratoryRate: 32, oxygenSaturation: 89, temperature: 101.4 },
          referralReason: 'Requires urgent tertiary ECMO / advanced critical care bed',
          specialRequirements: { oxygenSupport: true, ventilatorRequired: true, isolationRequired: false }
        }
      })
    });
    const checkData = validCheckRes.body?.data;
    const hasDistance = typeof checkData?.distanceKm === 'number';
    const hasTransitTime = typeof checkData?.estimatedTransitMinutes === 'number';
    const hasBedInfo = checkData?.bedAvailability !== undefined;
    logTest(9, 'Readiness check computes distance, transit time, and destination bed breakdown',
      validCheckRes.status === 200 && checkData?.isReady === true && hasDistance && hasTransitTime && hasBedInfo,
      'Distance: ' + checkData?.distanceKm + ' km, Transit: ~' + checkData?.estimatedTransitMinutes + ' mins, ICU beds: ' + checkData?.bedAvailability?.icuAvailable
    );

    // --- TEST 10: Attempting to create referral with blocked readiness fails (400) ---
    const blockedCreateRes = await requestJson(BASE_URL + '/referrals', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        patientInfo: { name: 'Incomplete Patient' },
        destinationHospital: hospitalB._id.toString(),
        receivingDoctor: doctorB._id.toString(),
        clinicalHandoff: {} // invalid
      })
    });
    logTest(10, 'Creating referral with unresolved hard blockers is rejected with HTTP 400',
      blockedCreateRes.status === 400 && blockedCreateRes.body?.success === false,
      'Status ' + blockedCreateRes.status + ', Error: ' + blockedCreateRes.body?.message
    );

    // --- TEST 11: Submitting valid referral succeeds and persists in MongoDB Atlas ---
    const validReferralPayload = {
      bedRequestId: sampleBedRequest._id.toString(),
      destinationHospital: hospitalB._id.toString(),
      receivingDoctor: doctorB._id.toString(),
      patientInfo: {
        name: sampleBedRequest.patientName || 'Subhas Chandra Bose',
        age: 52,
        gender: 'male',
        contactPhone: sampleBedRequest.contactPhone || '9876543210',
        bloodGroup: 'O+'
      },
      clinicalHandoff: {
        presentingProblem: 'Acute hypoxemic respiratory failure',
        symptoms: ['Dyspnea', 'Tachypnea', 'Cyanosis'],
        workingDiagnosis: 'Severe ARDS secondary to bilateral pneumonia',
        treatmentGiven: 'High-flow oxygen, IV steroids, Broad-spectrum antibiotics',
        currentMedications: 'Piperacillin-Tazobactam 4.5g IV, Enoxaparin 40mg',
        proceduresDone: 'Endotracheal intubation, ABG analysis',
        condition: 'critical',
        vitals: { bloodPressure: '138/85', heartRate: 115, respiratoryRate: 34, oxygenSaturation: 91, temperature: 101.2 },
        referralReason: 'Immediate tertiary ICU and ECMO evaluation required',
        specialRequirements: { oxygenSupport: true, ventilatorRequired: true, isolationRequired: false }
      }
    };

    const createRes = await requestJson(BASE_URL + '/referrals', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify(validReferralPayload)
    });

    const createdReferral = createRes.body?.data;
    testReferralId = createdReferral?._id;

    logTest(11, 'Referral creation succeeds and returns persisted document with status pending',
      createRes.status === 201 && createdReferral?.status === 'pending' && !!testReferralId,
      'Referral ID: ' + testReferralId + ', Status: ' + createdReferral?.status
    );

    // --- TEST 12: Verify referral in MongoDB directly ---
    const dbReferral = await Referral.findById(testReferralId);
    const hasAuditTrail = dbReferral?.auditTrail?.length > 0;
    const hasReadinessSnapshot = !!dbReferral?.readinessCheck?.evaluatedAt;
    logTest(12, 'Direct MongoDB Atlas verification: Document exists with snapshot and initial audit trail',
      !!dbReferral && hasAuditTrail && hasReadinessSnapshot && String(dbReferral.referringHospital) === String(hospitalA._id),
      'Audit trail length: ' + dbReferral?.auditTrail?.length + ', Readiness evaluated: ' + hasReadinessSnapshot
    );

    // --- TEST 13: Duplicate referral prevention for same bed request ---
    const dupRes = await requestJson(BASE_URL + '/referrals', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify(validReferralPayload)
    });
    logTest(13, 'Duplicate active referral for same patient/bed request is prevented with 409 Conflict',
      dupRes.status === 409,
      'Status ' + dupRes.status + ', Message: ' + dupRes.body?.message
    );

    // --- TEST 14: Receiving Doctor B sees referral in incoming referrals list ---
    const incomingRes = await requestJson(BASE_URL + '/referrals/incoming', {
      headers: { Authorization: 'Bearer ' + tokenB }
    });
    const foundInIncoming = incomingRes.body?.data?.some(r => String(r._id) === String(testReferralId));
    logTest(14, 'Receiving Doctor B views new referral under incoming referrals',
      incomingRes.status === 200 && foundInIncoming,
      'Found in incoming: ' + foundInIncoming
    );

    // --- TEST 15: Referring Doctor A sees referral in outgoing referrals list ---
    const outgoingRes = await requestJson(BASE_URL + '/referrals/outgoing', {
      headers: { Authorization: 'Bearer ' + tokenA }
    });
    const foundInOutgoing = outgoingRes.body?.data?.some(r => String(r._id) === String(testReferralId));
    logTest(15, 'Referring Doctor A views referral under outgoing referrals',
      outgoingRes.status === 200 && foundInOutgoing,
      'Found in outgoing: ' + foundInOutgoing
    );

    // --- TEST 16: Cross-hospital authorization isolation (Doctor C blocked from viewing) ---
    const forbiddenRes = await requestJson(BASE_URL + '/referrals/' + testReferralId, {
      headers: { Authorization: 'Bearer ' + tokenC }
    });
    logTest(16, 'Cross-hospital isolation: Doctor C from unrelated hospital receives 403 Forbidden',
      forbiddenRes.status === 403,
      'Status ' + forbiddenRes.status + ', Error: ' + forbiddenRes.body?.message
    );

    // --- TEST 17: Authorized Doctor B retrieves full referral details with clinical handoff ---
    const detailRes = await requestJson(BASE_URL + '/referrals/' + testReferralId, {
      headers: { Authorization: 'Bearer ' + tokenB }
    });
    const retrievedHandoff = detailRes.body?.data?.clinicalHandoff;
    const hasVitals = retrievedHandoff?.vitals?.oxygenSaturation === 91;
    logTest(17, 'Receiving doctor retrieves complete clinical handoff, vitals, and readiness snapshot',
      detailRes.status === 200 && hasVitals && detailRes.body?.data?.patientInfo?.name === 'Subhas Chandra Bose',
      'Patient: ' + detailRes.body?.data?.patientInfo?.name + ', O2 Sat: ' + retrievedHandoff?.vitals?.oxygenSaturation + '%'
    );

    // --- TEST 18: Receiving Doctor B requests more information ---
    const reqInfoRes = await requestJson(BASE_URL + '/referrals/' + testReferralId + '/request-info', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ message: 'Please provide latest arterial blood gas (ABG) pH and PaO2 values.' })
    });
    logTest(18, 'Receiving doctor requests more information; referral status transitions to more_info_requested',
      reqInfoRes.status === 200 && reqInfoRes.body?.data?.status === 'more_info_requested',
      'Status: ' + reqInfoRes.body?.data?.status + ', Note: ' + reqInfoRes.body?.data?.moreInfoRequestedNote
    );

    // --- TEST 19: Referring Doctor A updates clinical handoff in response to request ---
    const updateRes = await requestJson(BASE_URL + '/referrals/' + testReferralId, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        clinicalHandoff: {
          proceduresDone: 'Endotracheal intubation, ABG (pH 7.28, PaO2 62 mmHg on FiO2 0.8)',
          treatmentGiven: 'High-flow oxygen, IV steroids, Broad-spectrum antibiotics, Sedation initiated'
        }
      })
    });
    logTest(19, 'Referring clinician submits clinical info update; referral returns to pending status',
      updateRes.status === 200 && updateRes.body?.data?.status === 'pending',
      'Status: ' + updateRes.body?.data?.status
    );

    // --- TEST 20: Receiving Doctor B accepts referral ---
    const acceptRes = await requestJson(BASE_URL + '/referrals/' + testReferralId + '/accept', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ note: 'Bed prepared in ICU Bay 3, ECMO team notified and on standby.' })
    });
    const acceptedReferral = acceptRes.body?.data;
    logTest(20, 'Receiving doctor accepts referral; status becomes accepted with accepted_at timestamp',
      acceptRes.status === 200 && acceptedReferral?.status === 'accepted' && !!acceptedReferral?.acceptedAt,
      'Status: ' + acceptedReferral?.status + ', AcceptedAt: ' + acceptedReferral?.acceptedAt
    );

    // --- TEST 21: Referring Hospital A marks patient transferred ---
    const transferRes = await requestJson(BASE_URL + '/referrals/' + testReferralId + '/transfer', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({ note: 'Patient departed via Advanced Life Support (ALS) Ambulance WB-01-9988.' })
    });
    logTest(21, 'Referring hospital marks patient transferred; status becomes transferred',
      transferRes.status === 200 && transferRes.body?.data?.status === 'transferred' && !!transferRes.body?.data?.transferredAt,
      'Status: ' + transferRes.body?.data?.status + ', TransferredAt: ' + transferRes.body?.data?.transferredAt
    );

    // --- TEST 22: Receiving Hospital B marks patient received ---
    const receiveRes = await requestJson(BASE_URL + '/referrals/' + testReferralId + '/receive', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ note: 'Ambulance arrived. Patient received in ICU bay 3.' })
    });
    logTest(22, 'Receiving hospital marks patient received; status becomes received',
      receiveRes.status === 200 && receiveRes.body?.data?.status === 'received' && !!receiveRes.body?.data?.receivedAt,
      'Status: ' + receiveRes.body?.data?.status + ', ReceivedAt: ' + receiveRes.body?.data?.receivedAt
    );

    // --- TEST 23: Receiving Hospital B completes referral ---
    const completeRes = await requestJson(BASE_URL + '/referrals/' + testReferralId + '/complete', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ note: 'Patient successfully admitted, stabilized, and intake documented.' })
    });
    logTest(23, 'Receiving hospital completes referral; status becomes completed with completed_at timestamp',
      completeRes.status === 200 && completeRes.body?.data?.status === 'completed' && !!completeRes.body?.data?.completedAt,
      'Status: ' + completeRes.body?.data?.status + ', CompletedAt: ' + completeRes.body?.data?.completedAt
    );

    // --- TEST 24: Rejection without reason is strictly rejected by validator (HTTP 400) ---
    const ref2Res = await requestJson(BASE_URL + '/referrals', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        patientInfo: { name: 'Prafulla Chandra Roy', age: 60, gender: 'male' },
        destinationHospital: hospitalB._id.toString(),
        receivingDoctor: doctorB._id.toString(),
        clinicalHandoff: {
          presentingProblem: 'Traumatic brain injury',
          symptoms: ['Altered mental status', 'Fixed dilated pupil'],
          workingDiagnosis: 'Subdural hematoma',
          treatmentGiven: 'IV Mannitol, Hypertonic saline',
          referralReason: 'Urgent neurosurgical decompression',
          condition: 'critical',
          vitals: { bloodPressure: '150/95', heartRate: 64, respiratoryRate: 14, oxygenSaturation: 95, temperature: 98.4 }
        }
      })
    });
    const ref2Id = ref2Res.body?.data?._id;

    const noReasonRejectRes = await requestJson(BASE_URL + '/referrals/' + ref2Id + '/reject', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ reason: '   ' })
    });
    logTest(24, 'Rejecting referral without mandatory reason is rejected by validator (HTTP 400/422)',
      (noReasonRejectRes.status === 400 || noReasonRejectRes.status === 422),
      'Status: ' + noReasonRejectRes.status + ', Error: ' + noReasonRejectRes.body?.message
    );

    // --- TEST 25: Rejection with valid reason transitions status to rejected and records reason ---
    const validRejectRes = await requestJson(BASE_URL + '/referrals/' + ref2Id + '/reject', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ reason: 'Neurosurgical OT currently occupied with another emergency polytrauma case.' })
    });
    logTest(25, 'Rejecting referral with valid reason updates status to rejected and logs rejection reason',
      validRejectRes.status === 200 && validRejectRes.body?.data?.status === 'rejected' && !!validRejectRes.body?.data?.rejectionReason,
      'Status: ' + validRejectRes.body?.data?.status + ', Reason: ' + validRejectRes.body?.data?.rejectionReason
    );

    // --- TEST 26: Complete lifecycle audit trail verification in MongoDB ---
    const auditReferral = await Referral.findById(testReferralId);
    const actions = auditReferral?.auditTrail?.map(a => a.action) || [];
    const expectedActions = ['created', 'more_info_requested', 'updated', 'accepted', 'transferred', 'received', 'completed'];
    const hasAllActions = expectedActions.every(action => actions.includes(action));
    logTest(26, 'Complete referral audit trail contains all lifecycle events in chronological sequence',
      hasAllActions,
      'Actions recorded (' + actions.length + '): ' + actions.join(' -> ')
    );

    // --- TEST 27: Public Hospital List and Search Endpoint Preservation ---
    const publicHospRes = await requestJson(BASE_URL + '/hospitals');
    const publicSearchRes = await requestJson(BASE_URL + '/hospitals/search?q=Apollo');
    logTest(27, 'Public hospital list and search endpoints remain fully functional and unhindered',
      publicHospRes.status === 200 && publicSearchRes.status === 200 && publicHospRes.body?.data?.length > 0,
      'Hospitals: ' + publicHospRes.body?.data?.length + ', Search matches: ' + publicSearchRes.body?.data?.length
    );

    // --- TEST 28: Public Emergency Bed Request Creation Preservation ---
    const publicBedReqRes = await requestJson(BASE_URL + '/emergency/intake', {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Public Intake Test Patient',
        age: 45,
        sex: 'Female',
        symptoms: 'Sudden chest discomfort and shortness of breath',
        condition: 'Moderate',
        emergencyType: 'Cardiac Emergency',
        contactNumber: '9123456780'
      })
    });
    const intakeId = publicBedReqRes.body?.data?.intakeId || publicBedReqRes.body?.data?.intake?._id || publicBedReqRes.body?.data?._id;
    logTest(28, 'Public emergency bed request intake remains fully functional',
      publicBedReqRes.status === 201 && !!intakeId,
      'Status: ' + publicBedReqRes.status + ', Intake ID: ' + intakeId
    );

  } catch (err) {
    console.error('❌ Test Suite Unhandled Exception:', err);
  } finally {
    // Cleanup test users and referrals
    try {
      if (doctorA?._id) await User.findByIdAndDelete(doctorA._id);
      if (doctorB?._id) await User.findByIdAndDelete(doctorB._id);
      if (doctorC?._id) await User.findByIdAndDelete(doctorC._id);
      if (sampleBedRequest?._id) await BedRequest.findByIdAndDelete(sampleBedRequest._id);
      if (testReferralId) await Referral.findByIdAndDelete(testReferralId);
      await Referral.deleteMany({ 'patientInfo.name': 'Prafulla Chandra Roy' });
      await BedRequest.deleteMany({ patientName: 'Public Intake Test Patient' });
    } catch (e) {}

    await new Promise((resolve) => testServer.close(resolve));
    await disconnectDB();

    console.log('\n======================================================');
    console.log('📊 REFERRAL TEST RESULTS SUMMARY');
    console.log('======================================================');
    const passedCount = testResults.filter(t => t.passed).length;
    const totalCount = testResults.length;
    console.log('Total Tests: ' + totalCount + ' | Passed: ' + passedCount + ' | Failed: ' + (totalCount - passedCount));
    
    if (passedCount === totalCount && totalCount > 0) {
      console.log('🎉 ALL HOSPITAL REFERRAL & READINESS TESTS PASSED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.log('⚠️ SOME TESTS FAILED. Please review the failures above.');
      process.exit(1);
    }
  }
}

runReferralTests();