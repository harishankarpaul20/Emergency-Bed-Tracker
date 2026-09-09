/**
 * ======================================================================
 * HOSPITAL-SPECIFIC STAFF ADMIN AUTHENTICATION, AUTHORIZATION & PERSISTENCE TEST SUITE
 * ======================================================================
 * Verifies all 18+ test requirements:
 * - Dynamic hospital loading from MongoDB (single source of truth)
 * - Hospital admin isolation (strict 403 on cross-hospital operations)
 * - Super admin global powers & staff administration APIs
 * - Protection against ID / URL manipulation
 * - Secure password hashing & duplicate email rejection
 * - Verified persistence in MongoDB Atlas
 * - Preservation of public search features
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

const TEST_PORT = 5002;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

const testResults = [];
function logTest(num, name, passed, detail = '') {
  testResults.push({ num, name, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [TEST ${num.toString().padStart(2, '0')}] ${name}${detail ? ` (${detail})` : ''}`);
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

async function runStaffAuthTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING HOSPITAL-SPECIFIC STAFF AUTH & AUTHORIZATION SUITE');
  console.log(`📡 API Target: ${BASE_URL}`);
  console.log('======================================================\n');

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
  await connectDB();

  let superAdminToken = '';
  let apolloAdminToken = '';
  let secondAdminToken = '';

  let hospitalA = null; // Apollo Multispeciality Hospitals
  let hospitalB = null; // Second hospital (e.g. Ruby General Hospital)
  let hospitalABed = null;
  let hospitalBBed = null;

  let requestForHospitalA = null;
  let requestForHospitalB = null;

  try {
    // PREPARATION: Dynamically retrieve existing hospitals from MongoDB Atlas
    const allHospitals = await Hospital.find({ isActive: true }).sort({ name: 1 });
    hospitalA = allHospitals.find(h => h.name.includes('Apollo')) || allHospitals[0];
    hospitalB = allHospitals.find(h => h._id.toString() !== hospitalA._id.toString()) || allHospitals[1];

    console.log(`🏥 Hospital A (Source of Truth): ${hospitalA.name} (${hospitalA._id})`);
    console.log(`🏥 Hospital B (Source of Truth): ${hospitalB.name} (${hospitalB._id})`);
    console.log(`📊 Total Dynamic Hospitals in MongoDB: ${allHospitals.length}\n`);

    // Retrieve bed records
    hospitalABed = await Bed.findOne({ hospital: hospitalA._id, isActive: true });
    hospitalBBed = await Bed.findOne({ hospital: hospitalB._id, isActive: true });

    // ----------------------------------------------------
    // TEST 21 / PREP: Super Admin Login
    // ----------------------------------------------------
    const resSuperLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@demo.wb.gov.in', password: 'SuperAdmin123!' }),
    });
    superAdminToken = resSuperLogin.body.data?.token;
    const isSuperOk = resSuperLogin.status === 200 && resSuperLogin.body.data?.user?.role === 'super_admin';
    logTest(21, 'Super Administrator Authentication (Global Role)', isSuperOk, `Role: ${resSuperLogin.body.data?.user?.role}`);

    // ----------------------------------------------------
    // TEST 11: Super Admin creates Hospital A Admin
    // ----------------------------------------------------
    const apolloAdminEmail = `apollo_admin_${Date.now()}@wb.gov.in`;
    const resCreateApolloAdmin = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: 'Apollo Hospital Admin',
        email: apolloAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });
    const createdApolloId = resCreateApolloAdmin.body.data?.id;
    const isCreateAOk =
      resCreateApolloAdmin.status === 201 &&
      resCreateApolloAdmin.body.data?.role === 'hospital_admin' &&
      resCreateApolloAdmin.body.data?.hospitalId === hospitalA._id.toString();
    logTest(11, 'Super Admin Creates Hospital A Admin in MongoDB', isCreateAOk, `HospitalId: ${resCreateApolloAdmin.body.data?.hospitalId}`);

    // ----------------------------------------------------
    // TEST 12: Super Admin creates Hospital B Admin
    // ----------------------------------------------------
    const secondAdminEmail = `second_admin_${Date.now()}@wb.gov.in`;
    const resCreateSecondAdmin = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: `${hospitalB.name} Admin`,
        email: secondAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalB._id.toString(),
      }),
    });
    const isCreateBOk =
      resCreateSecondAdmin.status === 201 &&
      resCreateSecondAdmin.body.data?.role === 'hospital_admin' &&
      resCreateSecondAdmin.body.data?.hospitalId === hospitalB._id.toString();
    logTest(12, 'Super Admin Creates Hospital B Admin in MongoDB', isCreateBOk, `HospitalId: ${resCreateSecondAdmin.body.data?.hospitalId}`);

    // ----------------------------------------------------
    // TEST 1: Hospital A Admin logs in
    // ----------------------------------------------------
    const resApolloLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: apolloAdminEmail, password: 'Password123!' }),
    });
    apolloAdminToken = resApolloLogin.body.data?.token;
    const isApolloLoginOk =
      resApolloLogin.status === 200 &&
      resApolloLogin.body.data?.user?.role === 'hospital_admin' &&
      (resApolloLogin.body.data?.user?.hospitalId === hospitalA._id.toString() ||
        resApolloLogin.body.data?.user?.hospital?._id === hospitalA._id.toString());
    logTest(1, 'Hospital A Admin Login Contract & Identification', isApolloLoginOk, `Role: ${resApolloLogin.body.data?.user?.role}`);

    // Log in Hospital B Admin
    const resSecondLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: secondAdminEmail, password: 'Password123!' }),
    });
    secondAdminToken = resSecondLogin.body.data?.token;

    // ----------------------------------------------------
    // PREPARATION: Create Bed Requests for Hospital A and Hospital B
    // ----------------------------------------------------
    requestForHospitalA = await BedRequest.create({
      user: resApolloLogin.body.data.user.id,
      hospital: hospitalA._id,
      bed: hospitalABed._id,
      bedType: hospitalABed.type,
      patientName: 'Patient For Hospital A',
      contactPhone: '9830011111',
      status: 'pending',
    });

    requestForHospitalB = await BedRequest.create({
      user: resSecondLogin.body.data.user.id,
      hospital: hospitalB._id,
      bed: hospitalBBed._id,
      bedType: hospitalBBed.type,
      patientName: 'Patient For Hospital B',
      contactPhone: '9830022222',
      status: 'pending',
    });

    // ----------------------------------------------------
    // TEST 2: Hospital A Admin views requests (queries own hospital)
    // ----------------------------------------------------
    const resViewA = await requestJson(`${BASE_URL}/bed-requests`, {
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const requestsReturnedForA = resViewA.body.data || [];
    const onlyHospitalA = requestsReturnedForA.every(
      (r) => (r.hospital?._id || r.hospital).toString() === hospitalA._id.toString()
    );
    logTest(2, 'Hospital A Admin Views Own Hospital Requests Only', resViewA.status === 200 && onlyHospitalA, `Count: ${requestsReturnedForA.length}`);

    // ----------------------------------------------------
    // TEST 3: Hospital A Admin views Hospital B requests
    // ----------------------------------------------------
    const hasHospitalBDataInAList = requestsReturnedForA.some(
      (r) => (r.hospital?._id || r.hospital).toString() === hospitalB._id.toString()
    );
    logTest(3, 'Hospital A Admin Cannot Access Hospital B Data in Queries', !hasHospitalBDataInAList, 'Hospital B data excluded at query level');

    // ----------------------------------------------------
    // TEST 6: Hospital A Admin attempts to APPROVE Hospital B request (403 FORBIDDEN)
    // ----------------------------------------------------
    const resApproveForbidden = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalB._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const docBAfterForbiddenApprove = await BedRequest.findById(requestForHospitalB._id);
    const isTest6Passed =
      resApproveForbidden.status === 403 &&
      resApproveForbidden.body.success === false &&
      docBAfterForbiddenApprove.status === 'pending';
    logTest(6, 'Hospital A Admin Blocked From Approving Hospital B Request (403 Forbidden)', isTest6Passed, `Status: ${resApproveForbidden.status}, DB Status: ${docBAfterForbiddenApprove.status}`);

    // ----------------------------------------------------
    // TEST 7: Hospital A Admin attempts to REJECT Hospital B request (403 FORBIDDEN)
    // ----------------------------------------------------
    const resRejectForbidden = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalB._id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const docBAfterForbiddenReject = await BedRequest.findById(requestForHospitalB._id);
    const isTest7Passed =
      resRejectForbidden.status === 403 &&
      resRejectForbidden.body.success === false &&
      docBAfterForbiddenReject.status === 'pending';
    logTest(7, 'Hospital A Admin Blocked From Rejecting Hospital B Request (403 Forbidden)', isTest7Passed, `Status: ${resRejectForbidden.status}, DB Status: ${docBAfterForbiddenReject.status}`);

    // ----------------------------------------------------
    // TEST 4: Hospital A Admin APPROVES Hospital A request (200 OK)
    // ----------------------------------------------------
    const resApproveAllowed = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalA._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const docAAfterApprove = await BedRequest.findById(requestForHospitalA._id);
    const isTest4Passed =
      resApproveAllowed.status === 200 &&
      resApproveAllowed.body.success === true &&
      docAAfterApprove.status === 'approved';
    logTest(4, 'Hospital A Admin Approves Hospital A Request (MongoDB Persisted)', isTest4Passed, `DB Status: ${docAAfterApprove.status}`);

    // ----------------------------------------------------
    // TEST 5: Hospital A Admin REJECTS Hospital A request (Create new pending req for test)
    // ----------------------------------------------------
    const requestForHospitalA2 = await BedRequest.create({
      user: resApolloLogin.body.data.user.id,
      hospital: hospitalA._id,
      bed: hospitalABed._id,
      bedType: hospitalABed.type,
      patientName: 'Patient For Rejection Test',
      contactPhone: '9830033333',
      status: 'pending',
    });
    const resRejectAllowed = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalA2._id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const docA2AfterReject = await BedRequest.findById(requestForHospitalA2._id);
    const isTest5Passed =
      resRejectAllowed.status === 200 &&
      resRejectAllowed.body.success === true &&
      docA2AfterReject.status === 'rejected';
    logTest(5, 'Hospital A Admin Rejects Hospital A Request (MongoDB Persisted)', isTest5Passed, `DB Status: ${docA2AfterReject.status}`);

    // ----------------------------------------------------
    // TEST 8: Hospital B Admin APPROVES Hospital B request (200 OK)
    // ----------------------------------------------------
    const resApproveBOk = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalB._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${secondAdminToken}` },
    });
    const docBAfterApprove = await BedRequest.findById(requestForHospitalB._id);
    const isTest8Passed =
      resApproveBOk.status === 200 &&
      resApproveBOk.body.success === true &&
      docBAfterApprove.status === 'approved';
    logTest(8, 'Hospital B Admin Approves Hospital B Request (MongoDB Persisted)', isTest8Passed, `DB Status: ${docBAfterApprove.status}`);

    // ----------------------------------------------------
    // TEST 9: Hospital B Admin attempts to APPROVE Hospital A request (403 FORBIDDEN)
    // ----------------------------------------------------
    const requestForHospitalA3 = await BedRequest.create({
      user: resApolloLogin.body.data.user.id,
      hospital: hospitalA._id,
      bed: hospitalABed._id,
      bedType: hospitalABed.type,
      patientName: 'Patient Cross Test A3',
      contactPhone: '9830044444',
      status: 'pending',
    });
    const resBApproveAFrobidden = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalA3._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${secondAdminToken}` },
    });
    const docA3Unchanged = await BedRequest.findById(requestForHospitalA3._id);
    const isTest9Passed =
      resBApproveAFrobidden.status === 403 &&
      resBApproveAFrobidden.body.success === false &&
      docA3Unchanged.status === 'pending';
    logTest(9, 'Hospital B Admin Blocked From Approving Hospital A Request (403 Forbidden)', isTest9Passed, `Status: ${resBApproveAFrobidden.status}, DB Status: ${docA3Unchanged.status}`);

    // ----------------------------------------------------
    // TEST 10: Hospital Admin tries to update another hospital's beds (403 FORBIDDEN)
    // ----------------------------------------------------
    const initialOccupiedBedsB = hospitalBBed.occupiedBeds;
    const resUpdateOtherBed = await requestJson(`${BASE_URL}/beds/${hospitalBBed._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
      body: JSON.stringify({ occupiedBeds: initialOccupiedBedsB + 1 }),
    });
    const bedBAfterAttempt = await Bed.findById(hospitalBBed._id);
    const isTest10Passed =
      resUpdateOtherBed.status === 403 &&
      bedBAfterAttempt.occupiedBeds === initialOccupiedBedsB;
    logTest(10, 'Cross-Hospital Bed Modification Blocked (403 Forbidden)', isTest10Passed, `Status: ${resUpdateOtherBed.status}, DB Occupied Unchanged: ${bedBAfterAttempt.occupiedBeds}`);

    // ----------------------------------------------------
    // TEST 13: Invalid hospitalId is submitted when creating admin (404/400)
    // ----------------------------------------------------
    const fakeHospitalId = new mongoose.Types.ObjectId().toString();
    const resInvalidHosp = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: 'Invalid Admin',
        email: `fake_admin_${Date.now()}@wb.gov.in`,
        password: 'Password123!',
        hospitalId: fakeHospitalId,
      }),
    });
    const isTest13Passed = resInvalidHosp.status === 404 && resInvalidHosp.body.success === false;
    logTest(13, 'Invalid hospitalId Rejection on Admin Creation', isTest13Passed, `HTTP ${resInvalidHosp.status} - Hospital not found`);

    // ----------------------------------------------------
    // TEST 14: Unauthenticated user calls approve endpoint (401 Unauthorized)
    // ----------------------------------------------------
    const resUnauthApprove = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalA3._id}/approve`, {
      method: 'PATCH',
    });
    logTest(14, 'Unauthenticated Approve Attempt Rejected (401 Unauthorized)', resUnauthApprove.status === 401);

    // ----------------------------------------------------
    // TEST 15: Hospital admin attempts to manipulate hospitalId in request body
    // ----------------------------------------------------
    const resManipulatedBody = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalB._id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
      body: JSON.stringify({ hospitalId: hospitalA._id.toString() }), // Trying to spoof hospitalId in body
    });
    logTest(15, 'Request Body hospitalId Manipulation Blocked by DB Source of Truth', resManipulatedBody.status === 403, 'Backend ignored manipulated body hospitalId and read database');

    // ----------------------------------------------------
    // TEST 16: Hospital admin modifies request URL to another hospital requestId (403)
    // ----------------------------------------------------
    const resManipulatedUrl = await requestJson(`${BASE_URL}/bed-requests/${requestForHospitalB._id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    logTest(16, 'URL Parameter Tampering Cross-Hospital Request Forbidden (403)', resManipulatedUrl.status === 403);

    // ----------------------------------------------------
    // TEST 17: Password security: Only passwordHash stored, plaintext password does not exist
    // ----------------------------------------------------
    const userDocInDb = await User.findById(createdApolloId).select('+passwordHash');
    const isPlaintextAbsent = !('password' in userDocInDb.toObject());
    const isHashValidBcrypt = userDocInDb.passwordHash && userDocInDb.passwordHash.startsWith('$2');
    logTest(17, 'Password Security (Bcrypt Hashed, Plaintext Never Stored)', isPlaintextAbsent && isHashValidBcrypt, `Hash format: ${userDocInDb.passwordHash.substring(0, 10)}...`);

    // ----------------------------------------------------
    // TEST 18: Duplicate email registration rejected (409 Conflict)
    // ----------------------------------------------------
    const resDuplicateEmail = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: 'Duplicate Admin',
        email: apolloAdminEmail, // Re-using existing email
        password: 'Password123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });
    logTest(18, 'Duplicate Email Registration Prevention (409 Conflict)', resDuplicateEmail.status === 409);

    // ----------------------------------------------------
    // TEST 19: Public Hospital Search and Bed Availability Query (No Auth Required)
    // ----------------------------------------------------
    const resPublicHospitals = await requestJson(`${BASE_URL}/hospitals?search=apollo`);
    const resPublicBeds = await requestJson(`${BASE_URL}/hospitals/${hospitalA._id}/beds`);
    const isPublicOk =
      resPublicHospitals.status === 200 &&
      resPublicHospitals.body.data?.length > 0 &&
      resPublicBeds.status === 200 &&
      resPublicBeds.body.data?.length > 0;
    logTest(19, 'Public Bed Search & Hospital Availability Preserved (Unauthenticated)', isPublicOk, `Hospitals found: ${resPublicHospitals.body.data?.length}, Beds: ${resPublicBeds.body.data?.length}`);

    // ----------------------------------------------------
    // TEST 20: Super Admin Retrieves Dynamic Hospital List
    // ----------------------------------------------------
    const resAdminHospitals = await requestJson(`${BASE_URL}/admin/hospitals`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const isDynamicHospOk =
      resAdminHospitals.status === 200 &&
      resAdminHospitals.body.count === allHospitals.length &&
      resAdminHospitals.body.data?.length === allHospitals.length;
    logTest(20, 'Super Admin Dynamic Hospital List API (Source of Truth)', isDynamicHospOk, `Count: ${resAdminHospitals.body.count}`);

    // Clean up temporary test requests
    await BedRequest.deleteMany({
      _id: { $in: [requestForHospitalA._id, requestForHospitalB._id, requestForHospitalA2._id, requestForHospitalA3._id] },
    });
    await User.deleteMany({
      email: { $in: [apolloAdminEmail, secondAdminEmail] },
    });

  } catch (err) {
    console.error('Unhandled test execution error:', err);
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
    await disconnectDB();

    console.log('\n======================================================');
    const passed = testResults.filter((r) => r.passed).length;
    const total = testResults.length;
    console.log(`📊 TEST SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log('======================================================\n');
  }
}

if (require.main === module) {
  runStaffAuthTests()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runStaffAuthTests };
