/**
 * testSecurityAudit3Concur01ERemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01E:
 * Multi-Hospital Blood Request Acceptance Race Condition
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
const BloodInventory = require('../models/BloodInventory');
const BloodRequest = require('../models/BloodRequest');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const TEST_PORT = 5016;
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

async function runConcur01ETests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01E REMEDIATION VERIFICATION SUITE');
  console.log('Multi-Hospital Blood Request Acceptance Race Condition');
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
  const createdHospitalIds = [];
  const createdUserIds = [];
  const createdInventoryIds = [];
  const createdBloodRequestIds = [];

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, () => {
        console.log(`Test server running on port ${TEST_PORT}`);
        resolve();
      });
      testServer.on('error', reject);
    });

    // -------------------------------------------------------------------------
    // Setup Isolated Test Fixtures
    // -------------------------------------------------------------------------
    const uniqueSuffix = Date.now().toString().slice(-6);

    // Create 3 Hospitals: A, B, and C (C is an unauthorized external hospital)
    const hospitalA = await Hospital.create({
      name: `CONCUR-01E Hospital Alpha ${uniqueSuffix}`,
      registrationId: 'WB-01E-A-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '10 Blood Street Alpha',
      area: 'Central Kolkata',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      phone: '9830111111',
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      totalBeds: 50,
      occupiedBeds: 10,
      availableBeds: 40,
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalA._id);

    const hospitalB = await Hospital.create({
      name: `CONCUR-01E Hospital Beta ${uniqueSuffix}`,
      registrationId: 'WB-01E-B-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '20 Blood Street Beta',
      area: 'South Kolkata',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700025',
      phone: '9830222222',
      latitude: 22.5200,
      longitude: 88.3500,
      location: { type: 'Point', coordinates: [88.3500, 22.5200] },
      totalBeds: 50,
      occupiedBeds: 10,
      availableBeds: 40,
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalB._id);

    const hospitalC = await Hospital.create({
      name: `CONCUR-01E Hospital Gamma (External) ${uniqueSuffix}`,
      registrationId: 'WB-01E-C-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'private',
      address: '30 Hill Cart Road Gamma',
      area: 'Siliguri',
      district: 'Darjeeling',
      state: 'West Bengal',
      pincode: '734001',
      phone: '9830333333',
      latitude: 26.7271,
      longitude: 88.3953,
      location: { type: 'Point', coordinates: [88.3953, 26.7271] },
      totalBeds: 50,
      occupiedBeds: 10,
      availableBeds: 40,
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalC._id);

    // Create Staff Users
    const staffUserA = await User.create({
      name: `Staff Alpha ${uniqueSuffix}`,
      email: `staff_alpha_${uniqueSuffix}@bloodconcur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: hospitalA._id,
      hospitalId: hospitalA._id,
      phone: '9830111111',
      isActive: true,
    });
    createdUserIds.push(staffUserA._id);
    const tokenA = generateToken(staffUserA._id, staffUserA.role);

    const staffUserB = await User.create({
      name: `Staff Beta ${uniqueSuffix}`,
      email: `staff_beta_${uniqueSuffix}@bloodconcur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: hospitalB._id,
      hospitalId: hospitalB._id,
      phone: '9830222222',
      isActive: true,
    });
    createdUserIds.push(staffUserB._id);
    const tokenB = generateToken(staffUserB._id, staffUserB.role);

    const staffUserC = await User.create({
      name: `Staff Gamma ${uniqueSuffix}`,
      email: `staff_gamma_${uniqueSuffix}@bloodconcur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: hospitalC._id,
      hospitalId: hospitalC._id,
      phone: '9830333333',
      isActive: true,
    });
    createdUserIds.push(staffUserC._id);
    const tokenC = generateToken(staffUserC._id, staffUserC.role);

    // Initial Inventory for Hospital A & B
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invA_Opos = await BloodInventory.create({
      hospital: hospitalA._id,
      bloodGroup: 'O+',
      component: 'Whole Blood',
      totalUnits: 20,
      availableUnits: 20,
      reservedUnits: 0,
      usedUnits: 0,
      expiryDate,
      status: 'Available',
    });
    createdInventoryIds.push(invA_Opos._id);

    const invB_Opos = await BloodInventory.create({
      hospital: hospitalB._id,
      bloodGroup: 'O+',
      component: 'Whole Blood',
      totalUnits: 20,
      availableUnits: 20,
      reservedUnits: 0,
      usedUnits: 0,
      expiryDate,
      status: 'Available',
    });
    createdInventoryIds.push(invB_Opos._id);

    // =========================================================================
    // TEST 01: Baseline successful BloodRequest acceptance
    // =========================================================================
    const bloodReq01 = await BloodRequest.create({
      requestId: `BR-01E-01-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 01', contactPhone: '9830000001', age: 30, gender: 'Male' },
      requester: { name: 'Requester 01', contact: '9830000001', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 2, urgency: 'EMERGENCY' },
      status: 'PENDING',
      recipients: [
        { hospital: hospitalA._id, status: 'PENDING', reservedUnits: 0 },
        { hospital: hospitalB._id, status: 'PENDING', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq01._id);

    const res01 = await requestJson(`${BASE_URL}/blood-requests/${bloodReq01._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const updated01 = await BloodRequest.findById(bloodReq01._id);
    const updatedInvA01 = await BloodInventory.findById(invA_Opos._id);

    record(
      1,
      'Baseline successful BloodRequest acceptance (Hospital A claims 2 units)',
      res01.status === 200 &&
        updated01.status === 'BLOOD_RESERVED' &&
        updated01.fulfillingHospital?.toString() === hospitalA._id.toString() &&
        updated01.totalReservedUnits === 2 &&
        updatedInvA01.availableUnits === 18 &&
        updatedInvA01.reservedUnits === 2,
      `status=${res01.status}, reqStatus=${updated01?.status}, reservedUnits=${updated01?.totalReservedUnits}`
    );

    // =========================================================================
    // TEST 02: Second acceptance after first acceptance is rejected
    // =========================================================================
    // Hospital A rejects the request it accepted in Test 01
    const resRej02 = await requestJson(`${BASE_URL}/blood-requests/${bloodReq01._id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ reason: 'Hospital Alpha refrigerator maintenance; cannot fulfill' }),
    });

    const refreshed01AfterRej = await BloodRequest.findById(bloodReq01._id);
    const invA_AfterRej = await BloodInventory.findById(invA_Opos._id);

    // Now Hospital B should be able to accept it
    const res02AcceptB = await requestJson(`${BASE_URL}/blood-requests/${bloodReq01._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    const refreshed01Final = await BloodRequest.findById(bloodReq01._id);
    const invB_AfterAccept = await BloodInventory.findById(invB_Opos._id);

    record(
      2,
      'Second acceptance after first acceptance is rejected (Hospital B fulfills after Hospital A rejects)',
      resRej02.status === 200 &&
        invA_AfterRej.availableUnits === 20 &&
        invA_AfterRej.reservedUnits === 0 &&
        refreshed01AfterRej.status === 'PENDING' &&
        res02AcceptB.status === 200 &&
        refreshed01Final.status === 'BLOOD_RESERVED' &&
        refreshed01Final.fulfillingHospital?.toString() === hospitalB._id.toString() &&
        invB_AfterAccept.availableUnits === 18 &&
        invB_AfterAccept.reservedUnits === 2,
      `rejStatus=${resRej02.status}, acceptBStatus=${res02AcceptB.status}, fulfillingHospital=${refreshed01Final?.fulfillingHospital}`
    );

    // =========================================================================
    // TEST 03: Two hospitals concurrently accept the same request
    // =========================================================================
    const bloodReq03 = await BloodRequest.create({
      requestId: `BR-01E-03-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 03', contactPhone: '9830000003', age: 45, gender: 'Female' },
      requester: { name: 'Requester 03', contact: '9830000003', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 3, urgency: 'EMERGENCY' },
      status: 'PENDING',
      recipients: [
        { hospital: hospitalA._id, status: 'PENDING', reservedUnits: 0 },
        { hospital: hospitalB._id, status: 'PENDING', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq03._id);

    const invA_pre03 = await BloodInventory.findById(invA_Opos._id);
    const invB_pre03 = await BloodInventory.findById(invB_Opos._id);

    // Fire simultaneous acceptances from Hospital A and Hospital B
    const [res03A, res03B] = await Promise.all([
      requestJson(`${BASE_URL}/blood-requests/${bloodReq03._id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      }),
      requestJson(`${BASE_URL}/blood-requests/${bloodReq03._id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
    ]);

    const statuses03 = [res03A.status, res03B.status].sort();
    const exactlyOneWon = statuses03[0] === 200 && statuses03[1] === 409;

    record(
      3,
      'Concurrent acceptance race between Hospital A & B: exactly ONE succeeds (200), exactly ONE conflicts (409)',
      exactlyOneWon,
      `statuses=${statuses03.join(',')}, respA=${res03A.status}, respB=${res03B.status}`
    );

    // =========================================================================
    // TEST 04: Verify final BloodRequest state has exactly one valid accepting hospital
    // =========================================================================
    const updated03 = await BloodRequest.findById(bloodReq03._id);
    const winningHospId = res03A.status === 200 ? hospitalA._id.toString() : hospitalB._id.toString();
    const losingHospId = res03A.status === 200 ? hospitalB._id.toString() : hospitalA._id.toString();

    record(
      4,
      'Verify final BloodRequest state has exactly ONE valid fulfillingHospital matching winner',
      updated03.status === 'BLOOD_RESERVED' &&
        updated03.fulfillingHospital?.toString() === winningHospId &&
        updated03.totalReservedUnits === 3,
      `status=${updated03.status}, fulfilling=${updated03.fulfillingHospital}, totalReserved=${updated03.totalReservedUnits}`
    );

    // =========================================================================
    // TEST 05: Verify losing hospital cannot overwrite the winning hospital
    // =========================================================================
    const losingToken = res03A.status === 200 ? tokenB : tokenA;
    const res05LosingRetry = await requestJson(`${BASE_URL}/blood-requests/${bloodReq03._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${losingToken}` },
    });

    const updated03AfterRetry = await BloodRequest.findById(bloodReq03._id);

    record(
      5,
      'Verify losing hospital retry is rejected with 409 and cannot overwrite winner',
      res05LosingRetry.status === 409 &&
        updated03AfterRetry.fulfillingHospital?.toString() === winningHospId,
      `retryStatus=${res05LosingRetry.status}, fulfilling=${updated03AfterRetry.fulfillingHospital}`
    );

    // =========================================================================
    // TEST 06: Verify no duplicate inventory reservation occurred on losing hospital
    // =========================================================================
    const invA_post03 = await BloodInventory.findById(invA_Opos._id);
    const invB_post03 = await BloodInventory.findById(invB_Opos._id);

    const winningInv = winningHospId === hospitalA._id.toString() ? invA_post03 : invB_post03;
    const losingInv = losingHospId === hospitalA._id.toString() ? invA_post03 : invB_post03;
    const winningPre = winningHospId === hospitalA._id.toString() ? invA_pre03 : invB_pre03;
    const losingPre = losingHospId === hospitalA._id.toString() ? invA_pre03 : invB_pre03;

    const winnerDeductedProperly =
      winningInv.availableUnits === winningPre.availableUnits - 3 &&
      winningInv.reservedUnits === winningPre.reservedUnits + 3;

    const loserUntouched =
      losingInv.availableUnits === losingPre.availableUnits &&
      losingInv.reservedUnits === losingPre.reservedUnits;

    record(
      6,
      'Verify zero phantom inventory reservation on losing hospital; winner reserved exactly 3 units',
      winnerDeductedProperly && loserUntouched,
      `winnerDiff=${winningPre.availableUnits - winningInv.availableUnits}, loserDiff=${losingPre.availableUnits - losingInv.availableUnits}`
    );

    // =========================================================================
    // TEST 07: Verify no duplicate success audit log or side effect is generated
    // =========================================================================
    const auditLogs03 = await AuditLog.find({
      resourceType: 'BloodRequest',
      resourceId: bloodReq03._id,
      action: 'BLOOD_REQUEST_ACCEPTED',
    });

    record(
      7,
      'Verify exactly ONE BLOOD_REQUEST_ACCEPTED audit log generated for the entire race',
      auditLogs03.length === 1 && auditLogs03[0].hospital.toString() === winningHospId,
      `auditCount=${auditLogs03.length}, loggedHospital=${auditLogs03[0]?.hospital}`
    );

    // =========================================================================
    // TEST 08: Partial fulfillment concurrency: 3 + 3 against requested 5
    // =========================================================================
    const bloodReq08 = await BloodRequest.create({
      requestId: `BR-01E-08-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 08', contactPhone: '9830000008', age: 50, gender: 'Male' },
      requester: { name: 'Requester 08', contact: '9830000008', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 5, urgency: 'URGENT' },
      status: 'PENDING',
      recipients: [
        { hospital: hospitalA._id, status: 'PENDING', reservedUnits: 0 },
        { hospital: hospitalB._id, status: 'PENDING', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq08._id);

    // Fire 2 concurrent partial accepts: Hospital A requests 3, Hospital B requests 3.
    // 3 + 3 = 6 > 5! Exactly ONE must succeed, one must conflict/fail.
    const [res08A, res08B] = await Promise.all([
      requestJson(`${BASE_URL}/blood-requests/${bloodReq08._id}/partial-accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ availableUnits: 3, notes: 'Hospital A offering 3 units' }),
      }),
      requestJson(`${BASE_URL}/blood-requests/${bloodReq08._id}/partial-accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({ availableUnits: 3, notes: 'Hospital B offering 3 units' }),
      }),
    ]);

    const statuses08 = [res08A.status, res08B.status].sort();
    const updated08 = await BloodRequest.findById(bloodReq08._id);

    record(
      8,
      'Concurrent partial acceptance (3 + 3 vs 5 requested): total accepted NEVER exceeds 5 (exactly 1 wins 3 units, 1 conflicts)',
      statuses08[0] === 200 &&
        statuses08[1] === 409 &&
        updated08.totalReservedUnits === 3 &&
        updated08.status === 'PARTIALLY_ACCEPTED',
      `statuses=${statuses08.join(',')}, totalReservedUnits=${updated08?.totalReservedUnits}`
    );

    // =========================================================================
    // TEST 09: Partial fulfillment stress test: 10 simultaneous 1-unit claims vs 5 requested
    // =========================================================================
    const bloodReq09 = await BloodRequest.create({
      requestId: `BR-01E-09-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 09', contactPhone: '9830000009', age: 22, gender: 'Female' },
      requester: { name: 'Requester 09', contact: '9830000009', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 5, urgency: 'URGENT' },
      status: 'PENDING',
      recipients: [
        { hospital: hospitalA._id, status: 'PENDING', reservedUnits: 0 },
        { hospital: hospitalB._id, status: 'PENDING', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq09._id);

    // Fire 10 simultaneous 1-unit partial accepts (alternating staff token A and B)
    const promises09 = [];
    for (let i = 0; i < 10; i++) {
      const activeToken = i % 2 === 0 ? tokenA : tokenB;
      promises09.push(
        requestJson(`${BASE_URL}/blood-requests/${bloodReq09._id}/partial-accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`,
          },
          body: JSON.stringify({ availableUnits: 1, notes: `Unit claim ${i + 1}` }),
        })
      );
    }

    const results09 = await Promise.all(promises09);
    const count200 = results09.filter(r => r.status === 200).length;
    const count409 = results09.filter(r => r.status === 409 || r.status === 400).length;
    const updated09 = await BloodRequest.findById(bloodReq09._id);

    record(
      9,
      'Multi-claim stress: 10 simultaneous 1-unit claims against quantity 5 -> exactly 5 succeed, total units = 5, status = BLOOD_RESERVED',
      count200 === 5 &&
        count409 === 5 &&
        updated09.totalReservedUnits === 5 &&
        updated09.status === 'BLOOD_RESERVED',
      `successes=${count200}, failures=${count409}, totalReservedUnits=${updated09?.totalReservedUnits}, status=${updated09?.status}`
    );

    // =========================================================================
    // TEST 10: Hospital isolation (Unauthorized external hospital C cannot accept)
    // =========================================================================
    const bloodReq10 = await BloodRequest.create({
      requestId: `BR-01E-10-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 10', contactPhone: '9830000010', age: 35, gender: 'Other' },
      requester: { name: 'Requester 10', contact: '9830000010', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 1, urgency: 'EMERGENCY' },
      status: 'PENDING',
      recipients: [
        { hospital: hospitalA._id, status: 'PENDING', reservedUnits: 0 },
        { hospital: hospitalB._id, status: 'PENDING', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq10._id);

    // Staff from Hospital C (not in recipients) attempts to accept
    const res10Unauthorized = await requestJson(`${BASE_URL}/blood-requests/${bloodReq10._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenC}` },
    });

    const refreshed10 = await BloodRequest.findById(bloodReq10._id);

    record(
      10,
      'Hospital isolation: Staff from unassociated Hospital C rejected with 403 Forbidden',
      res10Unauthorized.status === 403 &&
        refreshed10.status === 'PENDING' &&
        refreshed10.totalReservedUnits === 0,
      `status=${res10Unauthorized.status}, reqStatus=${refreshed10.status}`
    );

    // =========================================================================
    // TEST 11: Invalid request state: CANCELLED request cannot be accepted
    // =========================================================================
    const bloodReq11 = await BloodRequest.create({
      requestId: `BR-01E-11-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 11', contactPhone: '9830000011', age: 40, gender: 'Male' },
      requester: { name: 'Requester 11', contact: '9830000011', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 2, urgency: 'EMERGENCY' },
      status: 'CANCELLED',
      cancelledAt: new Date(),
      recipients: [
        { hospital: hospitalA._id, status: 'CANCELLED', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq11._id);

    const res11Cancelled = await requestJson(`${BASE_URL}/blood-requests/${bloodReq11._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    record(
      11,
      'Invalid state rejection: Attempt to accept CANCELLED request returns 409 Conflict',
      res11Cancelled.status === 409,
      `status=${res11Cancelled.status}`
    );

    // =========================================================================
    // TEST 12: Invalid request state: COMPLETED request cannot be accepted
    // =========================================================================
    const bloodReq12 = await BloodRequest.create({
      requestId: `BR-01E-12-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 12', contactPhone: '9830000012', age: 60, gender: 'Female' },
      requester: { name: 'Requester 12', contact: '9830000012', role: 'USER' },
      bloodRequirement: { bloodGroup: 'O+', component: 'Whole Blood', quantity: 2, urgency: 'EMERGENCY' },
      status: 'COMPLETED',
      completedAt: new Date(),
      fulfillingHospital: hospitalA._id,
      recipients: [
        { hospital: hospitalA._id, status: 'COMPLETED', reservedUnits: 0 },
      ],
      totalReservedUnits: 2,
    });
    createdBloodRequestIds.push(bloodReq12._id);

    const res12Completed = await requestJson(`${BASE_URL}/blood-requests/${bloodReq12._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    record(
      12,
      'Invalid state rejection: Attempt to accept COMPLETED request returns 409 Conflict',
      res12Completed.status === 409,
      `status=${res12Completed.status}`
    );

    // =========================================================================
    // TEST 13: Insufficient inventory rollback restores PENDING state
    // =========================================================================
    // Create Hospital D with 0 units of AB- Platelets
    const hospitalD = await Hospital.create({
      name: `CONCUR-01E Hospital Delta ${uniqueSuffix}`,
      registrationId: 'WB-01E-D-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '40 Blood Street Delta',
      area: 'North Kolkata',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700006',
      phone: '9830444444',
      latitude: 22.6000,
      longitude: 88.3700,
      location: { type: 'Point', coordinates: [88.3700, 22.6000] },
      totalBeds: 20,
      occupiedBeds: 0,
      availableBeds: 20,
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalD._id);

    const staffUserD = await User.create({
      name: `Staff Delta ${uniqueSuffix}`,
      email: `staff_delta_${uniqueSuffix}@bloodconcur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: hospitalD._id,
      hospitalId: hospitalD._id,
      phone: '9830444444',
      isActive: true,
    });
    createdUserIds.push(staffUserD._id);
    const tokenD = generateToken(staffUserD._id, staffUserD.role);

    // 0 units in stock
    const invD_ABneg = await BloodInventory.create({
      hospital: hospitalD._id,
      bloodGroup: 'AB-',
      component: 'Platelets',
      totalUnits: 0,
      availableUnits: 0,
      reservedUnits: 0,
      usedUnits: 0,
      expiryDate,
      status: 'Critical',
    });
    createdInventoryIds.push(invD_ABneg._id);

    const bloodReq13 = await BloodRequest.create({
      requestId: `BR-01E-13-${uniqueSuffix}`,
      requestType: 'BLOOD',
      patient: { name: 'Test Patient 13', contactPhone: '9830000013', age: 29, gender: 'Male' },
      requester: { name: 'Requester 13', contact: '9830000013', role: 'USER' },
      bloodRequirement: { bloodGroup: 'AB-', component: 'Platelets', quantity: 2, urgency: 'EMERGENCY' },
      status: 'PENDING',
      recipients: [
        { hospital: hospitalD._id, status: 'PENDING', reservedUnits: 0 },
        { hospital: hospitalA._id, status: 'PENDING', reservedUnits: 0 },
      ],
      totalReservedUnits: 0,
    });
    createdBloodRequestIds.push(bloodReq13._id);

    // Hospital D attempts to accept with 0 stock
    const res13Fail = await requestJson(`${BASE_URL}/blood-requests/${bloodReq13._id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenD}` },
    });

    const refreshed13 = await BloodRequest.findById(bloodReq13._id);

    record(
      13,
      'Insufficient inventory rollback: reservation fails (400) and request rolls back cleanly to PENDING',
      res13Fail.status === 400 &&
        refreshed13.status === 'PENDING' &&
        refreshed13.totalReservedUnits === 0 &&
        refreshed13.recipients.find(r => r.hospital.toString() === hospitalD._id.toString())?.status === 'PENDING',
      `status=${res13Fail.status}, reqStatus=${refreshed13.status}, reservedUnits=${refreshed13.totalReservedUnits}`
    );

    // =========================================================================
    // TEST 14: Database Cleanliness & Isolation in Finally
    // =========================================================================
  } catch (err) {
    console.error('Unexpected error in Concur01E test runner:', err);
    failed++;
  } finally {
    console.log('\n--- TEARDOWN & DATABASE CLEANUP ---');
    try {
      if (createdBloodRequestIds.length > 0) {
        await BloodRequest.deleteMany({ _id: { $in: createdBloodRequestIds } });
        await AuditLog.deleteMany({ resourceId: { $in: createdBloodRequestIds } });
      }
      if (createdInventoryIds.length > 0) {
        await BloodInventory.deleteMany({ _id: { $in: createdInventoryIds } });
        await AuditLog.deleteMany({ resourceId: { $in: createdInventoryIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (createdHospitalIds.length > 0) {
        await Hospital.deleteMany({ _id: { $in: createdHospitalIds } });
      }

      const orphanReqs = await BloodRequest.countDocuments({ _id: { $in: createdBloodRequestIds } });
      const orphanInvs = await BloodInventory.countDocuments({ _id: { $in: createdInventoryIds } });
      const orphanUsers = await User.countDocuments({ _id: { $in: createdUserIds } });
      const orphanHosps = await Hospital.countDocuments({ _id: { $in: createdHospitalIds } });

      record(
        14,
        'Database teardown and guaranteed cleanup: 0 orphan test records in MongoDB Atlas',
        orphanReqs === 0 && orphanInvs === 0 && orphanUsers === 0 && orphanHosps === 0,
        `orphanReqs=${orphanReqs}, orphanInvs=${orphanInvs}, orphanUsers=${orphanUsers}, orphanHosps=${orphanHosps}`
      );
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }

    if (testServer) {
      await new Promise(resolve => testServer.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runConcur01ETests();
