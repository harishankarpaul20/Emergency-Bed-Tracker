/**
 * testSecurityAudit3Concur01BRemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01B:
 * Blood Inventory Non-Atomic Reservation / Overbooking Race Condition Remediation
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
const BloodInventory = require('../models/BloodInventory');
const BloodRequest = require('../models/BloodRequest');
const AuditLog = require('../models/AuditLog');
const generateToken = require('../utils/generateToken');
const { reserveBloodUnits, releaseReservedBloodUnits } = require('../services/bloodInventoryService');

const TEST_PORT = 5013;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

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

async function runConcur01BTests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01B REMEDIATION VERIFICATION SUITE');
  console.log('Blood Inventory Non-Atomic Reservation / Overbooking Race');
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
  const createdInventoryIds = [];
  const createdBloodRequestIds = [];
  const createdAuditLogIds = [];

  try {
    // 1. Connect DB if not already connected
    console.log('Step 1: Connecting to MongoDB...');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    console.log('Step 1: MongoDB connected successfully.');

    // 2. Start HTTP Test Server
    console.log('Step 2: Starting HTTP test server...');
    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
      testServer.on('error', reject);
    });
    console.log(`Step 2: Test server listening on ${BASE_URL}`);

    // 3. Create Test Hospital A fixture
    console.log('Step 3: Creating Hospital A...');
    const testHospitalA = await Hospital.create({
      name: 'Concur01B Hospital A ' + Date.now(),
      registrationId: 'WB-BLOOD-A-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '10 Blood Street',
      area: 'Central Zone',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      phone: '9830000011',
      email: `hosp_a_${Date.now()}@bloodconcur.com`,
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(testHospitalA._id);
    console.log('Step 3: Hospital A created:', testHospitalA._id);

    // 4. Create Test Hospital B fixture (for facility isolation)
    console.log('Step 4: Creating Hospital B...');
    const testHospitalB = await Hospital.create({
      name: 'Concur01B Hospital B ' + Date.now(),
      registrationId: 'WB-BLOOD-B-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '20 Blood Street',
      area: 'North Zone',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700002',
      phone: '9830000012',
      email: `hosp_b_${Date.now()}@bloodconcur.com`,
      latitude: 22.5800,
      longitude: 88.3700,
      location: { type: 'Point', coordinates: [88.3700, 22.5800] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(testHospitalB._id);
    console.log('Step 4: Hospital B created:', testHospitalB._id);

    // 5. Create Staff User for Hospital A
    console.log('Step 5: Creating Staff User...');
    const staffUserA = await User.create({
      name: 'Concur01B Staff A',
      email: `staff_a_${Date.now()}@bloodconcur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: testHospitalA._id,
      isActive: true,
    });
    createdUserIds.push(staffUserA._id);
    const staffTokenA = generateToken(staffUserA._id, staffUserA.role);
    console.log('Step 5: Staff User created:', staffUserA._id);

    // 6. Create Citizen Requester User
    console.log('Step 6: Creating Citizen User...');
    const citizenUser = await User.create({
      name: 'Concur01B Citizen Requester',
      email: `citizen_${Date.now()}@bloodconcur.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'user',
      isActive: true,
    });
    createdUserIds.push(citizenUser._id);
    const citizenToken = generateToken(citizenUser._id, citizenUser.role);
    console.log('Step 6: Citizen User created:', citizenUser._id);

    // Track audit logs created during test run
    const preExistingAuditLogs = await AuditLog.find({ hospital: { $in: [testHospitalA._id, testHospitalB._id] } }).select('_id');
    const preLogIds = new Set(preExistingAuditLogs.map(l => l._id.toString()));

    // =========================================================================
    // TEST 01: Baseline single reservation succeeds when availableUnits >= qty
    // =========================================================================
    const inv01 = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'A+',
      component: 'Whole Blood',
      totalUnits: 10,
      availableUnits: 10,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 5,
      batchId: 'BATCH-A-POS-01',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv01._id);

    const res01 = await reserveBloodUnits({
      hospitalId: testHospitalA._id,
      bloodGroup: 'A+',
      component: 'Whole Blood',
      quantity: 3,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: new mongoose.Types.ObjectId(),
      role: staffUserA.role,
    });

    const refreshed01 = await BloodInventory.findById(inv01._id);
    record(
      1,
      'Baseline single reservation succeeds when availableUnits >= quantity',
      res01.success === true &&
      res01.reservedUnits === 3 &&
      res01.availableUnits === 7 &&
      refreshed01.availableUnits === 7 &&
      refreshed01.reservedUnits === 3,
      `res01=${JSON.stringify(res01)}, dbAvailable=${refreshed01?.availableUnits}, dbReserved=${refreshed01?.reservedUnits}`
    );

    // =========================================================================
    // TEST 02: Single reservation fails cleanly when requested qty > available
    // =========================================================================
    const res02 = await reserveBloodUnits({
      hospitalId: testHospitalA._id,
      bloodGroup: 'A+',
      component: 'Whole Blood',
      quantity: 8, // only 7 available
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: new mongoose.Types.ObjectId(),
      role: staffUserA.role,
    });

    const refreshed02 = await BloodInventory.findById(inv01._id);
    record(
      2,
      'Single reservation fails cleanly when requested quantity > availableUnits',
      res02.success === false &&
      res02.availableUnits === 7 &&
      res02.message.includes('Insufficient units available') &&
      refreshed02.availableUnits === 7 &&
      refreshed02.reservedUnits === 3,
      `res02=${JSON.stringify(res02)}, dbAvailable=${refreshed02?.availableUnits}`
    );

    // =========================================================================
    // TEST 03: Rejection on negative / non-integer / zero quantity
    // =========================================================================
    let rejectedNeg = false;
    let rejectedZero = false;
    let rejectedFloat = false;

    try {
      await reserveBloodUnits({
        hospitalId: testHospitalA._id,
        bloodGroup: 'A+',
        component: 'Whole Blood',
        quantity: -2,
        userId: staffUserA._id,
      });
    } catch (e) {
      rejectedNeg = true;
    }

    try {
      await reserveBloodUnits({
        hospitalId: testHospitalA._id,
        bloodGroup: 'A+',
        component: 'Whole Blood',
        quantity: 0,
        userId: staffUserA._id,
      });
    } catch (e) {
      rejectedZero = true;
    }

    try {
      await reserveBloodUnits({
        hospitalId: testHospitalA._id,
        bloodGroup: 'A+',
        component: 'Whole Blood',
        quantity: 2.5,
        userId: staffUserA._id,
      });
    } catch (e) {
      rejectedFloat = true;
    }

    record(
      3,
      'Rejection on negative, zero, and float quantity inputs (guards)',
      rejectedNeg && rejectedZero && rejectedFloat,
      `rejectedNeg=${rejectedNeg}, rejectedZero=${rejectedZero}, rejectedFloat=${rejectedFloat}`
    );

    // =========================================================================
    // TEST 04: Two concurrent reservations (3 and 3) against 4 available units
    // =========================================================================
    const inv04 = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'B+',
      component: 'Packed RBC',
      totalUnits: 4,
      availableUnits: 4,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-B-POS-04',
      expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv04._id);

    const [resConcurrentA, resConcurrentB] = await Promise.all([
      reserveBloodUnits({
        hospitalId: testHospitalA._id,
        bloodGroup: 'B+',
        component: 'Packed RBC',
        quantity: 3,
        userId: staffUserA._id,
        userName: staffUserA.name,
        requestId: new mongoose.Types.ObjectId(),
        role: staffUserA.role,
      }),
      reserveBloodUnits({
        hospitalId: testHospitalA._id,
        bloodGroup: 'B+',
        component: 'Packed RBC',
        quantity: 3,
        userId: staffUserA._id,
        userName: staffUserA.name,
        requestId: new mongoose.Types.ObjectId(),
        role: staffUserA.role,
      }),
    ]);

    const refreshed04 = await BloodInventory.findById(inv04._id);
    const oneSuccess = (resConcurrentA.success && !resConcurrentB.success) || (!resConcurrentA.success && resConcurrentB.success);
    const correctFinalStock = refreshed04.availableUnits === 1 && refreshed04.reservedUnits === 3;
    const balanceInvariant = refreshed04.totalUnits === (refreshed04.availableUnits + refreshed04.reservedUnits + refreshed04.usedUnits + refreshed04.expiredUnits);

    record(
      4,
      'Two concurrent reservations (3 + 3) against 4 units: exactly 1 succeeds, no overbooking',
      oneSuccess && correctFinalStock && balanceInvariant,
      `resA=${JSON.stringify(resConcurrentA)}, resB=${JSON.stringify(resConcurrentB)}, dbAvailable=${refreshed04.availableUnits}, dbReserved=${refreshed04.reservedUnits}`
    );

    // =========================================================================
    // TEST 05: High concurrency stress test (10 simultaneous reservations of 1 against 5 units)
    // =========================================================================
    const inv05 = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'O+',
      component: 'Platelets',
      totalUnits: 5,
      availableUnits: 5,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-O-POS-05',
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv05._id);

    const stressPromises = Array.from({ length: 10 }, (_, i) =>
      reserveBloodUnits({
        hospitalId: testHospitalA._id,
        bloodGroup: 'O+',
        component: 'Platelets',
        quantity: 1,
        userId: staffUserA._id,
        userName: staffUserA.name,
        requestId: new mongoose.Types.ObjectId(),
        role: staffUserA.role,
      })
    );

    const stressResults = await Promise.all(stressPromises);
    const stressSuccesses = stressResults.filter(r => r.success).length;
    const stressFailures = stressResults.filter(r => !r.success).length;
    const refreshed05 = await BloodInventory.findById(inv05._id);

    record(
      5,
      'High concurrency stress test: 10 parallel 1-unit reservations against 5 units yield exactly 5 wins, 5 fails',
      stressSuccesses === 5 &&
      stressFailures === 5 &&
      refreshed05.availableUnits === 0 &&
      refreshed05.reservedUnits === 5 &&
      refreshed05.availableUnits >= 0,
      `wins=${stressSuccesses}, fails=${stressFailures}, dbAvailable=${refreshed05.availableUnits}, dbReserved=${refreshed05.reservedUnits}`
    );

    // =========================================================================
    // TEST 06: Expired inventory is rejected atomically and cannot be reserved
    // =========================================================================
    const inv06 = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'AB+',
      component: 'Whole Blood',
      totalUnits: 10,
      availableUnits: 10,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 5,
      batchId: 'BATCH-EXPIRED-06',
      expiryDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      status: 'Expired',
    });
    createdInventoryIds.push(inv06._id);

    const res06 = await reserveBloodUnits({
      hospitalId: testHospitalA._id,
      bloodGroup: 'AB+',
      component: 'Whole Blood',
      quantity: 1,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: new mongoose.Types.ObjectId(),
      role: staffUserA.role,
    });

    const refreshed06 = await BloodInventory.findById(inv06._id);
    record(
      6,
      'Expired inventory is rejected atomically and cannot be reserved',
      res06.success === false &&
      res06.availableUnits === 0 &&
      res06.message.includes('No active') &&
      refreshed06.availableUnits === 0 &&
      refreshed06.reservedUnits === 0,
      `res06=${JSON.stringify(res06)}, dbAvailable=${refreshed06.availableUnits}, dbReserved=${refreshed06.reservedUnits}`
    );

    // =========================================================================
    // TEST 07: Facility / Hospital isolation
    // =========================================================================
    const inv07A = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'O-',
      component: 'Whole Blood',
      totalUnits: 8,
      availableUnits: 8,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 3,
      batchId: 'BATCH-O-NEG-07A',
      expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv07A._id);

    const inv07B = await BloodInventory.create({
      hospital: testHospitalB._id,
      bloodGroup: 'O-',
      component: 'Whole Blood',
      totalUnits: 8,
      availableUnits: 8,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 3,
      batchId: 'BATCH-O-NEG-07B',
      expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv07B._id);

    // Reserve 4 units at Hospital A
    await reserveBloodUnits({
      hospitalId: testHospitalA._id,
      bloodGroup: 'O-',
      component: 'Whole Blood',
      quantity: 4,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: new mongoose.Types.ObjectId(),
      role: staffUserA.role,
    });

    const refreshed07A = await BloodInventory.findById(inv07A._id);
    const refreshed07B = await BloodInventory.findById(inv07B._id);

    record(
      7,
      'Facility / Hospital isolation: Reservations at Hospital A do not modify Hospital B',
      refreshed07A.availableUnits === 4 &&
      refreshed07A.reservedUnits === 4 &&
      refreshed07B.availableUnits === 8 &&
      refreshed07B.reservedUnits === 0,
      `hospA(avail=${refreshed07A.availableUnits}, res=${refreshed07A.reservedUnits}), hospB(avail=${refreshed07B.availableUnits}, res=${refreshed07B.reservedUnits})`
    );

    // =========================================================================
    // TEST 08: Blood group isolation at same hospital
    // =========================================================================
    const inv08_A = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'A-',
      component: 'Whole Blood',
      totalUnits: 6,
      availableUnits: 6,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-A-NEG-08',
      expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv08_A._id);

    const inv08_B = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'B-',
      component: 'Whole Blood',
      totalUnits: 6,
      availableUnits: 6,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-B-NEG-08',
      expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv08_B._id);

    await reserveBloodUnits({
      hospitalId: testHospitalA._id,
      bloodGroup: 'A-',
      component: 'Whole Blood',
      quantity: 3,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: new mongoose.Types.ObjectId(),
      role: staffUserA.role,
    });

    const refreshed08_A = await BloodInventory.findById(inv08_A._id);
    const refreshed08_B = await BloodInventory.findById(inv08_B._id);

    record(
      8,
      'Blood group isolation: Reservations for A- do not mutate B- inventory',
      refreshed08_A.availableUnits === 3 &&
      refreshed08_A.reservedUnits === 3 &&
      refreshed08_B.availableUnits === 6 &&
      refreshed08_B.reservedUnits === 0,
      `A-(avail=${refreshed08_A.availableUnits}, res=${refreshed08_A.reservedUnits}), B-(avail=${refreshed08_B.availableUnits}, res=${refreshed08_B.reservedUnits})`
    );

    // =========================================================================
    // TEST 09: Component isolation for same blood group at same hospital
    // =========================================================================
    const inv09_PRBC = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'AB-',
      component: 'Packed RBC',
      totalUnits: 5,
      availableUnits: 5,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-AB-NEG-PRBC',
      expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv09_PRBC._id);

    const inv09_Plasma = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'AB-',
      component: 'Plasma',
      totalUnits: 5,
      availableUnits: 5,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-AB-NEG-PLASMA',
      expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv09_Plasma._id);

    await reserveBloodUnits({
      hospitalId: testHospitalA._id,
      bloodGroup: 'AB-',
      component: 'Packed RBC',
      quantity: 2,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: new mongoose.Types.ObjectId(),
      role: staffUserA.role,
    });

    const refreshed09_PRBC = await BloodInventory.findById(inv09_PRBC._id);
    const refreshed09_Plasma = await BloodInventory.findById(inv09_Plasma._id);

    record(
      9,
      'Component isolation: Reservations for Packed RBC do not mutate Plasma inventory',
      refreshed09_PRBC.availableUnits === 3 &&
      refreshed09_PRBC.reservedUnits === 2 &&
      refreshed09_Plasma.availableUnits === 5 &&
      refreshed09_Plasma.reservedUnits === 0,
      `PRBC(avail=${refreshed09_PRBC.availableUnits}, res=${refreshed09_PRBC.reservedUnits}), Plasma(avail=${refreshed09_Plasma.availableUnits}, res=${refreshed09_Plasma.reservedUnits})`
    );

    // =========================================================================
    // TEST 10: Status transition verification (Available -> Low Stock -> Critical)
    // =========================================================================
    const inv10 = await BloodInventory.create({
      hospital: testHospitalB._id,
      bloodGroup: 'A+',
      component: 'Plasma',
      totalUnits: 10,
      availableUnits: 10,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 5,
      batchId: 'BATCH-STATUS-10',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv10._id);

    // Step A: Reserve 6 units -> availableUnits = 4 (<= 5 minThreshold) -> 'Low Stock'
    await reserveBloodUnits({
      hospitalId: testHospitalB._id,
      bloodGroup: 'A+',
      component: 'Plasma',
      quantity: 6,
      userId: staffUserA._id,
    });
    const refreshed10A = await BloodInventory.findById(inv10._id);
    const isLowStock = refreshed10A.availableUnits === 4 && refreshed10A.status === 'Low Stock';

    // Step B: Reserve 3 more units -> availableUnits = 1 (<= 1) -> 'Critical'
    await reserveBloodUnits({
      hospitalId: testHospitalB._id,
      bloodGroup: 'A+',
      component: 'Plasma',
      quantity: 3,
      userId: staffUserA._id,
    });
    const refreshed10B = await BloodInventory.findById(inv10._id);
    const isCritical = refreshed10B.availableUnits === 1 && refreshed10B.status === 'Critical';

    record(
      10,
      'Status transitions accurately reflect stock levels (Low Stock <= threshold, Critical <= 1)',
      isLowStock && isCritical,
      `isLowStock=${isLowStock} (${refreshed10A.status}), isCritical=${isCritical} (${refreshed10B.status})`
    );

    // =========================================================================
    // TEST 11: Audit log generation only on success with accurate details
    // =========================================================================
    const auditRequestId = new mongoose.Types.ObjectId();
    const inv11 = await BloodInventory.create({
      hospital: testHospitalB._id,
      bloodGroup: 'B-',
      component: 'Plasma',
      totalUnits: 4,
      availableUnits: 4,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-AUDIT-11',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'Available',
    });
    createdInventoryIds.push(inv11._id);

    // Successful reservation
    await reserveBloodUnits({
      hospitalId: testHospitalB._id,
      bloodGroup: 'B-',
      component: 'Plasma',
      quantity: 2,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: auditRequestId,
      role: staffUserA.role,
    });

    const successLog = await AuditLog.findOne({
      hospital: testHospitalB._id,
      action: 'BLOOD_RESERVED',
      'details.requestId': auditRequestId,
    });
    if (successLog) createdAuditLogIds.push(successLog._id);

    // Failed reservation (asking for 10 when only 2 remain)
    const failRequestId = new mongoose.Types.ObjectId();
    await reserveBloodUnits({
      hospitalId: testHospitalB._id,
      bloodGroup: 'B-',
      component: 'Plasma',
      quantity: 10,
      userId: staffUserA._id,
      userName: staffUserA.name,
      requestId: failRequestId,
      role: staffUserA.role,
    });

    const failLog = await AuditLog.findOne({
      hospital: testHospitalB._id,
      action: 'BLOOD_RESERVED',
      'details.requestId': failRequestId,
    });

    record(
      11,
      'Audit log BLOOD_RESERVED created on successful reservation and omitted on failed reservation',
      !!successLog &&
      successLog.details.unitsReserved === 2 &&
      successLog.details.remainingAvailable === 2 &&
      !failLog,
      `successLog=${!!successLog}, failLog=${!!failLog}`
    );

    // =========================================================================
    // TEST 12: API endpoint integration — POST /api/blood-requests/:id/accept
    // Concurrent race against single available unit
    // =========================================================================
    const inv12 = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'O+',
      component: 'Whole Blood',
      totalUnits: 1,
      availableUnits: 1,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 1,
      batchId: 'BATCH-API-ACCEPT-12',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'Critical',
    });
    createdInventoryIds.push(inv12._id);

    // Create 2 Blood Requests for 1 unit of O+ Whole Blood at Hospital A
    const bloodReq12A = await BloodRequest.create({
      requestId: 'BR-CONCUR-12A-' + Date.now(),
      requestType: 'BLOOD',
      patient: {
        name: 'Patient Concur 12A',
        age: 35,
        gender: 'Male',
        contactPhone: '9830099991',
      },
      requester: {
        userId: citizenUser._id,
        user: citizenUser._id,
        name: citizenUser.name,
        contact: citizenUser.email,
        role: 'USER',
        relationshipToPatient: 'Self',
      },
      bloodRequirement: {
        bloodGroup: 'O+',
        component: 'Whole Blood',
        quantity: 1,
        urgency: 'EMERGENCY',
      },
      recipients: [
        {
          hospital: testHospitalA._id,
          status: 'PENDING',
          reservedUnits: 0,
        },
      ],
      reason: 'Urgent transfusion required',
    });
    createdBloodRequestIds.push(bloodReq12A._id);

    const bloodReq12B = await BloodRequest.create({
      requestId: 'BR-CONCUR-12B-' + Date.now(),
      requestType: 'BLOOD',
      patient: {
        name: 'Patient Concur 12B',
        age: 40,
        gender: 'Female',
        contactPhone: '9830099992',
      },
      requester: {
        userId: citizenUser._id,
        user: citizenUser._id,
        name: citizenUser.name,
        contact: citizenUser.email,
        role: 'USER',
        relationshipToPatient: 'Family Member',
      },
      bloodRequirement: {
        bloodGroup: 'O+',
        component: 'Whole Blood',
        quantity: 1,
        urgency: 'EMERGENCY',
      },
      recipients: [
        {
          hospital: testHospitalA._id,
          status: 'PENDING',
          reservedUnits: 0,
        },
      ],
      reason: 'Urgent surgery requirement',
    });
    createdBloodRequestIds.push(bloodReq12B._id);

    // Fire 2 concurrent POST /api/blood-requests/:id/accept requests
    const [apiRes12A, apiRes12B] = await Promise.all([
      requestJson(`${BASE_URL}/blood-requests/${bloodReq12A._id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffTokenA}`,
        },
      }),
      requestJson(`${BASE_URL}/blood-requests/${bloodReq12B._id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffTokenA}`,
        },
      }),
    ]);

    const refreshed12Inv = await BloodInventory.findById(inv12._id);
    const statuses = [apiRes12A.status, apiRes12B.status].sort();
    const apiOnePassOneFail = statuses[0] === 200 && statuses[1] === 400;
    const invExactlyOneReserved = refreshed12Inv.availableUnits === 0 && refreshed12Inv.reservedUnits === 1;

    record(
      12,
      'POST /api/blood-requests/:id/accept concurrent race: exactly 1 returns 200, exactly 1 returns 400',
      apiOnePassOneFail && invExactlyOneReserved,
      `statuses=${statuses.join(',')}, availableUnits=${refreshed12Inv.availableUnits}, reservedUnits=${refreshed12Inv.reservedUnits}`
    );

    // =========================================================================
    // TEST 13: Partial accept endpoint integration
    // =========================================================================
    const inv13 = await BloodInventory.create({
      hospital: testHospitalA._id,
      bloodGroup: 'B-',
      component: 'Platelets',
      totalUnits: 3,
      availableUnits: 3,
      reservedUnits: 0,
      usedUnits: 0,
      expiredUnits: 0,
      minThreshold: 2,
      batchId: 'BATCH-PARTIAL-13',
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'Low Stock',
    });
    createdInventoryIds.push(inv13._id);

    const bloodReq13 = await BloodRequest.create({
      requestId: 'BR-CONCUR-13-' + Date.now(),
      requestType: 'BLOOD',
      patient: {
        name: 'Patient Concur 13',
        age: 28,
        gender: 'Male',
        contactPhone: '9830099993',
      },
      requester: {
        userId: citizenUser._id,
        user: citizenUser._id,
        name: citizenUser.name,
        contact: citizenUser.email,
        role: 'USER',
        relationshipToPatient: 'Self',
      },
      bloodRequirement: {
        bloodGroup: 'B-',
        component: 'Platelets',
        quantity: 5, // Citizen asked for 5, but hospital only has 3
        urgency: 'URGENT',
      },
      recipients: [
        {
          hospital: testHospitalA._id,
          status: 'PENDING',
          reservedUnits: 0,
        },
      ],
      reason: 'Partial transfusion test',
    });
    createdBloodRequestIds.push(bloodReq13._id);

    // Step A: Attempt partial accept with quantity greater than available stock (4 > 3) -> HTTP 400
    const apiRes13Fail = await requestJson(`${BASE_URL}/blood-requests/${bloodReq13._id}/partial-accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffTokenA}`,
      },
      body: JSON.stringify({ availableUnits: 4, notes: 'Trying to reserve 4 when only 3 exist' }),
    });

    // Step B: Partial accept with valid quantity (2 <= 3) -> HTTP 200
    const apiRes13Pass = await requestJson(`${BASE_URL}/blood-requests/${bloodReq13._id}/partial-accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffTokenA}`,
      },
      body: JSON.stringify({ availableUnits: 2, notes: 'Offering 2 units now' }),
    });

    const refreshed13Inv = await BloodInventory.findById(inv13._id);
    record(
      13,
      'POST /api/blood-requests/:id/partial-accept rejects over-allocation (400) and atomically reserves valid partial qty (200)',
      apiRes13Fail.status === 400 &&
      apiRes13Pass.status === 200 &&
      refreshed13Inv.availableUnits === 1 &&
      refreshed13Inv.reservedUnits === 2,
      `failStatus=${apiRes13Fail.status}, passStatus=${apiRes13Pass.status}, dbAvailable=${refreshed13Inv.availableUnits}, dbReserved=${refreshed13Inv.reservedUnits}`
    );

    // =========================================================================
    // TEST 14: Data cleanup and invariant verification in finally
    // =========================================================================
    // Will be recorded in finally block
  } catch (err) {
    console.error('Unexpected error in Concur01B test runner:', err);
    failed++;
  } finally {
    console.log('\n--- CLEANING UP TEST FIXTURES ---');

    let cleanupErrors = 0;
    try {
      if (createdBloodRequestIds.length > 0) {
        const res = await BloodRequest.deleteMany({ _id: { $in: createdBloodRequestIds } });
        console.log(`  Cleaned up ${res.deletedCount} test BloodRequests`);
      }
      if (createdInventoryIds.length > 0) {
        const res = await BloodInventory.deleteMany({ _id: { $in: createdInventoryIds } });
        console.log(`  Cleaned up ${res.deletedCount} test BloodInventories`);
      }
      if (createdAuditLogIds.length > 0) {
        const res = await AuditLog.deleteMany({ _id: { $in: createdAuditLogIds } });
        console.log(`  Cleaned up ${res.deletedCount} test AuditLogs`);
      }
      // Also clean up any AuditLogs created for our test hospitals
      if (createdHospitalIds.length > 0) {
        const resLogs = await AuditLog.deleteMany({ hospital: { $in: createdHospitalIds } });
        console.log(`  Cleaned up ${resLogs.deletedCount} additional test hospital AuditLogs`);
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
    const remainingInventories = await BloodInventory.countDocuments({ _id: { $in: createdInventoryIds } });
    const remainingRequests = await BloodRequest.countDocuments({ _id: { $in: createdBloodRequestIds } });
    const remainingUsers = await User.countDocuments({ _id: { $in: createdUserIds } });

    const cleanupSuccess = cleanupErrors === 0 &&
      remainingHospitals === 0 &&
      remainingInventories === 0 &&
      remainingRequests === 0 &&
      remainingUsers === 0;

    record(
      14,
      'Guaranteed test cleanup: all created test records deleted leaving 0 orphan records',
      cleanupSuccess,
      `cleanupErrors=${cleanupErrors}, remHosp=${remainingHospitals}, remInv=${remainingInventories}, remReq=${remainingRequests}, remUsers=${remainingUsers}`
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
    console.log(`SEC3-CONCUR-01B TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  runConcur01BTests()
    .then(() => {
      console.log('SEC3-CONCUR-01B suite completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}

module.exports = runConcur01BTests;
