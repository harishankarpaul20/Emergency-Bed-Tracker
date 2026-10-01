/**
 * testSecurityAudit3Concur01GRemediation.js
 * Dedicated verification suite for SEC3-CONCUR-01G:
 * Manual Bed Counter Stale-Write Race Remediation
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
const Bed = require('../models/Bed');
const generateToken = require('../utils/generateToken');

const TEST_PORT = 5018;
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

async function runConcur01GTests() {
  console.log('====================================================');
  console.log('SEC3-CONCUR-01G REMEDIATION VERIFICATION SUITE');
  console.log('Manual Bed Counter Stale-Write Race Remediation');
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
  const createdBedIds = [];

  try {
    // 1. Connect DB
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);

    // 2. Start HTTP Test Server
    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, '127.0.0.1', () => resolve());
      testServer.on('error', reject);
    });
    console.log(`✅ Test server running on port ${TEST_PORT}\n`);

    const ts = Date.now();

    // 3. Create Hospital A
    const hospitalA = await Hospital.create({
      name: 'Bed Concur Hosp A ' + ts,
      registrationId: 'WB-BED-A-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'government',
      address: '10 Bed Clinic Road',
      area: 'Kolkata North',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      phone: '9830001111',
      email: `bed_hosp_a_${ts}@concur01g.com`,
      latitude: 22.5726,
      longitude: 88.3639,
      location: { type: 'Point', coordinates: [88.3639, 22.5726] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalA._id);

    // 4. Create Hospital B
    const hospitalB = await Hospital.create({
      name: 'Bed Concur Hosp B ' + ts,
      registrationId: 'WB-BED-B-' + Math.floor(Math.random() * 90000 + 10000),
      hospitalType: 'private',
      address: '20 Hospital Lane',
      area: 'Kolkata South',
      district: 'Kolkata',
      state: 'West Bengal',
      pincode: '700002',
      phone: '9830002222',
      email: `bed_hosp_b_${ts}@concur01g.com`,
      latitude: 22.5800,
      longitude: 88.3700,
      location: { type: 'Point', coordinates: [88.3700, 22.5800] },
      isActive: true,
      isVerified: true,
    });
    createdHospitalIds.push(hospitalB._id);

    // 5. Create Staff Admin A (for Hospital A)
    const adminA = await User.create({
      name: 'Admin Hosp A',
      email: `admin_a_${ts}@concur01g.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: hospitalA._id,
      isActive: true,
    });
    createdUserIds.push(adminA._id);
    const tokenA = generateToken(adminA._id, adminA.role);

    // 6. Create Staff Admin B (for Hospital B)
    const adminB = await User.create({
      name: 'Admin Hosp B',
      email: `admin_b_${ts}@concur01g.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVW12345678',
      role: 'hospital_admin',
      hospital: hospitalB._id,
      isActive: true,
    });
    createdUserIds.push(adminB._id);
    const tokenB = generateToken(adminB._id, adminB.role);

    // 7. Create Test Bed for Hospital A
    const testBedA = await Bed.create({
      hospital: hospitalA._id,
      type: 'icu',
      totalBeds: 20,
      occupiedBeds: 5,
      reservedBeds: 3,
      availableBeds: 12,
    });
    createdBedIds.push(testBedA._id);

    // 8. Create Test Bed for Hospital B
    const testBedB = await Bed.create({
      hospital: hospitalB._id,
      type: 'icu',
      totalBeds: 20,
      occupiedBeds: 5,
      reservedBeds: 3,
      availableBeds: 12,
    });
    createdBedIds.push(testBedB._id);

    // -------------------------------------------------------
    // TEST 01: Baseline valid manual update succeeds
    // -------------------------------------------------------
    console.log('--- TEST 01: Baseline Valid Manual Update ---');
    const res01 = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ occupiedBeds: 6 }),
    });
    const bedAfter01 = await Bed.findById(testBedA._id);
    const is01Ok =
      res01.status === 200 &&
      bedAfter01.occupiedBeds === 6 &&
      bedAfter01.reservedBeds === 3 &&
      bedAfter01.availableBeds === 11 &&
      bedAfter01.totalBeds === 20;
    record(1, 'Baseline valid manual update succeeds (200 OK)', is01Ok,
      `Status: ${res01.status}, occ: ${bedAfter01.occupiedBeds}, avail: ${bedAfter01.availableBeds}`);

    // -------------------------------------------------------
    // TEST 02: Invalid negative counter update is rejected
    // -------------------------------------------------------
    console.log('\n--- TEST 02: Negative Counter Rejection ---');
    const res02 = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ occupiedBeds: -2 }),
    });
    const is02Ok = res02.status === 400 || res02.status === 422;
    record(2, 'Invalid negative counter update is rejected (400/422)', is02Ok, `Status: ${res02.status}`);

    // -------------------------------------------------------
    // TEST 03: Update exceeding total capacity is rejected
    // -------------------------------------------------------
    console.log('\n--- TEST 03: Exceeding Total Capacity Rejection ---');
    const res03 = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ occupiedBeds: 25 }), // 25 + 3 = 28 > 20
    });
    const is03Ok = res03.status === 400;
    const bedAfter03 = await Bed.findById(testBedA._id);
    record(3, 'Update exceeding total capacity is rejected (400)', is03Ok && bedAfter03.occupiedBeds === 6,
      `Status: ${res03.status}, occupied: ${bedAfter03.occupiedBeds}`);

    // -------------------------------------------------------
    // TEST 04: Two concurrent increments preserve both valid updates
    // -------------------------------------------------------
    console.log('\n--- TEST 04: Two Concurrent Increments (No Lost Update) ---');
    const before04 = await Bed.findById(testBedA._id);
    const startOcc04 = before04.occupiedBeds;

    const [res04A, res04B] = await Promise.all([
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: 1 }),
      }),
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: 1 }),
      }),
    ]);

    const bedAfter04 = await Bed.findById(testBedA._id);
    const is04Ok =
      res04A.status === 200 &&
      res04B.status === 200 &&
      bedAfter04.occupiedBeds === startOcc04 + 2 &&
      bedAfter04.availableBeds === bedAfter04.totalBeds - bedAfter04.occupiedBeds - bedAfter04.reservedBeds;

    record(4, 'Two concurrent increments preserve both valid updates (no lost update)', is04Ok,
      `Statuses: [${res04A.status}, ${res04B.status}], start: ${startOcc04}, end: ${bedAfter04.occupiedBeds}, avail: ${bedAfter04.availableBeds}`);

    // -------------------------------------------------------
    // TEST 05: Two concurrent decrements do not create a negative counter
    // -------------------------------------------------------
    console.log('\n--- TEST 05: Concurrent Decrements Boundary Protection ---');
    // Set occupiedBeds to exactly 1
    await Bed.findByIdAndUpdate(testBedA._id, { $set: { occupiedBeds: 1, availableBeds: 16 } });

    const [res05A, res05B] = await Promise.all([
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: -1 }),
      }),
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: -1 }),
      }),
    ]);

    const bedAfter05 = await Bed.findById(testBedA._id);
    const statuses05 = [res05A.status, res05B.status].sort();
    const is05Ok =
      statuses05[0] === 200 &&
      statuses05[1] === 400 &&
      bedAfter05.occupiedBeds === 0 &&
      bedAfter05.availableBeds >= 0;

    record(5, 'Two concurrent decrements do not create a negative counter (1 wins, 1 rejected)', is05Ok,
      `Statuses: [${res05A.status}, ${res05B.status}], occupiedBeds: ${bedAfter05.occupiedBeds}`);

    // -------------------------------------------------------
    // TEST 06: Concurrent mixed updates preserve the Bed counter invariant
    // -------------------------------------------------------
    console.log('\n--- TEST 06: Concurrent Mixed Updates Preserve Invariant ---');
    // Reset to known state
    await Bed.findByIdAndUpdate(testBedA._id, { $set: { occupiedBeds: 5, reservedBeds: 3, availableBeds: 12, totalBeds: 20 } });

    await Promise.all([
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: 2 }),
      }),
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: -1 }),
      }),
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ reservedBedsDelta: 1 }),
      }),
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ reservedBedsDelta: -1 }),
      }),
    ]);

    const bedAfter06 = await Bed.findById(testBedA._id);
    const invariant06 =
      bedAfter06.occupiedBeds >= 0 &&
      bedAfter06.reservedBeds >= 0 &&
      bedAfter06.availableBeds >= 0 &&
      bedAfter06.occupiedBeds + bedAfter06.reservedBeds <= bedAfter06.totalBeds &&
      bedAfter06.availableBeds === bedAfter06.totalBeds - bedAfter06.occupiedBeds - bedAfter06.reservedBeds;

    record(6, 'Concurrent mixed updates preserve all Bed counter invariants strictly', invariant06,
      `total: ${bedAfter06.totalBeds}, occ: ${bedAfter06.occupiedBeds}, res: ${bedAfter06.reservedBeds}, avail: ${bedAfter06.availableBeds}`);

    // -------------------------------------------------------
    // TEST 07: A stale update cannot overwrite a newer counter state
    // -------------------------------------------------------
    console.log('\n--- TEST 07: Stale Update Rejection via Version Control ---');
    const freshBed07 = await Bed.findById(testBedA._id);
    const staleVersion = freshBed07.__v;

    // First update succeeds and increments version
    const res07A = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ occupiedBeds: freshBed07.occupiedBeds + 1, version: staleVersion }),
    });

    // Second update sends stale version
    const res07B = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ occupiedBeds: 2, version: staleVersion }),
    });

    const bedAfter07 = await Bed.findById(testBedA._id);
    const is07Ok =
      res07A.status === 200 &&
      res07B.status === 409 &&
      bedAfter07.occupiedBeds === freshBed07.occupiedBeds + 1;

    record(7, 'A stale update cannot overwrite a newer counter state (409 Conflict)', is07Ok,
      `resA: ${res07A.status}, resB: ${res07B.status}, currentOcc: ${bedAfter07.occupiedBeds}`);

    // -------------------------------------------------------
    // TEST 08: Unauthorized user cannot modify another hospital Bed
    // -------------------------------------------------------
    console.log('\n--- TEST 08: Tenant Authorization Boundary ---');
    const res08 = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` }, // Admin B targeting Hospital A bed
      body: JSON.stringify({ occupiedBeds: 10 }),
    });
    const bedAfter08 = await Bed.findById(testBedA._id);
    const is08Ok = res08.status === 403 && bedAfter08.occupiedBeds === bedAfter07.occupiedBeds;
    record(8, 'Unauthorized user cannot modify another hospital Bed (403 Forbidden)', is08Ok,
      `Status: ${res08.status}, occupied: ${bedAfter08.occupiedBeds}`);

    // -------------------------------------------------------
    // TEST 09: PUT /api/beds/:id updates totalBeds, occupiedBeds, reservedBeds
    // -------------------------------------------------------
    console.log('\n--- TEST 09: Full Bed Inventory PUT Update ---');
    const freshBed09 = await Bed.findById(testBedA._id);
    const res09 = await requestJson(`${BASE_URL}/beds/${testBedA._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        totalBeds: 25,
        occupiedBeds: 10,
        reservedBeds: 2,
        version: freshBed09.__v,
      }),
    });
    const bedAfter09 = await Bed.findById(testBedA._id);
    const is09Ok =
      res09.status === 200 &&
      bedAfter09.totalBeds === 25 &&
      bedAfter09.occupiedBeds === 10 &&
      bedAfter09.reservedBeds === 2 &&
      bedAfter09.availableBeds === 13;
    record(9, 'PUT /api/beds/:id updates all counters and recalculates availableBeds (200 OK)', is09Ok,
      `Status: ${res09.status}, total: ${bedAfter09.totalBeds}, occ: ${bedAfter09.occupiedBeds}, avail: ${bedAfter09.availableBeds}`);

    // -------------------------------------------------------
    // TEST 10: PUT /api/beds/:id with stale version is rejected
    // -------------------------------------------------------
    console.log('\n--- TEST 10: PUT Stale Version Rejection ---');
    const res10 = await requestJson(`${BASE_URL}/beds/${testBedA._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        totalBeds: 30,
        occupiedBeds: 5,
        reservedBeds: 0,
        version: freshBed09.__v, // Stale version! (was incremented by Test 09)
      }),
    });
    const is10Ok = res10.status === 409;
    record(10, 'PUT /api/beds/:id with stale version is rejected with 409 Conflict', is10Ok, `Status: ${res10.status}`);

    // -------------------------------------------------------
    // TEST 11: LOST-UPDATE TEST (Classic Read-Modify-Write Race)
    // -------------------------------------------------------
    console.log('\n--- TEST 11: Lost-Update Race Simulation ---');
    // Set known starting state
    await Bed.findByIdAndUpdate(testBedA._id, {
      $set: { totalBeds: 20, occupiedBeds: 5, reservedBeds: 3, availableBeds: 12 },
    });

    // Simulate:
    // Request A reads current state
    const readA = await Bed.findById(testBedA._id);
    // Request B reads current state
    const readB = await Bed.findById(testBedA._id);

    // Request A modifies occupiedBeds = 8 and saves
    readA.occupiedBeds = 8;
    await readA.save();

    // Request B attempts to save its stale state (occupiedBeds = 4)
    let bThrewOCC = false;
    try {
      readB.occupiedBeds = 4;
      await readB.save();
    } catch (occErr) {
      if (occErr.name === 'VersionError') {
        bThrewOCC = true;
      }
    }

    const bedAfter11 = await Bed.findById(testBedA._id);
    const is11Ok = bThrewOCC && bedAfter11.occupiedBeds === 8;

    record(11, 'Lost-Update Test: Request B cannot silently overwrite newer values from Request A', is11Ok,
      `B threw VersionError: ${bThrewOCC}, Final occupiedBeds: ${bedAfter11.occupiedBeds} (expected 8)`);

    // -------------------------------------------------------
    // TEST 12: CONCURRENT STRESS TEST (10 Simultaneous Delta Increments)
    // -------------------------------------------------------
    console.log('\n--- TEST 12: Concurrent Stress Test (10 Deltas, No Lost Updates) ---');
    // Reset to 0 occupied on 20 total beds
    await Bed.findByIdAndUpdate(testBedA._id, {
      $set: { totalBeds: 20, occupiedBeds: 0, reservedBeds: 0, availableBeds: 20 },
    });

    const stressPromises = Array.from({ length: 10 }, () =>
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: 1 }),
      })
    );

    const stressResponses = await Promise.all(stressPromises);
    const successCount12 = stressResponses.filter(r => r.status === 200).length;
    const bedAfter12 = await Bed.findById(testBedA._id);

    const is12Ok =
      successCount12 === 10 &&
      bedAfter12.occupiedBeds === 10 &&
      bedAfter12.availableBeds === 10 &&
      bedAfter12.occupiedBeds + bedAfter12.availableBeds === bedAfter12.totalBeds;

    record(12, 'Stress Test: 10 concurrent increments result in exactly 10 applied (0 lost updates)', is12Ok,
      `Successes: ${successCount12}/10, Final occupied: ${bedAfter12.occupiedBeds}, avail: ${bedAfter12.availableBeds}`);

    // -------------------------------------------------------
    // TEST 13: High-concurrency stress test near capacity boundary
    // -------------------------------------------------------
    console.log('\n--- TEST 13: High-Concurrency Capacity Boundary Stress Test ---');
    // Set bed to 16 occupied out of 20 (only 4 beds available)
    await Bed.findByIdAndUpdate(testBedA._id, {
      $set: { totalBeds: 20, occupiedBeds: 16, reservedBeds: 0, availableBeds: 4 },
    });

    // Fire 10 concurrent increments of 1 bed
    const boundaryPromises = Array.from({ length: 10 }, () =>
      requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ occupiedBedsDelta: 1 }),
      })
    );

    const boundaryResponses = await Promise.all(boundaryPromises);
    const wins13 = boundaryResponses.filter(r => r.status === 200).length;
    const fails13 = boundaryResponses.filter(r => r.status === 400).length;
    const bedAfter13 = await Bed.findById(testBedA._id);

    const is13Ok =
      wins13 === 4 &&
      fails13 === 6 &&
      bedAfter13.occupiedBeds === 20 &&
      bedAfter13.availableBeds === 0;

    record(13, 'Boundary Stress: exactly 4 succeed, 6 rejected, capacity never exceeded', is13Ok,
      `Wins: ${wins13}, Fails: ${fails13}, Final occupied: ${bedAfter13.occupiedBeds}, avail: ${bedAfter13.availableBeds}`);

    // -------------------------------------------------------
    // TEST 14: Response structure does not leak MongoDB internal error details
    // -------------------------------------------------------
    console.log('\n--- TEST 14: Sensitive Database Leakage Prevention ---');
    const leakRes = await requestJson(`${BASE_URL}/beds/${testBedA._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ occupiedBeds: 2, version: 999999 }),
    });
    const leakBodyStr = JSON.stringify(leakRes.body || {});
    const noDbLeak =
      !leakBodyStr.includes('MongoServerError') &&
      !leakBodyStr.includes('VersionError') &&
      !leakBodyStr.includes('collection') &&
      !leakBodyStr.includes('keyPattern');
    record(14, 'Conflict response does not leak internal MongoDB stack traces or collection details',
      leakRes.status === 409 && noDbLeak,
      `Status: ${leakRes.status}, Body: ${leakBodyStr.substring(0, 150)}`);

    // -------------------------------------------------------
    // TEST 15: Teardown & Guaranteed Database Cleanup
    // -------------------------------------------------------
    console.log('\n--- TEST 15: Teardown & Guaranteed Database Cleanup ---');

  } catch (err) {
    console.error('❌ UNHANDLED TEST ERROR:', err);
    failed++;
  } finally {
    // Teardown
    try {
      for (const id of createdBedIds) {
        await Bed.deleteOne({ _id: id });
      }
      for (const id of createdUserIds) {
        await User.deleteOne({ _id: id });
      }
      for (const id of createdHospitalIds) {
        await Hospital.deleteOne({ _id: id });
      }

      const orphanBeds = await Bed.countDocuments({ _id: { $in: createdBedIds } });
      const orphanUsers = await User.countDocuments({ _id: { $in: createdUserIds } });
      const orphanHosps = await Hospital.countDocuments({ _id: { $in: createdHospitalIds } });

      const cleanupOk = orphanBeds === 0 && orphanUsers === 0 && orphanHosps === 0;
      if (cleanupOk) {
        process.stdout.write(`  [PASS] Test 15: Database cleanup verified (0 orphan beds, 0 orphan users, 0 orphan hospitals)\n`);
        passed++;
      } else {
        process.stderr.write(`  [FAIL] Test 15: Cleanup incomplete (Beds: ${orphanBeds}, Users: ${orphanUsers}, Hosps: ${orphanHosps})\n`);
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

runConcur01GTests();
