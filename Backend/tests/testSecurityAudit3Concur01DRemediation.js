/**
 * testSecurityAudit3Concur01DRemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01D:
 * Multi-Document Non-Atomic Allocation / Transaction Consistency
 */

process.env.NODE_PATH = 'C:\\Users\\Win11\\.gemini\\antigravity\\brain\\178cda03-21e7-4a93-a1c1-214518e97061\\scratch\\clean_modules\\node_modules';
require('module').Module._initPaths();

require('../config/bootstrap');
const http = require('http');
const path = require('path');
const mongoose = require('C:/Users/Win11/.gemini/antigravity/brain/178cda03-21e7-4a93-a1c1-214518e97061/scratch/clean_modules/node_modules/mongoose');

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

const TEST_PORT = 5015;
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

async function runConcur01DTests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01D REMEDIATION VERIFICATION SUITE');
  console.log('Multi-Document Non-Atomic Allocation / Transaction Consistency');
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

    // 3. Create Hospital Fixtures
    const testHospital = await Hospital.create({
      name: 'Transaction Audit Hospital A',
      registrationId: `WB-HOSP-01D-${Date.now()}`,
      district: 'Kolkata',
      area: 'Salt Lake',
      address: 'Sector V, Salt Lake, Kolkata',
      phone: '03323330001',
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(testHospital._id);

    const otherHospital = await Hospital.create({
      name: 'Transaction Audit Hospital B',
      registrationId: `WB-HOSP-01D-B-${Date.now()}`,
      district: 'Kolkata',
      area: 'New Town',
      address: 'Action Area I, New Town, Kolkata',
      phone: '03323330002',
      latitude: 22.5852,
      longitude: 88.4061,
      location: { type: 'Point', coordinates: [88.4061, 22.5852] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(otherHospital._id);

    // 4. Create Bed Fixture (5 available, 0 reserved, 5 occupied, total 10)
    const testBed = await Bed.create({
      hospital: testHospital._id,
      type: 'icu',
      totalBeds: 10,
      occupiedBeds: 5,
      reservedBeds: 0,
      availableBeds: 5,
      isActive: true,
    });
    createdBedIds.push(testBed._id);

    // 5. Create Users
    const adminUser = await User.create({
      name: 'Admin User 01D',
      email: `admin_01d_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospitalId: testHospital._id,
      isVerified: true,
      isActive: true,
    });
    createdUserIds.push(adminUser._id);
    const adminToken = generateToken(adminUser._id, adminUser.role);

    const otherAdmin = await User.create({
      name: 'Other Admin 01D',
      email: `other_admin_01d_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospitalId: otherHospital._id,
      isVerified: true,
      isActive: true,
    });
    createdUserIds.push(otherAdmin._id);
    const otherAdminToken = generateToken(otherAdmin._id, otherAdmin.role);

    const citizenUser = await User.create({
      name: 'Citizen User 01D',
      email: `citizen_01d_${Date.now()}@concur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'user',
      isVerified: true,
      isActive: true,
    });
    createdUserIds.push(citizenUser._id);
    const citizenToken = generateToken(citizenUser._id, citizenUser.role);

    // =========================================================================
    // TEST 01: Successful Baseline Operation
    // =========================================================================
    const res01 = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        hospitalId: testHospital._id.toString(),
        bedType: 'icu',
        patientName: 'Baseline Patient 01',
        contactPhone: '9830011111',
        notes: 'Baseline reservation test',
      }),
    });

    if (res01.body?.data?._id) createdBedRequestIds.push(res01.body.data._id);

    const bedAfter01 = await Bed.findById(testBed._id);
    record(1, 'Successful baseline operation commits both Bed and BedRequest within transaction',
      res01.status === 201 &&
      bedAfter01.availableBeds === 4 &&
      bedAfter01.reservedBeds === 1 &&
      res01.body?.data?.status === 'pending',
      `status=${res01.status}, avail=${bedAfter01.availableBeds}, res=${bedAfter01.reservedBeds}`
    );

    // =========================================================================
    // TEST 02: Force Failure After First Mutation (BedRequest.create failure)
    // =========================================================================
    const preBed02 = await Bed.findById(testBed._id);
    const originalBedRequestCreate = BedRequest.create;

    // Controlled failure injection: Bed.findOneAndUpdate succeeds, then BedRequest.create throws
    BedRequest.create = async function () {
      throw new Error('INJECTED_FAILURE_AFTER_BED_UPDATE');
    };

    const res02 = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        hospitalId: testHospital._id.toString(),
        bedType: 'icu',
        patientName: 'Rollback Patient 02',
        contactPhone: '9830022222',
        notes: 'Should be rolled back',
      }),
    });

    // Restore immediately
    BedRequest.create = originalBedRequestCreate;

    const postBed02 = await Bed.findById(testBed._id);
    record(2, 'Forced failure after first mutation: Bed update is completely rolled back',
      res02.status === 500 &&
      postBed02.availableBeds === preBed02.availableBeds &&
      postBed02.reservedBeds === preBed02.reservedBeds,
      `resStatus=${res02.status}, availBefore=${preBed02.availableBeds}, availAfter=${postBed02.availableBeds}`
    );

    // =========================================================================
    // TEST 03: Force Failure After Second Database Mutation (in approveRequest)
    // =========================================================================
    // First create a legitimate pending request to approve
    const resSetup03 = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        hospitalId: testHospital._id.toString(),
        bedType: 'icu',
        patientName: 'Approve Rollback Patient 03',
        contactPhone: '9830033333',
        notes: 'Approve rollback test',
      }),
    });
    if (resSetup03.body?.data?._id) createdBedRequestIds.push(resSetup03.body.data._id);
    const req03Id = resSetup03.body.data._id;

    const preApproveBed = await Bed.findById(testBed._id);
    const preApproveReq = await BedRequest.findById(req03Id);

    // Inject failure during Bed update inside approve transaction
    const originalBedFindOneAndUpdate = Bed.findOneAndUpdate;
    let bedUpdateCallCount = 0;
    Bed.findOneAndUpdate = async function (...args) {
      bedUpdateCallCount++;
      if (bedUpdateCallCount === 1) {
        throw new Error('INJECTED_FAILURE_DURING_BED_ALLOCATION');
      }
      return originalBedFindOneAndUpdate.apply(this, args);
    };

    const res03 = await requestJson(`${BASE_URL}/bed-requests/${req03Id}/approve`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    // Restore immediately
    Bed.findOneAndUpdate = originalBedFindOneAndUpdate;

    const postApproveBed = await Bed.findById(testBed._id);
    const postApproveReq = await BedRequest.findById(req03Id);

    record(3, 'Forced failure in approveRequest: BedRequest status update is rolled back to pending',
      res03.status === 500 &&
      postApproveReq.status === 'pending' &&
      postApproveReq.approvedAt == null &&
      postApproveBed.occupiedBeds === preApproveBed.occupiedBeds &&
      postApproveBed.reservedBeds === preApproveBed.reservedBeds,
      `resStatus=${res03.status}, reqStatus=${postApproveReq.status}, occupied=${postApproveBed.occupiedBeds}`
    );

    // =========================================================================
    // TEST 04: Force Failure at Final Database Operation (in completeRequest)
    // =========================================================================
    // Legitimately approve req03 now that injection is gone
    await requestJson(`${BASE_URL}/bed-requests/${req03Id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const preCompleteBed = await Bed.findById(testBed._id);
    const preCompleteReq = await BedRequest.findById(req03Id);

    let completeBedCallCount = 0;
    Bed.findOneAndUpdate = async function (...args) {
      completeBedCallCount++;
      if (completeBedCallCount === 1) {
        throw new Error('INJECTED_FAILURE_DURING_COMPLETE_BED_RELEASE');
      }
      return originalBedFindOneAndUpdate.apply(this, args);
    };

    const res04 = await requestJson(`${BASE_URL}/bed-requests/${req03Id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Restore immediately
    Bed.findOneAndUpdate = originalBedFindOneAndUpdate;

    const postCompleteBed = await Bed.findById(testBed._id);
    const postCompleteReq = await BedRequest.findById(req03Id);

    record(4, 'Forced failure in completeRequest: BedRequest remains approved without partial discharge',
      res04.status === 500 &&
      postCompleteReq.status === 'approved' &&
      postCompleteBed.occupiedBeds === preCompleteBed.occupiedBeds &&
      postCompleteBed.availableBeds === preCompleteBed.availableBeds,
      `resStatus=${res04.status}, reqStatus=${postCompleteReq.status}, occupied=${postCompleteBed.occupiedBeds}`
    );

    // =========================================================================
    // TEST 05: Resource Counters Invariant After Rollbacks
    // =========================================================================
    const currentBed05 = await Bed.findById(testBed._id);
    const countersValid05 =
      currentBed05.occupiedBeds >= 0 &&
      currentBed05.reservedBeds >= 0 &&
      currentBed05.availableBeds >= 0 &&
      (currentBed05.occupiedBeds + currentBed05.reservedBeds + currentBed05.availableBeds === currentBed05.totalBeds);

    record(5, 'Resource counters remain consistent and satisfy totalBeds invariant after rollbacks',
      countersValid05,
      `total=${currentBed05.totalBeds}, occ=${currentBed05.occupiedBeds}, res=${currentBed05.reservedBeds}, avail=${currentBed05.availableBeds}`
    );

    // =========================================================================
    // TEST 06: Request Allocation State Integrity
    // =========================================================================
    const req03State = await BedRequest.findById(req03Id);
    record(6, 'Request allocation state reflects valid non-corrupted status (approved)',
      req03State.status === 'approved' && req03State.approvedAt != null,
      `status=${req03State.status}`
    );

    // =========================================================================
    // TEST 07: No Orphan Records Created During Failed Operation
    // =========================================================================
    const orphanCount = await BedRequest.countDocuments({
      patientName: 'Rollback Patient 02',
    });
    record(7, 'Zero orphan documents created by aborted transaction',
      orphanCount === 0,
      `orphanCount=${orphanCount}`
    );

    // =========================================================================
    // TEST 08: Retry the Same Operation After Forced Failure
    // =========================================================================
    const res08 = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({
        hospitalId: testHospital._id.toString(),
        bedType: 'icu',
        patientName: 'Retry Patient 08',
        contactPhone: '9830088888',
        notes: 'Retry after failure test',
      }),
    });

    if (res08.body?.data?._id) createdBedRequestIds.push(res08.body.data._id);

    const bedAfter08 = await Bed.findById(testBed._id);
    record(8, 'Retried operation after failure succeeds normally with atomic transaction commit',
      res08.status === 201 &&
      res08.body?.data?.status === 'pending',
      `resStatus=${res08.status}, avail=${bedAfter08.availableBeds}`
    );

    // =========================================================================
    // TEST 09: Valid Concurrent Operations Against Transactional Workflow
    // =========================================================================
    // Fire 2 simultaneous reservation requests
    const [resConcA, resConcB] = await Promise.all([
      requestJson(`${BASE_URL}/bed-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          hospitalId: testHospital._id.toString(),
          bedType: 'icu',
          patientName: 'Concurrent Patient A',
          contactPhone: '9830099991',
        }),
      }),
      requestJson(`${BASE_URL}/bed-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${citizenToken}`,
        },
        body: JSON.stringify({
          hospitalId: testHospital._id.toString(),
          bedType: 'icu',
          patientName: 'Concurrent Patient B',
          contactPhone: '9830099992',
        }),
      }),
    ]);

    if (resConcA.body?.data?._id) createdBedRequestIds.push(resConcA.body.data._id);
    if (resConcB.body?.data?._id) createdBedRequestIds.push(resConcB.body.data._id);

    const finalBed = await Bed.findById(testBed._id);
    const bothSuccessful = resConcA.status === 201 && resConcB.status === 201;
    const finalInvariantsHold =
      finalBed.totalBeds >= 0 &&
      finalBed.occupiedBeds >= 0 &&
      finalBed.reservedBeds >= 0 &&
      finalBed.availableBeds >= 0 &&
      (finalBed.occupiedBeds + finalBed.reservedBeds + finalBed.availableBeds === finalBed.totalBeds);

    record(9, 'Concurrent operations commit atomically preserving bed sum invariant',
      bothSuccessful && finalInvariantsHold,
      `resA=${resConcA.status}, resB=${resConcB.status}, avail=${finalBed.availableBeds}, res=${finalBed.reservedBeds}`
    );

    // =========================================================================
    // TEST 10: Unauthorized Operations Are Still Rejected (Authorization Intact)
    // =========================================================================
    const resUnauth1 = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospitalId: testHospital._id.toString(),
        bedType: 'icu',
        patientName: 'No Auth Patient',
      }),
    });

    const resUnauth2 = await requestJson(`${BASE_URL}/bed-requests/${req03Id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${otherAdminToken}` }, // Admin for Hospital B
    });

    record(10, 'Authentication and cross-hospital authorization remain strictly enforced (401 & 403)',
      resUnauth1.status === 401 && resUnauth2.status === 403,
      `unauthStatus=${resUnauth1.status}, crossHospitalStatus=${resUnauth2.status}`
    );

  } catch (error) {
    console.error('❌ Exception during SEC3-CONCUR-01D verification:', error);
    failed++;
  } finally {
    console.log('\n--- CLEANING UP TEST FIXTURES ---');
    if (createdBedRequestIds.length) {
      const delReq = await BedRequest.deleteMany({ _id: { $in: createdBedRequestIds } });
      console.log(`  Cleaned up ${delReq.deletedCount} test BedRequests`);
    }
    if (createdBedIds.length) {
      const delBed = await Bed.deleteMany({ _id: { $in: createdBedIds } });
      console.log(`  Cleaned up ${delBed.deletedCount} test Beds`);
    }
    if (createdHospitalIds.length) {
      const delHosp = await Hospital.deleteMany({ _id: { $in: createdHospitalIds } });
      console.log(`  Cleaned up ${delHosp.deletedCount} test Hospitals`);
    }
    if (createdUserIds.length) {
      const delUsers = await User.deleteMany({ _id: { $in: createdUserIds } });
      console.log(`  Cleaned up ${delUsers.deletedCount} test Users`);
    }

    if (testServer) {
      if (typeof testServer.closeAllConnections === 'function') {
        testServer.closeAllConnections();
      }
      await new Promise((resolve) => testServer.close(resolve));
      console.log('  Closed HTTP test server.');
    }
    await mongoose.disconnect();
    console.log('  Mongoose disconnected.');
  }

  console.log('\n====================================================');
  console.log(`SEC3-CONCUR-01D TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runConcur01DTests();
