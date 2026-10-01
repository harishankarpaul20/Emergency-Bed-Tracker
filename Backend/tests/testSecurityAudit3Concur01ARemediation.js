/**
 * testSecurityAudit3Concur01ARemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01A:
 * Bed Request Approval / Rejection / Cancellation TOCTOU Remediation
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
const Bed = require('../models/Bed');
const BedRequest = require('../models/BedRequest');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const TEST_PORT = 5012;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  return { status: res.status, headers: res.headers, body };
}

async function runConcur01ATests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01A REMEDIATION VERIFICATION SUITE');
  console.log('Bed Request Approval / Rejection / Cancellation TOCTOU');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(id, title, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] Test ${id.toString().padStart(2, '0')}: ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${id.toString().padStart(2, '0')}: ${title} - ${details}`);
      failed++;
    }
  }

  let testServer;

  // Cleanup tracking arrays
  const createdHospitalIds = [];
  const createdBedIds = [];
  const createdUserIds = [];
  const createdBedRequestIds = [];

  try {
    // 1. Connect DB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // 2. Start HTTP Test Server
    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, () => resolve());
      testServer.on('error', reject);
    });

    // 3. Create Super Admin User fixture for test authorization
    const adminUser = await User.create({
      name: 'Audit Super Admin',
      email: `audit_super_admin_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'super_admin',
      isVerified: true,
      isActive: true,
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id, adminUser.role);

    // 4. Create Standard Citizen User fixture
    const citizenUser = await User.create({
      name: 'Audit Citizen User',
      email: `audit_citizen_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'user',
      isVerified: true,
      isActive: true,
    });
    createdUserIds.push(citizenUser._id);
    const citizenToken = generateToken(citizenUser._id, citizenUser.role);

    // 5. Create Test Hospital fixture
    const testHospital = await Hospital.create({
      name: 'Concur Test Hospital ' + Date.now(),
      registrationId: 'WB-CONCUR-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '100 Medical Street',
      area: 'Kolkata Central',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      phone: '9830000001',
      email: `hosp_${Date.now()}@concur.test`,
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(testHospital._id);

    // 6. Create Test Bed inventory fixture (10 total, 0 occupied, 5 reserved, 5 available)
    const testBed = await Bed.create({
      hospital: testHospital._id,
      type: 'icu',
      totalBeds: 10,
      occupiedBeds: 0,
      reservedBeds: 5,
      availableBeds: 5,
      isActive: true,
    });
    createdBedIds.push(testBed._id);

    console.log('[SECTION 1] SEQUENTIAL STATE TRANSITION & GUARDS (TESTS 01-13)');

    // Helper to create a test BedRequest
    async function createFixtureRequest(status = 'pending') {
      const br = await BedRequest.create({
        user: citizenUser._id,
        hospital: testHospital._id,
        bed: testBed._id,
        bedType: 'icu',
        patientName: 'Test Patient ' + Math.random().toString(36).substring(7),
        contactPhone: '9830099999',
        status,
        ...(status === 'approved' && { approvedAt: new Date() }),
        ...(status === 'rejected' && { rejectedAt: new Date() }),
        ...(status === 'cancelled' && { cancelledAt: new Date() }),
        ...(status === 'completed' && { completedAt: new Date() }),
      });
      createdBedRequestIds.push(br._id);
      return br;
    }

    // TEST 01: Normal pending -> approved succeeds
    const req1 = await createFixtureRequest('pending');
    const res01 = await requestJson(`${BASE_URL}/bed-requests/${req1._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dbReq1 = await BedRequest.findById(req1._id);
    record(1, 'Normal pending -> approved succeeds with HTTP 200',
      res01.status === 200 && dbReq1.status === 'approved' && dbReq1.approvedAt != null,
      `status=${res01.status}, dbStatus=${dbReq1?.status}`);

    // TEST 02: Normal pending -> rejected succeeds
    const req2 = await createFixtureRequest('pending');
    const res02 = await requestJson(`${BASE_URL}/bed-requests/${req2._id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dbReq2 = await BedRequest.findById(req2._id);
    record(2, 'Normal pending -> rejected succeeds with HTTP 200',
      res02.status === 200 && dbReq2.status === 'rejected' && dbReq2.rejectedAt != null,
      `status=${res02.status}, dbStatus=${dbReq2?.status}`);

    // TEST 03: Normal pending -> cancelled succeeds
    const req3 = await createFixtureRequest('pending');
    const res03 = await requestJson(`${BASE_URL}/bed-requests/${req3._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    const dbReq3 = await BedRequest.findById(req3._id);
    record(3, 'Normal pending -> cancelled succeeds with HTTP 200',
      res03.status === 200 && dbReq3.status === 'cancelled' && dbReq3.cancelledAt != null,
      `status=${res03.status}, dbStatus=${dbReq3?.status}`);

    // TEST 04: Normal approved -> completed succeeds
    const req4 = await createFixtureRequest('approved');
    // Ensure occupiedBeds has at least 1 bed for complete
    await Bed.findByIdAndUpdate(testBed._id, { $set: { occupiedBeds: 2, reservedBeds: 3, availableBeds: 5 } });
    const res04 = await requestJson(`${BASE_URL}/bed-requests/${req4._id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dbReq4 = await BedRequest.findById(req4._id);
    record(4, 'Normal approved -> completed succeeds with HTTP 200',
      res04.status === 200 && dbReq4.status === 'completed' && dbReq4.completedAt != null,
      `status=${res04.status}, dbStatus=${dbReq4?.status}`);

    // TEST 05: Second approval of already-approved request fails
    const res05 = await requestJson(`${BASE_URL}/bed-requests/${req1._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(5, 'Second approval of already-approved request fails with HTTP 400',
      res05.status === 400 && res05.body?.success === false,
      `status=${res05.status}, message=${res05.body?.message}`);

    // TEST 06: Second rejection of already-rejected request fails
    const res06 = await requestJson(`${BASE_URL}/bed-requests/${req2._id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(6, 'Second rejection of already-rejected request fails with HTTP 400',
      res06.status === 400 && res06.body?.success === false,
      `status=${res06.status}, message=${res06.body?.message}`);

    // TEST 07: Second cancellation of already-cancelled request fails
    const res07 = await requestJson(`${BASE_URL}/bed-requests/${req3._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    record(7, 'Second cancellation of already-cancelled request fails with HTTP 400',
      res07.status === 400 && res07.body?.success === false,
      `status=${res07.status}, message=${res07.body?.message}`);

    // TEST 08: Second completion of already-completed request fails
    const res08 = await requestJson(`${BASE_URL}/bed-requests/${req4._id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(8, 'Second completion of already-completed request fails with HTTP 400',
      res08.status === 400 && res08.body?.success === false,
      `status=${res08.status}, message=${res08.body?.message}`);

    // TEST 09: Approved request cannot subsequently be cancelled
    const res09 = await requestJson(`${BASE_URL}/bed-requests/${req1._id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(9, 'Approved request cannot subsequently be cancelled (HTTP 400)',
      res09.status === 400 && res09.body?.success === false,
      `status=${res09.status}, message=${res09.body?.message}`);

    // TEST 10: Approved request cannot subsequently be rejected
    const res10 = await requestJson(`${BASE_URL}/bed-requests/${req1._id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(10, 'Approved request cannot subsequently be rejected (HTTP 400)',
      res10.status === 400 && res10.body?.success === false,
      `status=${res10.status}, message=${res10.body?.message}`);

    // TEST 11: Rejected request cannot subsequently be approved
    const res11 = await requestJson(`${BASE_URL}/bed-requests/${req2._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(11, 'Rejected request cannot subsequently be approved (HTTP 400)',
      res11.status === 400 && res11.body?.success === false,
      `status=${res11.status}, message=${res11.body?.message}`);

    // TEST 12: Cancelled request cannot subsequently be approved
    const res12 = await requestJson(`${BASE_URL}/bed-requests/${req3._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(12, 'Cancelled request cannot subsequently be approved (HTTP 400)',
      res12.status === 400 && res12.body?.success === false,
      `status=${res12.status}, message=${res12.body?.message}`);

    // TEST 13: Completed request cannot subsequently be approved
    const res13 = await requestJson(`${BASE_URL}/bed-requests/${req4._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(13, 'Completed request cannot subsequently be approved (HTTP 400)',
      res13.status === 400 && res13.body?.success === false,
      `status=${res13.status}, message=${res13.body?.message}`);

    console.log('\n[SECTION 2] CONCURRENT RACE CONDITIONS & BED INTEGRITY (CASES A-E)');

    // CASE A: Two simultaneous approvals
    await Bed.findByIdAndUpdate(testBed._id, { $set: { totalBeds: 10, occupiedBeds: 2, reservedBeds: 3, availableBeds: 5 } });
    const bedBeforeA = await Bed.findById(testBed._id).lean();
    const reqA = await createFixtureRequest('pending');

    const [resA1, resA2] = await Promise.all([
      requestJson(`${BASE_URL}/bed-requests/${reqA._id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      requestJson(`${BASE_URL}/bed-requests/${reqA._id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);

    const bedAfterA = await Bed.findById(testBed._id).lean();
    const aStatuses = [resA1.status, resA2.status].sort();
    const isCaseA_StatusOk = aStatuses[0] === 200 && aStatuses[1] === 400;
    const isCaseA_BedOk =
      bedAfterA.reservedBeds === bedBeforeA.reservedBeds - 1 &&
      bedAfterA.occupiedBeds === bedBeforeA.occupiedBeds + 1 &&
      bedAfterA.availableBeds === bedBeforeA.availableBeds;

    record(14, 'CASE A: Exactly ONE of two simultaneous approvals succeeds (200 & 400)',
      isCaseA_StatusOk, `Statuses: ${resA1.status}, ${resA2.status}`);
    record(15, 'CASE A: Bed counter incremented occupied and decremented reserved EXACTLY once',
      isCaseA_BedOk,
      `Before: res=${bedBeforeA.reservedBeds},occ=${bedBeforeA.occupiedBeds} | After: res=${bedAfterA.reservedBeds},occ=${bedAfterA.occupiedBeds}`);

    // CASE B: Simultaneous approval + cancellation
    await Bed.findByIdAndUpdate(testBed._id, { $set: { totalBeds: 10, occupiedBeds: 2, reservedBeds: 3, availableBeds: 5 } });
    const bedBeforeB = await Bed.findById(testBed._id).lean();
    const reqB = await createFixtureRequest('pending');

    const [resB_Approve, resB_Cancel] = await Promise.all([
      requestJson(`${BASE_URL}/bed-requests/${reqB._id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      requestJson(`${BASE_URL}/bed-requests/${reqB._id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${citizenToken}` },
      }),
    ]);

    const bedAfterB = await Bed.findById(testBed._id).lean();
    const bStatuses = [resB_Approve.status, resB_Cancel.status].sort();
    const isCaseB_StatusOk = bStatuses[0] === 200 && bStatuses[1] === 400;
    const approveWonB = resB_Approve.status === 200;
    const isCaseB_BedOk = approveWonB
      ? (bedAfterB.reservedBeds === bedBeforeB.reservedBeds - 1 && bedAfterB.occupiedBeds === bedBeforeB.occupiedBeds + 1 && bedAfterB.availableBeds === bedBeforeB.availableBeds)
      : (bedAfterB.reservedBeds === bedBeforeB.reservedBeds - 1 && bedAfterB.availableBeds === bedBeforeB.availableBeds + 1 && bedAfterB.occupiedBeds === bedBeforeB.occupiedBeds);

    record(16, 'CASE B: Exactly ONE of simultaneous approve vs cancel succeeds (200 & 400)',
      isCaseB_StatusOk, `Approve: ${resB_Approve.status}, Cancel: ${resB_Cancel.status}`);
    record(17, 'CASE B: Bed counters reflect ONLY winning operation (no dual mutation)',
      isCaseB_BedOk,
      `Winner: ${approveWonB ? 'Approve' : 'Cancel'}, Before: res=${bedBeforeB.reservedBeds},occ=${bedBeforeB.occupiedBeds},avail=${bedBeforeB.availableBeds} | After: res=${bedAfterB.reservedBeds},occ=${bedAfterB.occupiedBeds},avail=${bedAfterB.availableBeds}`);

    // CASE C: Simultaneous approval + rejection
    await Bed.findByIdAndUpdate(testBed._id, { $set: { totalBeds: 10, occupiedBeds: 2, reservedBeds: 3, availableBeds: 5 } });
    const bedBeforeC = await Bed.findById(testBed._id).lean();
    const reqC = await createFixtureRequest('pending');

    const [resC_Approve, resC_Reject] = await Promise.all([
      requestJson(`${BASE_URL}/bed-requests/${reqC._id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      requestJson(`${BASE_URL}/bed-requests/${reqC._id}/reject`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);

    const bedAfterC = await Bed.findById(testBed._id).lean();
    const cStatuses = [resC_Approve.status, resC_Reject.status].sort();
    const isCaseC_StatusOk = cStatuses[0] === 200 && cStatuses[1] === 400;
    const approveWonC = resC_Approve.status === 200;
    const isCaseC_BedOk = approveWonC
      ? (bedAfterC.reservedBeds === bedBeforeC.reservedBeds - 1 && bedAfterC.occupiedBeds === bedBeforeC.occupiedBeds + 1 && bedAfterC.availableBeds === bedBeforeC.availableBeds)
      : (bedAfterC.reservedBeds === bedBeforeC.reservedBeds - 1 && bedAfterC.availableBeds === bedBeforeC.availableBeds + 1 && bedAfterC.occupiedBeds === bedBeforeC.occupiedBeds);

    record(18, 'CASE C: Exactly ONE of simultaneous approve vs reject succeeds (200 & 400)',
      isCaseC_StatusOk, `Approve: ${resC_Approve.status}, Reject: ${resC_Reject.status}`);
    record(19, 'CASE C: Bed counters reflect ONLY winning operation',
      isCaseC_BedOk,
      `Winner: ${approveWonC ? 'Approve' : 'Reject'}, Before: res=${bedBeforeC.reservedBeds},occ=${bedBeforeC.occupiedBeds},avail=${bedBeforeC.availableBeds} | After: res=${bedAfterC.reservedBeds},occ=${bedAfterC.occupiedBeds},avail=${bedAfterC.availableBeds}`);

    // CASE D: Two simultaneous completions
    await Bed.findByIdAndUpdate(testBed._id, { $set: { totalBeds: 10, occupiedBeds: 3, reservedBeds: 2, availableBeds: 5 } });
    const bedBeforeD = await Bed.findById(testBed._id).lean();
    const reqD = await createFixtureRequest('approved');

    const [resD1, resD2] = await Promise.all([
      requestJson(`${BASE_URL}/bed-requests/${reqD._id}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      requestJson(`${BASE_URL}/bed-requests/${reqD._id}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    ]);

    const bedAfterD = await Bed.findById(testBed._id).lean();
    const dStatuses = [resD1.status, resD2.status].sort();
    const isCaseD_StatusOk = dStatuses[0] === 200 && dStatuses[1] === 400;
    const isCaseD_BedOk =
      bedAfterD.occupiedBeds === bedBeforeD.occupiedBeds - 1 &&
      bedAfterD.availableBeds === bedBeforeD.availableBeds + 1 &&
      bedAfterD.reservedBeds === bedBeforeD.reservedBeds;

    record(20, 'CASE D: Exactly ONE of two simultaneous completions succeeds (200 & 400)',
      isCaseD_StatusOk, `Statuses: ${resD1.status}, ${resD2.status}`);
    record(21, 'CASE D: Bed counters decremented occupied and incremented available EXACTLY once',
      isCaseD_BedOk,
      `Before: occ=${bedBeforeD.occupiedBeds},avail=${bedBeforeD.availableBeds} | After: occ=${bedAfterD.occupiedBeds},avail=${bedAfterD.availableBeds}`);

    // CASE E: Three simultaneous operations: approve + reject + cancel
    await Bed.findByIdAndUpdate(testBed._id, { $set: { totalBeds: 10, occupiedBeds: 2, reservedBeds: 3, availableBeds: 5 } });
    const bedBeforeE = await Bed.findById(testBed._id).lean();
    const reqE = await createFixtureRequest('pending');

    const [resE_Approve, resE_Reject, resE_Cancel] = await Promise.all([
      requestJson(`${BASE_URL}/bed-requests/${reqE._id}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      requestJson(`${BASE_URL}/bed-requests/${reqE._id}/reject`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
      requestJson(`${BASE_URL}/bed-requests/${reqE._id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${citizenToken}` },
      }),
    ]);

    const bedAfterE = await Bed.findById(testBed._id).lean();
    const eStatuses = [resE_Approve.status, resE_Reject.status, resE_Cancel.status].sort();
    const isCaseE_StatusOk = eStatuses[0] === 200 && eStatuses[1] === 400 && eStatuses[2] === 400;

    let singleBedTransitionOccurred = false;
    if (resE_Approve.status === 200) {
      singleBedTransitionOccurred =
        bedAfterE.reservedBeds === bedBeforeE.reservedBeds - 1 &&
        bedAfterE.occupiedBeds === bedBeforeE.occupiedBeds + 1 &&
        bedAfterE.availableBeds === bedBeforeE.availableBeds;
    } else {
      singleBedTransitionOccurred =
        bedAfterE.reservedBeds === bedBeforeE.reservedBeds - 1 &&
        bedAfterE.availableBeds === bedBeforeE.availableBeds + 1 &&
        bedAfterE.occupiedBeds === bedBeforeE.occupiedBeds;
    }

    record(22, 'CASE E: Exactly ONE of three simultaneous operations succeeds (200, 400, 400)',
      isCaseE_StatusOk,
      `Approve: ${resE_Approve.status}, Reject: ${resE_Reject.status}, Cancel: ${resE_Cancel.status}`);
    record(23, 'CASE E: Bed counters reflect exactly one mutation without corruption',
      singleBedTransitionOccurred,
      `Winner: ${resE_Approve.status === 200 ? 'Approve' : (resE_Reject.status === 200 ? 'Reject' : 'Cancel')}`);

    // TEST 24: Non-negative bed counts invariant verified across all tests
    const finalBed = await Bed.findById(testBed._id).lean();
    const invariantSatisfied =
      finalBed.totalBeds >= 0 &&
      finalBed.occupiedBeds >= 0 &&
      finalBed.reservedBeds >= 0 &&
      finalBed.availableBeds >= 0 &&
      (finalBed.occupiedBeds + finalBed.reservedBeds + finalBed.availableBeds === finalBed.totalBeds);

    record(24, 'Bed Counter Invariant: occupied, reserved, available >= 0 and sum equals totalBeds',
      invariantSatisfied,
      `total=${finalBed.totalBeds}, occ=${finalBed.occupiedBeds}, res=${finalBed.reservedBeds}, avail=${finalBed.availableBeds}`);

    // TEST 25: Rollback on null bed update (Simulated bed failure)
    // Create request pointing to non-existent bed ID to force null updateBed
    const fakeBedId = new mongoose.Types.ObjectId();
    const reqNull = await BedRequest.create({
      user: citizenUser._id,
      hospital: testHospital._id,
      bed: fakeBedId,
      bedType: 'icu',
      patientName: 'Rollback Test Patient',
      contactPhone: '9830099999',
      status: 'pending',
    });
    createdBedRequestIds.push(reqNull._id);

    const resNullApprove = await requestJson(`${BASE_URL}/bed-requests/${reqNull._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dbReqNullAfter = await BedRequest.findById(reqNull._id);

    record(25, 'Failed bed update safely returns HTTP 409 and rolls back BedRequest to pending',
      resNullApprove.status === 409 && dbReqNullAfter.status === 'pending' && dbReqNullAfter.approvedAt == null,
      `status=${resNullApprove.status}, dbStatus=${dbReqNullAfter?.status}`);

  } catch (error) {
    console.error('❌ Exception during SEC3-CONCUR-01A verification:', error);
    failed++;
  } finally {
    // Guaranteed Database Cleanup
    console.log('\n[CLEANUP] Removing isolated test records from MongoDB Atlas...');
    if (createdBedRequestIds.length) {
      await BedRequest.deleteMany({ _id: { $in: createdBedRequestIds } });
    }
    if (createdBedIds.length) {
      await Bed.deleteMany({ _id: { $in: createdBedIds } });
    }
    if (createdHospitalIds.length) {
      await Hospital.deleteMany({ _id: { $in: createdHospitalIds } });
    }
    if (createdUserIds.length) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await mongoose.disconnect();
    console.log('✅ Cleanup complete. Server closed.');
  }

  console.log('\n====================================================');
  console.log(`SEC3-CONCUR-01A RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runConcur01ATests();
