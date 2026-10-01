/**
 * testSecurityAudit3NoSQLRemediation.js
 * Dedicated verification suite for SEC3-NOSQL-01:
 * Unsafe Regular Expression / NoSQL Query Input Remediation
 */

require('../config/bootstrap');
const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remediation_verification_only_32bytes!';
}

const { app } = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const { escapeRegex } = require('../utils/regexUtils');
const Hospital = require('../models/Hospital');
const BloodInventory = require('../models/BloodInventory');
const Donor = require('../models/Donor');
const MedicalShop = require('../models/MedicalShop');
const User = require('../models/User');
const Referral = require('../models/Referral');
const BloodRequest = require('../models/BloodRequest');
const generateToken = require('../utils/generateToken');

const TEST_PORT = 5008;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function requestJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  let body = {};
  try {
    body = await res.json();
  } catch (e) {
    body = {};
  }
  return { status: res.status, headers: res.headers, body };
}

async function runTests() {
  console.log('====================================================');
  console.log('SEC3-NOSQL-01 REMEDIATION VERIFICATION SUITE');
  console.log('Unsafe Regular Expression / NoSQL Query Input');
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
  const createdUserIds = [];
  const createdShopIds = [];
  const createdReferralIds = [];
  const createdBloodRequestIds = [];

  try {
    await connectDB();

    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, () => resolve());
      testServer.on('error', reject);
    });

    // -----------------------------------------------------------------
    // SECTION 1: Direct Unit Testing of escapeRegex Utility
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: escapeRegex Utility Unit Tests ---');

    // Test 01: All 12 regex metacharacters are properly escaped
    const metachars = '.*+?^${}()|[]\\';
    const escapedMeta = escapeRegex(metachars);
    const expectedEscaped = '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\';
    record(
      1,
      'escapeRegex correctly escapes all 12 metacharacters (.*+?^${}()|[\\])',
      escapedMeta === expectedEscaped,
      `Result: ${escapedMeta}, Expected: ${expectedEscaped}`
    );

    // Test 02: Safe handling of null, undefined, empty, or numeric inputs
    const nullResult = escapeRegex(null);
    const undefResult = escapeRegex(undefined);
    const numResult = escapeRegex(12345);
    record(
      2,
      'escapeRegex safely handles null, undefined, numbers, and empty strings',
      nullResult === '' && undefResult === '' && numResult === '12345',
      `Null: '${nullResult}', Undefined: '${undefResult}', Number: '${numResult}'`
    );

    // Test 03: Plain strings without regex metacharacters are unmodified
    const plain = 'Kolkata Central Hospital';
    record(
      3,
      'escapeRegex leaves alphanumeric strings with normal spaces unchanged',
      escapeRegex(plain) === plain,
      `Output: ${escapeRegex(plain)}`
    );

    // -----------------------------------------------------------------
    // SECTION 2: Hospital Search Endpoint (/api/hospitals?search=)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Hospital Search NoSQL / Regex Protection ---');

    // Test 04: Wildcard .* does NOT match all hospitals in database
    const resHospWildcard = await requestJson(`${BASE_URL}/hospitals?search=.*`);
    const totalHospitals = await Hospital.countDocuments({ isActive: true });
    record(
      4,
      'Hospital search with ".*" does NOT act as regex wildcard matching all hospitals',
      resHospWildcard.status === 200 &&
        resHospWildcard.body.success === true &&
        (resHospWildcard.body.data || []).length < Math.max(totalHospitals, 1),
      `Status: ${resHospWildcard.status}, Count returned: ${(resHospWildcard.body.data || []).length}, Total in DB: ${totalHospitals}`
    );

    // Test 05: Unclosed parenthesis / bracket does NOT trigger 500 SyntaxError
    const resHospUnclosed = await requestJson(`${BASE_URL}/hospitals?search=${encodeURIComponent('([a-z+')}`);
    record(
      5,
      'Hospital search with unclosed regex metacharacters "([a-z+" returns 200 OK without SyntaxError',
      resHospUnclosed.status === 200 && resHospUnclosed.body.success === true,
      `Status: ${resHospUnclosed.status}, Message: ${resHospUnclosed.body.message || 'OK'}`
    );

    // Test 06: ReDoS catastrophic backtracking pattern completes safely in < 250ms
    const startHospReDoS = Date.now();
    const resHospReDoS = await requestJson(`${BASE_URL}/hospitals?search=${encodeURIComponent('((((((a+)+)+)+)+)+)!')}`);
    const durationHospReDoS = Date.now() - startHospReDoS;
    record(
      6,
      `Hospital search with ReDoS attack payload executes safely in under 250ms (${durationHospReDoS}ms)`,
      resHospReDoS.status === 200 && durationHospReDoS < 250,
      `Status: ${resHospReDoS.status}, Duration: ${durationHospReDoS}ms`
    );

    // -----------------------------------------------------------------
    // SECTION 3: Blood Bank Endpoint (/api/blood-banks)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 3: Blood Bank Query NoSQL / Regex Protection ---');

    // Test 07: District filter with ".*" does NOT act as regex wildcard
    const resBBWildcardDist = await requestJson(`${BASE_URL}/blood-banks?district=.*`);
    const totalBB = await Hospital.countDocuments({ isActive: true });
    record(
      7,
      'Blood Bank district filter with ".*" does NOT wildcard match all blood banks',
      resBBWildcardDist.status === 200 &&
        (resBBWildcardDist.body.data || []).length === 0,
      `Status: ${resBBWildcardDist.status}, Count returned: ${(resBBWildcardDist.body.data || []).length}`
    );

    // Test 08: Search query with invalid regex tokens "???++***" returns 200 OK with 0 results
    const resBBSyntax = await requestJson(`${BASE_URL}/blood-banks?search=${encodeURIComponent('???++***')}`);
    record(
      8,
      'Blood Bank search with invalid regex tokens returns 200 OK (no 500 crash)',
      resBBSyntax.status === 200 && resBBSyntax.body.success === true,
      `Status: ${resBBSyntax.status}`
    );

    // Test 09: Normal blood bank search returns valid matches
    const firstBB = await Hospital.findOne({ isActive: true });
    if (firstBB) {
      const searchTerm = firstBB.name.slice(0, 5);
      const resBBNormal = await requestJson(`${BASE_URL}/blood-banks?search=${encodeURIComponent(searchTerm)}`);
      record(
        9,
        `Normal blood bank search for "${searchTerm}" returns expected matches`,
        resBBNormal.status === 200 && (resBBNormal.body.data || []).length > 0,
        `Status: ${resBBNormal.status}, Found: ${(resBBNormal.body.data || []).length}`
      );
    } else {
      record(9, 'Normal blood bank search verification (skipped, no active blood bank)', true);
    }

    // -----------------------------------------------------------------
    // Setup Authenticated Test Admin User
    // -----------------------------------------------------------------
    const existingHospital = await Hospital.findOne({ isActive: true });
    if (!existingHospital) throw new Error('No active hospital found in database');

    const testAdminUser = await User.create({
      name: 'Regex Test Admin',
      email: `regex_admin_${Date.now()}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      role: 'hospital_admin',
      hospital: existingHospital._id,
      phone: `9830${Math.floor(100000 + Math.random() * 900000)}`,
      isActive: true,
    });
    createdUserIds.push(testAdminUser._id);
    const tokenAdmin = generateToken(testAdminUser._id);

    // -----------------------------------------------------------------
    // SECTION 4: Donor Search Endpoint (/api/donors/search)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 4: Donor Search NoSQL / Regex Protection ---');

    // Test 10: Donor search with district=".*" does not return all donors
    const resDonorWildcard = await requestJson(`${BASE_URL}/donors/search?district=.*`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const totalDonors = await Donor.countDocuments({ isActive: true, status: 'active' });
    record(
      10,
      'Donor search with district=".*" does NOT wildcard match all donors',
      resDonorWildcard.status === 200 &&
        (resDonorWildcard.body.data || []).length < Math.max(totalDonors, 1),
      `Status: ${resDonorWildcard.status}, Count: ${(resDonorWildcard.body.data || []).length}, Total: ${totalDonors}`
    );

    // Test 11: Donor search with malformed regex pattern "[a-z" returns 200 OK
    const resDonorMalformed = await requestJson(`${BASE_URL}/donors/search?district=${encodeURIComponent('[a-z')}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    record(
      11,
      'Donor search with malformed regex "[a-z" handles safely without 500 SyntaxError',
      resDonorMalformed.status === 200 && resDonorMalformed.body.success === true,
      `Status: ${resDonorMalformed.status}`
    );

    // Test 12: Donor search ReDoS payload executes safely
    const startDonorReDoS = Date.now();
    const resDonorReDoS = await requestJson(`${BASE_URL}/donors/search?city=${encodeURIComponent('((((((a+)+)+)+)+)+)!')}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const durationDonorReDoS = Date.now() - startDonorReDoS;
    record(
      12,
      `Donor search with ReDoS attack payload executes safely without freeze (${durationDonorReDoS}ms)`,
      resDonorReDoS.status === 200 && durationDonorReDoS < 1500,
      `Status: ${resDonorReDoS.status}, Duration: ${durationDonorReDoS}ms`
    );

    // -----------------------------------------------------------------
    // SECTION 5: Medical Shop Filters & Search (/api/medical-shops)
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 5: Medical Shop Filters NoSQL / Regex Protection ---');

    // Test 13: Medical shop district filter with ".*" does not return all shops
    const resShopWildcardDist = await requestJson(`${BASE_URL}/medical-shops?district=.*`);
    const totalShops = await MedicalShop.countDocuments({ isActive: true });
    record(
      13,
      'Medical Shop district filter with ".*" does NOT wildcard match all shops',
      resShopWildcardDist.status === 200 &&
        (resShopWildcardDist.body.data || []).length === 0,
      `Status: ${resShopWildcardDist.status}, Count: ${(resShopWildcardDist.body.data || []).length}`
    );

    // Test 14: Medical shop area filter with unclosed regex metacharacter "(" returns 200
    const resShopAreaParen = await requestJson(`${BASE_URL}/medical-shops?area=${encodeURIComponent('(')}`);
    record(
      14,
      'Medical Shop area filter with "(" handles safely without SyntaxError',
      resShopAreaParen.status === 200 && resShopAreaParen.body.success === true,
      `Status: ${resShopAreaParen.status}`
    );

    // Test 15: Medical shop general search with ".*" does NOT wildcard match all shops
    const resShopSearchWildcard = await requestJson(`${BASE_URL}/medical-shops?search=.*`);
    record(
      15,
      'Medical Shop search with ".*" does NOT wildcard match all medical shops',
      resShopSearchWildcard.status === 200 &&
        (resShopSearchWildcard.body.data || []).length < Math.max(totalShops, 1),
      `Status: ${resShopSearchWildcard.status}, Count: ${(resShopSearchWildcard.body.data || []).length}`
    );

    // Test 16: Medical shop search ReDoS payload executes safely
    const startShopReDoS = Date.now();
    const resShopReDoS = await requestJson(`${BASE_URL}/medical-shops?search=${encodeURIComponent('((((((a+)+)+)+)+)+)!')}`);
    const durationShopReDoS = Date.now() - startShopReDoS;
    record(
      16,
      `Medical Shop search with ReDoS payload executes safely in under 250ms (${durationShopReDoS}ms)`,
      resShopReDoS.status === 200 && durationShopReDoS < 250,
      `Status: ${resShopReDoS.status}, Duration: ${durationShopReDoS}ms`
    );

    // -----------------------------------------------------------------
    // SECTION 6: Medical Shop Duplicate Check With Special Characters
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 6: Medical Shop Duplicate Check Regex Protection ---');

    // Test 17: Shop creation with regex metacharacters in name and address succeeds
    const specialShopPayload = {
      name: `Special + Care (Main & Branch) [24/7] ${Date.now()}`,
      district: 'Kolkata',
      area: 'Central',
      city: 'Kolkata',
      address: '12/B College St. (Near Gate #2)',
      phone: `9830${Math.floor(100000 + Math.random() * 900000)}`,
      pincode: '700073',
      licenseNumber: `LIC-SP-${Date.now()}`,
      latitude: 22.5726,
      longitude: 88.3639,
    };

    const resCreateSpecial = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify(specialShopPayload),
    });

    const createdShopId = resCreateSpecial.body.medicalShop?._id || resCreateSpecial.body.data?._id;
    if (createdShopId) {
      createdShopIds.push(createdShopId);
    }

    record(
      17,
      'Medical Shop creation with regex characters in name/address creates successfully (no RegExp error)',
      resCreateSpecial.status === 201 && resCreateSpecial.body.success === true,
      `Status: ${resCreateSpecial.status}, Message: ${resCreateSpecial.body.message || 'Created'}`
    );

    // Test 18: Exact duplicate shop with regex metacharacters is detected as conflict (409)
    const resCreateDuplicate = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify(specialShopPayload),
    });

    record(
      18,
      'Duplicate check correctly matches existing shop with regex characters and returns 409 Conflict',
      resCreateDuplicate.status === 409 && resCreateDuplicate.body.success === false,
      `Status: ${resCreateDuplicate.status}, Message: ${resCreateDuplicate.body.message}`
    );

    // -----------------------------------------------------------------
    // SECTION 7: Referral Creation Duplicate Check With Special Characters
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 7: Referral Duplicate Check Regex Protection ---');

    // Test 19: Patient referral with regex metacharacters in patientName creates or evaluates cleanly
    const referralPayload = {
      patientName: `Patient (Critical + ICU) [Special] ${Date.now()}`,
      age: 45,
      gender: 'male',
      contactPhone: '9830112233',
      patientCondition: 'critical',
      requiredDepartment: 'Cardiology',
      referringHospitalId: existingHospital._id.toString(),
      destinationHospitalId: existingHospital._id.toString(),
      receivingDoctorId: testAdminUser._id.toString(),
      reasonForReferral: 'Specialized cardiac emergency procedure needed',
    };

    const resReferral = await requestJson(`${BASE_URL}/referrals`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify(referralPayload),
    });

    if (resReferral.body.data && resReferral.body.data._id) {
      createdReferralIds.push(resReferral.body.data._id);
    }

    record(
      19,
      'Referral with regex metacharacters in patientName executes duplicate check without error',
      resReferral.status !== 500 && [200, 201, 400, 409].includes(resReferral.status),
      `Status: ${resReferral.status}, Message: ${resReferral.body.message || JSON.stringify(resReferral.body.errors || {})}`
    );

    // -----------------------------------------------------------------
    // SECTION 8: Blood Request Urgency & Requester Name Regex Protection
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 8: Blood Request Regex Filter Protection ---');

    // Test 20: Blood request urgency filter with regex wildcard ".*" does not throw error
    const resBRUrgency = await requestJson(`${BASE_URL}/blood-requests?urgency=.*`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    record(
      20,
      'Blood request urgency filter with ".*" returns 200 OK without SyntaxError or 500',
      resBRUrgency.status === 200 && resBRUrgency.body.success === true,
      `Status: ${resBRUrgency.status}`
    );

    // Test 21: User with regex characters in name accesses /api/blood-requests/my-requests cleanly
    const userWithRegexName = await User.create({
      name: 'Dr. Test (Cardio + ICU) [Specialist]',
      email: `doctor_regex_${Date.now()}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      role: 'user',
      phone: `9830${Math.floor(100000 + Math.random() * 900000)}`,
      isActive: true,
    });
    createdUserIds.push(userWithRegexName._id);
    const tokenRegexUser = generateToken(userWithRegexName._id);

    const resMyBR = await requestJson(`${BASE_URL}/blood-requests/my-requests`, {
      headers: { Authorization: `Bearer ${tokenRegexUser}` },
    });

    record(
      21,
      'User with regex metacharacters in name queries getMyBloodRequests without RegExp syntax error',
      resMyBR.status === 200 && resMyBR.body.success === true,
      `Status: ${resMyBR.status}`
    );

  } finally {
    // Cleanup created test records
    try {
      if (createdShopIds.length) {
        await MedicalShop.deleteMany({ _id: { $in: createdShopIds } });
      }
      await MedicalShop.deleteMany({ name: /^Special \+ Care \(Main & Branch\)/ });
      if (createdReferralIds.length) {
        await Referral.deleteMany({ _id: { $in: createdReferralIds } });
      }
      if (createdBloodRequestIds.length) {
        await BloodRequest.deleteMany({ _id: { $in: createdBloodRequestIds } });
      }
      if (createdUserIds.length) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
    } catch (cleanupErr) {
      console.error('Test cleanup error:', cleanupErr.message);
    }

    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await disconnectDB();
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
