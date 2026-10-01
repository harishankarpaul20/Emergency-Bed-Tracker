/**
 * testSecurityAudit3Concur01CRemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01C:
 * Referral State Machine / Concurrent State Transition Race Remediation
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

const TEST_PORT = 5014;
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

async function runConcur01CTests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01C REMEDIATION VERIFICATION SUITE');
  console.log('Referral State Machine / Concurrent State Transition Race');
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

    // 2. Start HTTP Test Server
    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
      testServer.on('error', reject);
    });

    // 3. Create Referring Hospital A
    const hospitalA = await Hospital.create({
      name: 'Referral Concur Hosp A ' + Date.now(),
      registrationId: 'WB-REF-A-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '10 Hospital Road',
      area: 'Kolkata North',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      phone: '9830001111',
      email: `hosp_a_${Date.now()}@concur.com`,
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalA._id);

    // 4. Create Receiving Hospital B
    const hospitalB = await Hospital.create({
      name: 'Referral Concur Hosp B ' + Date.now(),
      registrationId: 'WB-REF-B-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '20 Medical Street',
      area: 'Kolkata South',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700002',
      phone: '9830002222',
      email: `hosp_b_${Date.now()}@concur.com`,
      latitude: 22.5800,
      longitude: 88.3700,
      location: { type: 'Point', coordinates: [88.3700, 22.5800] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalB._id);

    // 5. Create Referring Doctor A
    const doctorA = await User.create({
      name: 'Dr. Concur Referring A',
      email: `doc_a_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'doctor',
      hospital: hospitalA._id,
      department: 'Emergency Medicine',
      specialization: 'Emergency Care',
      isActive: true,
    });
    createdUserIds.push(doctorA._id);
    const tokenA = generateToken(doctorA._id, doctorA.role);

    // 6. Create Receiving Doctor B
    const doctorB = await User.create({
      name: 'Dr. Concur Receiving B',
      email: `doc_b_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'doctor',
      hospital: hospitalB._id,
      department: 'Critical Care',
      specialization: 'Intensivist',
      isActive: true,
    });
    createdUserIds.push(doctorB._id);
    const tokenB = generateToken(doctorB._id, doctorB.role);

    // Fixture creation helper
    async function createReferralFixture(status = 'pending') {
      const ref = await Referral.create({
        referringHospital: hospitalA._id,
        referringUser: doctorA._id,
        receivingHospital: hospitalB._id,
        receivingDoctor: doctorB._id,
        patientName: 'Test Referral Patient ' + Date.now(),
        patientAge: 45,
        patientSex: 'Male',
        emergencyType: 'Cardiac Emergency',
        currentProblem: 'Severe chest pain radiating to left arm',
        symptoms: 'Diaphoresis, SOB',
        diagnosis: 'Acute Coronary Syndrome',
        status,
        history: [
          {
            user: doctorA._id,
            userName: doctorA.name,
            hospital: hospitalA._id,
            hospitalName: hospitalA.name,
            action: 'created',
            actionUpper: 'REFERRAL_CREATED',
            fromStatus: '',
            toStatus: status,
            notes: 'Initial referral creation',
            timestamp: new Date(),
          },
        ],
        auditTrail: [
          {
            user: doctorA._id,
            userName: doctorA.name,
            hospital: hospitalA._id,
            hospitalName: hospitalA.name,
            action: 'created',
            actionUpper: 'REFERRAL_CREATED',
            fromStatus: '',
            toStatus: status,
            notes: 'Initial referral creation',
            timestamp: new Date(),
          },
        ],
      });
      createdReferralIds.push(ref._id);
      return ref;
    }

    // =========================================================================
    // TEST 01: pending -> accepted succeeds
    // =========================================================================
    const ref01 = await createReferralFixture('pending');
    const res01 = await requestJson(`${BASE_URL}/referrals/${ref01._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ note: 'ICU bed prepared for patient' }),
    });
    const refreshed01 = await Referral.findById(ref01._id);
    record(
      1,
      'pending -> accepted transition succeeds with acceptedAt timestamp',
      res01.status === 200 &&
      refreshed01.status === 'accepted' &&
      !!refreshed01.acceptedAt,
      `status=${res01.status}, dbStatus=${refreshed01?.status}`
    );

    // =========================================================================
    // TEST 02: pending -> rejected succeeds
    // =========================================================================
    const ref02 = await createReferralFixture('pending');
    const res02 = await requestJson(`${BASE_URL}/referrals/${ref02._id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ reason: 'Cath lab currently undergoing emergency maintenance' }),
    });
    const refreshed02 = await Referral.findById(ref02._id);
    record(
      2,
      'pending -> rejected transition succeeds with rejectionReason and rejectedAt',
      res02.status === 200 &&
      refreshed02.status === 'rejected' &&
      !!refreshed02.rejectedAt &&
      refreshed02.rejectionReason.includes('Cath lab'),
      `status=${res02.status}, dbStatus=${refreshed02?.status}`
    );

    // =========================================================================
    // TEST 03: pending -> more_info_requested succeeds
    // =========================================================================
    const ref03 = await createReferralFixture('pending');
    const res03 = await requestJson(`${BASE_URL}/referrals/${ref03._id}/request-info`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ message: 'Please attach 12-lead ECG and troponin-I titer' }),
    });
    const refreshed03 = await Referral.findById(ref03._id);
    record(
      3,
      'pending -> more_info_requested transition succeeds with informationRequest note',
      res03.status === 200 &&
      refreshed03.status === 'more_info_requested' &&
      refreshed03.informationRequest.includes('12-lead ECG'),
      `status=${res03.status}, dbStatus=${refreshed03?.status}`
    );

    // =========================================================================
    // TEST 04: more_info_requested -> accepted succeeds
    // =========================================================================
    const ref04 = await createReferralFixture('more_info_requested');
    const res04 = await requestJson(`${BASE_URL}/referrals/${ref04._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ note: 'ECG reviewed, transfer approved' }),
    });
    const refreshed04 = await Referral.findById(ref04._id);
    record(
      4,
      'more_info_requested -> accepted transition succeeds',
      res04.status === 200 &&
      refreshed04.status === 'accepted' &&
      !!refreshed04.acceptedAt,
      `status=${res04.status}, dbStatus=${refreshed04?.status}`
    );

    // =========================================================================
    // TEST 05: accepted -> transferred succeeds
    // =========================================================================
    const ref05 = await createReferralFixture('accepted');
    const res05 = await requestJson(`${BASE_URL}/referrals/${ref05._id}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ note: 'Patient departed in ALS ambulance WB-02-1234' }),
    });
    const refreshed05 = await Referral.findById(ref05._id);
    record(
      5,
      'accepted -> transferred transition succeeds with transferredAt timestamp',
      res05.status === 200 &&
      refreshed05.status === 'transferred' &&
      !!refreshed05.transferredAt,
      `status=${res05.status}, dbStatus=${refreshed05?.status}`
    );

    // =========================================================================
    // TEST 06: transferred -> received succeeds
    // =========================================================================
    const ref06 = await createReferralFixture('transferred');
    const res06 = await requestJson(`${BASE_URL}/referrals/${ref06._id}/receive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ note: 'Ambulance arrived, patient admitted into ICU Bay 1' }),
    });
    const refreshed06 = await Referral.findById(ref06._id);
    record(
      6,
      'transferred -> received transition succeeds with receivedAt timestamp',
      res06.status === 200 &&
      refreshed06.status === 'received' &&
      !!refreshed06.receivedAt,
      `status=${res06.status}, dbStatus=${refreshed06?.status}`
    );

    // =========================================================================
    // TEST 07: received -> completed succeeds
    // =========================================================================
    const ref07 = await createReferralFixture('received');
    const res07 = await requestJson(`${BASE_URL}/referrals/${ref07._id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ note: 'Primary PCI successfully performed, patient stabilized' }),
    });
    const refreshed07 = await Referral.findById(ref07._id);
    record(
      7,
      'received -> completed transition succeeds with completedAt timestamp',
      res07.status === 200 &&
      refreshed07.status === 'completed' &&
      !!refreshed07.completedAt,
      `status=${res07.status}, dbStatus=${refreshed07?.status}`
    );

    // =========================================================================
    // TEST 08: accepted -> rejected is rejected (HTTP 409)
    // =========================================================================
    const ref08 = await createReferralFixture('accepted');
    const res08 = await requestJson(`${BASE_URL}/referrals/${ref08._id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ reason: 'Attempting to reject an already accepted referral' }),
    });
    const refreshed08 = await Referral.findById(ref08._id);
    record(
      8,
      'accepted -> rejected is blocked with HTTP 409 Conflict',
      res08.status === 409 && refreshed08.status === 'accepted',
      `status=${res08.status}, dbStatus=${refreshed08?.status}`
    );

    // =========================================================================
    // TEST 09: rejected -> accepted is rejected (HTTP 409)
    // =========================================================================
    const ref09 = await createReferralFixture('rejected');
    const res09 = await requestJson(`${BASE_URL}/referrals/${ref09._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ note: 'Attempting to accept a rejected referral' }),
    });
    const refreshed09 = await Referral.findById(ref09._id);
    record(
      9,
      'rejected -> accepted is blocked with HTTP 409 Conflict',
      res09.status === 409 && refreshed09.status === 'rejected',
      `status=${res09.status}, dbStatus=${refreshed09?.status}`
    );

    // =========================================================================
    // TEST 10: completed -> transferred is rejected (HTTP 409)
    // =========================================================================
    const ref10 = await createReferralFixture('completed');
    const res10 = await requestJson(`${BASE_URL}/referrals/${ref10._id}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ note: 'Attempting to transfer a completed referral' }),
    });
    const refreshed10 = await Referral.findById(ref10._id);
    record(
      10,
      'completed -> transferred is blocked with HTTP 409 Conflict',
      res10.status === 409 && refreshed10.status === 'completed',
      `status=${res10.status}, dbStatus=${refreshed10?.status}`
    );

    // =========================================================================
    // TEST 11: completed -> accepted is rejected (HTTP 409)
    // =========================================================================
    const ref11 = await createReferralFixture('completed');
    const res11 = await requestJson(`${BASE_URL}/referrals/${ref11._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ note: 'Attempting to accept a completed referral' }),
    });
    const refreshed11 = await Referral.findById(ref11._id);
    record(
      11,
      'completed -> accepted is blocked with HTTP 409 Conflict',
      res11.status === 409 && refreshed11.status === 'completed',
      `status=${res11.status}, dbStatus=${refreshed11?.status}`
    );

    // =========================================================================
    // TEST 12: completed -> rejected is rejected (HTTP 409)
    // =========================================================================
    const ref12 = await createReferralFixture('completed');
    const res12 = await requestJson(`${BASE_URL}/referrals/${ref12._id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ reason: 'Attempting to reject a completed referral' }),
    });
    const refreshed12 = await Referral.findById(ref12._id);
    record(
      12,
      'completed -> rejected is blocked with HTTP 409 Conflict',
      res12.status === 409 && refreshed12.status === 'completed',
      `status=${res12.status}, dbStatus=${refreshed12?.status}`
    );

    // =========================================================================
    // TEST 13: Two concurrent accept operations: exactly one succeeds
    // =========================================================================
    const ref13 = await createReferralFixture('pending');
    const [res13A, res13B] = await Promise.all([
      requestJson(`${BASE_URL}/referrals/${ref13._id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent accept A' }),
      }),
      requestJson(`${BASE_URL}/referrals/${ref13._id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent accept B' }),
      }),
    ]);
    const refreshed13 = await Referral.findById(ref13._id);
    const statuses13 = [res13A.status, res13B.status].sort();
    const exactlyOne13 = statuses13[0] === 200 && statuses13[1] === 409;
    record(
      13,
      'Two concurrent accepts: exactly one succeeds (200 & 409)',
      exactlyOne13 && refreshed13.status === 'accepted',
      `statuses=${statuses13.join(',')}, dbStatus=${refreshed13?.status}`
    );

    // =========================================================================
    // TEST 14: Accept + Reject concurrently: exactly one valid transition succeeds
    // =========================================================================
    const ref14 = await createReferralFixture('pending');
    const [res14Accept, res14Reject] = await Promise.all([
      requestJson(`${BASE_URL}/referrals/${ref14._id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent accept' }),
      }),
      requestJson(`${BASE_URL}/referrals/${ref14._id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ reason: 'Concurrent reject' }),
      }),
    ]);
    const refreshed14 = await Referral.findById(ref14._id);
    const statuses14 = [res14Accept.status, res14Reject.status].sort();
    const exactlyOne14 = statuses14[0] === 200 && statuses14[1] === 409;
    const finalValid14 = refreshed14.status === 'accepted' || refreshed14.status === 'rejected';
    record(
      14,
      'Concurrent accept vs reject: exactly one valid transition succeeds (200 & 409)',
      exactlyOne14 && finalValid14,
      `statuses=${statuses14.join(',')}, winner=${refreshed14?.status}`
    );

    // =========================================================================
    // TEST 15: Two concurrent transfer operations: exactly one succeeds
    // =========================================================================
    const ref15 = await createReferralFixture('accepted');
    const [res15A, res15B] = await Promise.all([
      requestJson(`${BASE_URL}/referrals/${ref15._id}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ note: 'Concurrent transfer A' }),
      }),
      requestJson(`${BASE_URL}/referrals/${ref15._id}/transfer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ note: 'Concurrent transfer B' }),
      }),
    ]);
    const refreshed15 = await Referral.findById(ref15._id);
    const statuses15 = [res15A.status, res15B.status].sort();
    const exactlyOne15 = statuses15[0] === 200 && statuses15[1] === 409;
    record(
      15,
      'Two concurrent transfers: exactly one succeeds (200 & 409)',
      exactlyOne15 && refreshed15.status === 'transferred',
      `statuses=${statuses15.join(',')}, dbStatus=${refreshed15?.status}`
    );

    // =========================================================================
    // TEST 16: Two concurrent receive operations: exactly one succeeds
    // =========================================================================
    const ref16 = await createReferralFixture('transferred');
    const [res16A, res16B] = await Promise.all([
      requestJson(`${BASE_URL}/referrals/${ref16._id}/receive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent receive A' }),
      }),
      requestJson(`${BASE_URL}/referrals/${ref16._id}/receive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent receive B' }),
      }),
    ]);
    const refreshed16 = await Referral.findById(ref16._id);
    const statuses16 = [res16A.status, res16B.status].sort();
    const exactlyOne16 = statuses16[0] === 200 && statuses16[1] === 409;
    record(
      16,
      'Two concurrent receives: exactly one succeeds (200 & 409)',
      exactlyOne16 && refreshed16.status === 'received',
      `statuses=${statuses16.join(',')}, dbStatus=${refreshed16?.status}`
    );

    // =========================================================================
    // TEST 17: Two concurrent complete operations: exactly one succeeds
    // =========================================================================
    const ref17 = await createReferralFixture('received');
    const [res17A, res17B] = await Promise.all([
      requestJson(`${BASE_URL}/referrals/${ref17._id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent complete A' }),
      }),
      requestJson(`${BASE_URL}/referrals/${ref17._id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ note: 'Concurrent complete B' }),
      }),
    ]);
    const refreshed17 = await Referral.findById(ref17._id);
    const statuses17 = [res17A.status, res17B.status].sort();
    const exactlyOne17 = statuses17[0] === 200 && statuses17[1] === 409;
    record(
      17,
      'Two concurrent completes: exactly one succeeds (200 & 409)',
      exactlyOne17 && refreshed17.status === 'completed',
      `statuses=${statuses17.join(',')}, dbStatus=${refreshed17?.status}`
    );

    // =========================================================================
    // TEST 18: Audit trail integrity under concurrency: losing operation produces 0 duplicate audit events
    // =========================================================================
    // In Test 13, two concurrent accepts ran against ref13. Initial auditTrail length was 1.
    // Winning accept pushed exactly 1 audit entry. Final auditTrail length must be exactly 2.
    const auditLength13 = refreshed13.auditTrail.length;
    const acceptEntries = refreshed13.auditTrail.filter(a => a.action === 'accepted');
    record(
      18,
      'Audit trail integrity: losing concurrent operation produces zero duplicate audit entries',
      auditLength13 === 2 && acceptEntries.length === 1,
      `totalEntries=${auditLength13}, acceptEntries=${acceptEntries.length}`
    );

    // =========================================================================
    // TEST 19: Guaranteed database cleanup in finally
    // =========================================================================
    // Checked in finally block
  } catch (err) {
    console.error('Unexpected error in Concur01C test runner:', err);
    failed++;
  } finally {
    console.log('\n--- CLEANING UP TEST FIXTURES ---');

    let cleanupErrors = 0;
    try {
      if (createdReferralIds.length > 0) {
        const res = await Referral.deleteMany({ _id: { $in: createdReferralIds } });
        console.log(`  Cleaned up ${res.deletedCount} test Referrals`);
      }
      if (createdUserIds.length > 0) {
        const res = await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`  Cleaned up ${res.deletedCount} test Users`);
      }
      if (createdHospitalIds.length > 0) {
        const res = await Hospital.deleteMany({ _id: { $in: createdHospitalIds } });
        console.log(`  Cleaned up ${res.deletedCount} test Hospitals`);
      }
    } catch (cleanErr) {
      console.error('Error during cleanup:', cleanErr);
      cleanupErrors++;
    }

    // Verify 0 orphan records remain
    const remainingHospitals = await Hospital.countDocuments({ _id: { $in: createdHospitalIds } });
    const remainingUsers = await User.countDocuments({ _id: { $in: createdUserIds } });
    const remainingReferrals = await Referral.countDocuments({ _id: { $in: createdReferralIds } });

    const cleanupSuccess = cleanupErrors === 0 &&
      remainingHospitals === 0 &&
      remainingUsers === 0 &&
      remainingReferrals === 0;

    record(
      19,
      'Guaranteed test cleanup: all created test records deleted leaving 0 orphan records',
      cleanupSuccess,
      `cleanupErrors=${cleanupErrors}, remHosp=${remainingHospitals}, remUsers=${remainingUsers}, remRef=${remainingReferrals}`
    );

    if (testServer) {
      if (typeof testServer.closeAllConnections === 'function') {
        testServer.closeAllConnections();
      }
      await new Promise(resolve => testServer.close(resolve));
      console.log('  Closed HTTP test server.');
    }
    await mongoose.disconnect();
    console.log('  Mongoose disconnected.');

    console.log('\n====================================================');
    console.log(`SEC3-CONCUR-01C TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  runConcur01CTests()
    .then(() => {
      console.log('SEC3-CONCUR-01C suite completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}

module.exports = runConcur01CTests;
