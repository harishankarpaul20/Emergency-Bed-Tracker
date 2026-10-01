/**
 * testSecurityAudit3Concur01FRemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01F:
 * Referral Duplicate Creation Race
 */

require('../config/bootstrap');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remediation_verification_only_32bytes!';
}

const { app } = require('../server');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const Referral = require('../models/Referral');
const generateToken = require('../utils/generateToken');

const TEST_PORT = 5017;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

async function requestJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
}

async function runConcur01FTests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01F REMEDIATION VERIFICATION SUITE');
  console.log('Referral Duplicate Creation Race');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(id, title, condition, details = '') {
    if (condition) {
      process.stdout.write(`  [PASS] Test ${id.toString().padStart(2, '0')}: ${title}\n`);
      passed++;
    } else {
      process.stderr.write(`  [FAIL] Test ${id.toString().padStart(2, '0')}: ${title} - ${details}\n`);
      failed++;
    }
  }

  let testServer;

  // Cleanup tracking arrays
  const createdHospitalIds = [];
  const createdUserIds = [];
  const createdReferralIds = [];

  try {
    // 1. Connect DB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);

    // 2. Ensure indexes are synced (creates the new unique indexes)
    await Referral.syncIndexes();
    console.log('✅ Referral indexes synced');

    // 3. Start HTTP Test Server
    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
      testServer.on('error', reject);
    });

    // 4. Create Referring Hospital A
    const ts = Date.now();
    const hospitalA = await Hospital.create({
      name: 'DupRef Hosp A ' + ts,
      registrationId: 'WB-DUP-A-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '10 Duplicate Road',
      area: 'Kolkata North',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      phone: '9830001111',
      email: `dup_hosp_a_${ts}@concur01f.com`,
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalA._id);

    // 5. Create Receiving Hospital B
    const hospitalB = await Hospital.create({
      name: 'DupRef Hosp B ' + ts,
      registrationId: 'WB-DUP-B-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '20 Duplicate Street',
      area: 'Kolkata South',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700002',
      phone: '9830002222',
      email: `dup_hosp_b_${ts}@concur01f.com`,
      latitude: 22.5800,
      longitude: 88.3700,
      location: { type: 'Point', coordinates: [88.3700, 22.5800] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalB._id);

    // 6. Create Receiving Hospital C (for non-duplicate tests)
    const hospitalC = await Hospital.create({
      name: 'DupRef Hosp C ' + ts,
      registrationId: 'WB-DUP-C-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'private',
      address: '30 Alternate Lane',
      area: 'Salt Lake',
      district: 'North 24 Parganas',
      state: 'West Bengal',
      pincode: '700091',
      phone: '9830003333',
      email: `dup_hosp_c_${ts}@concur01f.com`,
      latitude: 22.5900,
      longitude: 88.4000,
      location: { type: 'Point', coordinates: [88.4000, 22.5900] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalC._id);

    // 7. Create Referring Doctor A (at Hospital A)
    const doctorA = await User.create({
      name: 'Dr DupRef Referring A',
      email: `doc_dup_a_${ts}@concur01f.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'doctor',
      hospital: hospitalA._id,
      department: 'Emergency Medicine',
      specialization: 'Emergency Care',
      isActive: true,
    });
    createdUserIds.push(doctorA._id);
    const tokenA = generateToken(doctorA._id, doctorA.role);

    // 8. Create Receiving Doctor B (at Hospital B)
    const doctorB = await User.create({
      name: 'Dr DupRef Receiving B',
      email: `doc_dup_b_${ts}@concur01f.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'doctor',
      hospital: hospitalB._id,
      department: 'Critical Care',
      specialization: 'Intensivist',
      isActive: true,
    });
    createdUserIds.push(doctorB._id);

    // 9. Create Receiving Doctor C (at Hospital C)
    const doctorC = await User.create({
      name: 'Dr DupRef Receiving C',
      email: `doc_dup_c_${ts}@concur01f.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'doctor',
      hospital: hospitalC._id,
      department: 'Cardiology',
      specialization: 'Cardiologist',
      isActive: true,
    });
    createdUserIds.push(doctorC._id);

    const patientName = `DupTest Patient ${ts}`;

    const basePayload = {
      patientName,
      patientAge: 55,
      patientSex: 'Male',
      emergencyType: 'Cardiac Emergency',
      currentProblem: 'Severe chest pain',
      symptoms: 'Diaphoresis, SOB',
      diagnosis: 'Acute MI',
      treatmentGiven: 'Aspirin, Oxygen',
      currentCondition: 'Critical',
      referralReason: 'Needs PCI',
      vitalsObservations: 'BP 90/60, HR 110, SpO2 94%',
      destinationHospitalId: hospitalB._id.toString(),
      receivingDoctorId: doctorB._id.toString(),
    };

    // -------------------------------------------------------
    // TEST 01: Create one valid Referral normally
    // -------------------------------------------------------
    console.log('\n--- TEST 01: Baseline Referral Creation ---');
    const res1 = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(basePayload),
    });
    const ref1Id = res1.body?.data?._id;
    if (ref1Id) createdReferralIds.push(ref1Id);
    record(1, 'Baseline referral creation succeeds (201)', res1.status === 201, `Status: ${res1.status}`);

    // -------------------------------------------------------
    // TEST 02: Sequential duplicate rejected (same patient + same hospitals)
    // -------------------------------------------------------
    console.log('\n--- TEST 02: Sequential Duplicate Rejection ---');
    const res2 = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(basePayload),
    });
    record(2, 'Sequential duplicate rejected with 409', res2.status === 409, `Status: ${res2.status}`);

    // -------------------------------------------------------
    // TEST 03: Concurrent duplicate creation race (exactly 1 wins)
    // -------------------------------------------------------
    console.log('\n--- TEST 03: Concurrent Duplicate Creation Race ---');
    // First, clean up the baseline referral so we start fresh
    if (ref1Id) {
      await Referral.deleteOne({ _id: ref1Id });
      createdReferralIds.pop();
    }

    const racePayload = {
      ...basePayload,
      patientName: `RacePatient ${ts}`,
    };

    const raceResults = await Promise.allSettled([
      requestJson(`${BASE_URL}/referrals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(racePayload),
      }),
      requestJson(`${BASE_URL}/referrals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify(racePayload),
      }),
    ]);

    const raceResponses = raceResults.map(r => r.status === 'fulfilled' ? r.value : { status: 500, body: null });
    const successes = raceResponses.filter(r => r.status === 201);
    const conflicts = raceResponses.filter(r => r.status === 409);

    // Track created referrals
    for (const resp of successes) {
      if (resp.body?.data?._id) createdReferralIds.push(resp.body.data._id);
    }

    record(3, 'Concurrent race: exactly 1 succeeds (201), 1 rejected (409)',
      successes.length === 1 && conflicts.length === 1,
      `Successes: ${successes.length}, Conflicts: ${conflicts.length}, Statuses: ${raceResponses.map(r => r.status)}`);

    // -------------------------------------------------------
    // TEST 04: Exactly ONE Referral exists in MongoDB
    // -------------------------------------------------------
    console.log('\n--- TEST 04: Exactly One Referral in DB ---');
    const racePatientName = `RacePatient ${ts}`;
    const dbCount = await Referral.countDocuments({
      patientName: racePatientName,
      referringHospital: hospitalA._id,
      receivingHospital: hospitalB._id,
    });
    record(4, `Exactly 1 referral in DB for race patient (count: ${dbCount})`, dbCount === 1, `Count: ${dbCount}`);

    // -------------------------------------------------------
    // TEST 05: Winning referral has correct source/destination/patient
    // -------------------------------------------------------
    console.log('\n--- TEST 05: Winning Referral Data Integrity ---');
    const winningRef = await Referral.findOne({ patientName: racePatientName }).lean();
    const hasCorrectData = winningRef &&
      winningRef.referringHospital.toString() === hospitalA._id.toString() &&
      winningRef.receivingHospital.toString() === hospitalB._id.toString() &&
      winningRef.receivingDoctor.toString() === doctorB._id.toString() &&
      winningRef.status === 'pending';
    record(5, 'Winning referral has correct patient, hospitals, doctor, status',
      hasCorrectData,
      `Ref: ${JSON.stringify({ referring: winningRef?.referringHospital, receiving: winningRef?.receivingHospital, status: winningRef?.status })}`);

    // -------------------------------------------------------
    // TEST 06: Losing request did not create duplicate history/audit
    // -------------------------------------------------------
    console.log('\n--- TEST 06: No Duplicate Audit Trail ---');
    const allRaceRefs = await Referral.find({ patientName: racePatientName }).lean();
    const totalHistoryEntries = allRaceRefs.reduce((s, r) => s + (r.history?.length || 0), 0);
    record(6, `No duplicate history entries (total: ${totalHistoryEntries}, referrals: ${allRaceRefs.length})`,
      allRaceRefs.length === 1 && totalHistoryEntries <= 1,
      `Referrals: ${allRaceRefs.length}, History: ${totalHistoryEntries}`);

    // -------------------------------------------------------
    // TEST 07: Case-insensitive duplicate detection
    // -------------------------------------------------------
    console.log('\n--- TEST 07: Case-Insensitive Duplicate Detection ---');
    const casePayload = {
      ...basePayload,
      patientName: racePatientName.toUpperCase(),
    };
    const res7 = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(casePayload),
    });
    record(7, 'Case-insensitive duplicate (UPPER) rejected with 409', res7.status === 409, `Status: ${res7.status}`);

    // -------------------------------------------------------
    // TEST 08: Different destination hospital = NOT a duplicate
    // -------------------------------------------------------
    console.log('\n--- TEST 08: Different Destination Hospital (Legitimate) ---');
    const diffDestPayload = {
      ...basePayload,
      patientName: racePatientName,
      destinationHospitalId: hospitalC._id.toString(),
      receivingDoctorId: doctorC._id.toString(),
    };
    const res8 = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(diffDestPayload),
    });
    if (res8.body?.data?._id) createdReferralIds.push(res8.body.data._id);
    record(8, 'Same patient to different hospital is allowed (201)', res8.status === 201, `Status: ${res8.status}`);

    // -------------------------------------------------------
    // TEST 09: Referral after rejection allows re-creation
    // -------------------------------------------------------
    console.log('\n--- TEST 09: Re-creation After Rejection ---');
    // Reject the winning referral directly in DB
    const rejectedName = `RejectedPatient ${ts}`;
    const rejRef = await Referral.create({
      referringHospital: hospitalA._id,
      referringUser: doctorA._id,
      receivingHospital: hospitalB._id,
      receivingDoctor: doctorB._id,
      patientName: rejectedName,
      patientAge: 30,
      patientSex: 'Female',
      emergencyType: 'Trauma',
      currentProblem: 'Head injury',
      symptoms: 'LOC',
      diagnosis: 'TBI',
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: 'Capacity full',
      history: [],
      auditTrail: [],
    });
    createdReferralIds.push(rejRef._id);

    // Now create a new referral for the same patient/hospitals — should succeed
    const res9 = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        ...basePayload,
        patientName: rejectedName,
      }),
    });
    if (res9.body?.data?._id) createdReferralIds.push(res9.body.data._id);
    record(9, 'New referral after rejection succeeds (201)', res9.status === 201, `Status: ${res9.status}`);

    // -------------------------------------------------------
    // TEST 10: Referral after completion allows re-creation
    // -------------------------------------------------------
    console.log('\n--- TEST 10: Re-creation After Completion ---');
    const completedName = `CompletedPatient ${ts}`;
    const compRef = await Referral.create({
      referringHospital: hospitalA._id,
      referringUser: doctorA._id,
      receivingHospital: hospitalB._id,
      receivingDoctor: doctorB._id,
      patientName: completedName,
      patientAge: 60,
      patientSex: 'Male',
      emergencyType: 'Cardiac',
      currentProblem: 'Chest pain',
      symptoms: 'Angina',
      diagnosis: 'STEMI',
      status: 'completed',
      completedAt: new Date(),
      history: [],
      auditTrail: [],
    });
    createdReferralIds.push(compRef._id);

    const res10 = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        ...basePayload,
        patientName: completedName,
      }),
    });
    if (res10.body?.data?._id) createdReferralIds.push(res10.body.data._id);
    record(10, 'New referral after completion succeeds (201)', res10.status === 201, `Status: ${res10.status}`);

    // -------------------------------------------------------
    // TEST 11: Stress test — 10 concurrent identical creations
    // -------------------------------------------------------
    console.log('\n--- TEST 11: Stress Test (10 Concurrent) ---');
    const stressName = `StressPatient ${ts}`;
    const stressPayload = {
      ...basePayload,
      patientName: stressName,
    };

    const stressResults = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        requestJson(`${BASE_URL}/referrals`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify(stressPayload),
        })
      )
    );

    const stressResponses = stressResults.map(r => r.status === 'fulfilled' ? r.value : { status: 500, body: null });
    const stressSuccesses = stressResponses.filter(r => r.status === 201);
    const stressConflicts = stressResponses.filter(r => r.status === 409);

    for (const resp of stressSuccesses) {
      if (resp.body?.data?._id) createdReferralIds.push(resp.body.data._id);
    }

    record(11, `Stress test: exactly 1 success, ${stressConflicts.length} conflicts out of 10`,
      stressSuccesses.length === 1,
      `Successes: ${stressSuccesses.length}, Conflicts: ${stressConflicts.length}, Other: ${stressResponses.filter(r => r.status !== 201 && r.status !== 409).map(r => r.status)}`);

    // -------------------------------------------------------
    // TEST 12: Exactly 1 referral in DB after stress test
    // -------------------------------------------------------
    console.log('\n--- TEST 12: DB Count After Stress ---');
    const stressDbCount = await Referral.countDocuments({
      patientName: stressName,
      referringHospital: hospitalA._id,
      receivingHospital: hospitalB._id,
    });
    record(12, `Exactly 1 stress referral in DB (count: ${stressDbCount})`, stressDbCount === 1, `Count: ${stressDbCount}`);

    // -------------------------------------------------------
    // TEST 13: 409 response does not leak MongoDB internals
    // -------------------------------------------------------
    console.log('\n--- TEST 13: No MongoDB Internal Leakage ---');
    const leakRes = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(stressPayload),
    });
    const leakBody = JSON.stringify(leakRes.body || '');
    const noLeak = !leakBody.includes('E11000') &&
      !leakBody.includes('MongoServerError') &&
      !leakBody.includes('unique_active_') &&
      !leakBody.includes('index') &&
      !leakBody.includes('keyPattern') &&
      !leakBody.includes('collection');
    record(13, '409 response does not leak E11000, index names, or collection names',
      leakRes.status === 409 && noLeak,
      `Status: ${leakRes.status}, Body: ${leakBody.substring(0, 200)}`);

    // -------------------------------------------------------
    // TEST 14: Index Verification
    // -------------------------------------------------------
    console.log('\n--- TEST 14: MongoDB Index Verification ---');
    const indexes = await mongoose.connection.collection('referrals').indexes();
    const bedReqIdx = indexes.find(i => i.name === 'unique_active_bedRequest');
    const intakeIdx = indexes.find(i => i.name === 'unique_active_emergencyIntake');
    const patientIdx = indexes.find(i => i.name === 'unique_active_patient_hospital_pair');

    const idxOk = bedReqIdx?.unique === true &&
      intakeIdx?.unique === true &&
      patientIdx?.unique === true;

    record(14, 'All three partial unique indexes exist and are unique',
      idxOk,
      `bedRequest: ${bedReqIdx?.unique}, intake: ${intakeIdx?.unique}, patient: ${patientIdx?.unique}`);

    // -------------------------------------------------------
    // TEST 15: Database Cleanup
    // -------------------------------------------------------
    console.log('\n--- TEST 15: Database Cleanup ---');

  } catch (err) {
    console.error('❌ UNHANDLED TEST ERROR:', err);
    failed++;
  } finally {
    // Cleanup
    try {
      for (const id of createdReferralIds) {
        await Referral.deleteOne({ _id: id });
      }
      // Also clean up any test referrals that might have leaked
      const ts = createdHospitalIds.length > 0 ? null : null; // fallback
      if (createdHospitalIds.length > 0) {
        await Referral.deleteMany({
          referringHospital: { $in: createdHospitalIds },
        });
        await Referral.deleteMany({
          receivingHospital: { $in: createdHospitalIds },
        });
      }
      for (const id of createdUserIds) {
        await User.deleteOne({ _id: id });
      }
      for (const id of createdHospitalIds) {
        await Hospital.deleteOne({ _id: id });
      }

      // Verify cleanup
      const orphanRefs = createdHospitalIds.length > 0
        ? await Referral.countDocuments({
            $or: [
              { referringHospital: { $in: createdHospitalIds } },
              { receivingHospital: { $in: createdHospitalIds } },
            ],
          })
        : 0;
      const orphanUsers = await User.countDocuments({ _id: { $in: createdUserIds } });
      const orphanHosps = await Hospital.countDocuments({ _id: { $in: createdHospitalIds } });

      const cleanupOk = orphanRefs === 0 && orphanUsers === 0 && orphanHosps === 0;
      if (cleanupOk) {
        process.stdout.write(`  [PASS] Test 15: Database cleanup verified (0 orphan referrals, 0 orphan users, 0 orphan hospitals)\n`);
        passed++;
      } else {
        process.stderr.write(`  [FAIL] Test 15: Cleanup incomplete (Refs: ${orphanRefs}, Users: ${orphanUsers}, Hosps: ${orphanHosps})\n`);
        failed++;
      }
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }

    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }

    try {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed gracefully.');
    } catch (e) { /* ignore */ }

    console.log(`\n====================================================`);
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log(`====================================================\n`);

    process.exit(failed > 0 ? 1 : 0);
  }
}

runConcur01FTests();
