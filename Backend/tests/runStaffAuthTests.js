/**
 * ======================================================================
 * HOSPITAL-SPECIFIC STAFF ADMIN AUTHENTICATION, AUTHORIZATION & PERSISTENCE TEST SUITE
 * ======================================================================
 * Validates the complete multi-hospital authentication and authorization system:
 * - Dynamic hospital loading from MongoDB (Single Source of Truth)
 * - Hospital dropdown selection during login
 * - Matching hospital selection succeeds (200)
 * - Wrong hospital selection fails with 403 Forbidden
 * - Database document verification (no trust on frontend hospitalId)
 * - Hospital Admin isolation (approvals, rejections, bed updates)
 * - Super Admin global role & hospital admin creation
 * - Password hashing with bcrypt
 * - Persistence in MongoDB Atlas
 * - Preservation of public search and bed availability
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

  let hospitalA = null; // e.g. Apollo Multispeciality Hospitals
  let hospitalB = null; // e.g. Ruby General Hospital or Asansol
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
    // PREPARATION: Super Admin Login
    // ----------------------------------------------------
    const resSuperLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@demo.wb.gov.in', password: 'SuperAdmin123!' }),
    });
    superAdminToken = resSuperLogin.body.data?.token;

    // ----------------------------------------------------
    // PREPARATION: Super Admin creates Hospital A Admin & Hospital B Admin in MongoDB
    // ----------------------------------------------------
    const apolloAdminEmail = `admin_a_${Date.now()}@wb.gov.in`;
    const resCreateA = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: `${hospitalA.name} Admin`,
        email: apolloAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });

    const secondAdminEmail = `admin_b_${Date.now()}@wb.gov.in`;
    const resCreateB = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: `${hospitalB.name} Admin`,
        email: secondAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalB._id.toString(),
      }),
    });

    // ----------------------------------------------------
    // TEST 1: Hospital A Admin logs in with Hospital A selected (SUCCESS)
    // ----------------------------------------------------
    const resA_Login = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: apolloAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });
    apolloAdminToken = resA_Login.body.data?.token;
    const isA_LoginOk =
      resA_Login.status === 200 &&
      resA_Login.body.data?.user?.role === 'hospital_admin' &&
      resA_Login.body.data?.user?.hospitalId === hospitalA._id.toString();
    logTest(1, 'Hospital A Admin logs in with Hospital A selected (SUCCESS)', isA_LoginOk, `Status: ${resA_Login.status}, HospitalId: ${resA_Login.body.data?.user?.hospitalId}`);

    // ----------------------------------------------------
    // TEST 2: Hospital B Admin logs in with Hospital B selected (SUCCESS)
    // ----------------------------------------------------
    const resB_Login = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: secondAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalB._id.toString(),
      }),
    });
    secondAdminToken = resB_Login.body.data?.token;
    const isB_LoginOk =
      resB_Login.status === 200 &&
      resB_Login.body.data?.user?.role === 'hospital_admin' &&
      resB_Login.body.data?.user?.hospitalId === hospitalB._id.toString();
    logTest(2, 'Hospital B Admin logs in with Hospital B selected (SUCCESS)', isB_LoginOk, `Status: ${resB_Login.status}, HospitalId: ${resB_Login.body.data?.user?.hospitalId}`);

    // ----------------------------------------------------
    // TEST 3: Hospital A Admin credentials + Hospital B selected (LOGIN DENIED - 403 Forbidden)
    // ----------------------------------------------------
    const resA_WrongHosp = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: apolloAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalB._id.toString(), // Wrong hospital selected
      }),
    });
    const isWrongHospBlocked =
      resA_WrongHosp.status === 403 &&
      resA_WrongHosp.body.message === 'Hospital selection does not match this staff account.';
    logTest(3, 'Hospital A Admin credentials + Hospital B selected (LOGIN DENIED)', isWrongHospBlocked, `Status: ${resA_WrongHosp.status}, Message: ${resA_WrongHosp.body.message}`);

    // ----------------------------------------------------
    // TEST 4: Hospital B Admin credentials + Hospital A selected (LOGIN DENIED - 403 Forbidden)
    // ----------------------------------------------------
    const resB_WrongHosp = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: secondAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalA._id.toString(), // Wrong hospital selected
      }),
    });
    const isBWrongHospBlocked =
      resB_WrongHosp.status === 403 &&
      resB_WrongHosp.body.message === 'Hospital selection does not match this staff account.';
    logTest(4, 'Hospital B Admin credentials + Hospital A selected (LOGIN DENIED)', isBWrongHospBlocked, `Status: ${resB_WrongHosp.status}, Message: ${resB_WrongHosp.body.message}`);

    // ----------------------------------------------------
    // PREPARATION: Create Bed Requests for Hospital A and Hospital B
    // ----------------------------------------------------
    requestForHospitalA = await BedRequest.create({
      user: resA_Login.body.data.user.id,
      hospital: hospitalA._id,
      bed: hospitalABed._id,
      bedType: hospitalABed.type,
      patientName: 'Patient For Hospital A',
      contactPhone: '9830011111',
      status: 'pending',
    });

    requestForHospitalB = await BedRequest.create({
      user: resB_Login.body.data.user.id,
      hospital: hospitalB._id,
      bed: hospitalBBed._id,
      bedType: hospitalBBed.type,
      patientName: 'Patient For Hospital B',
      contactPhone: '9830022222',
      status: 'pending',
    });

    const reqA_Id = requestForHospitalA._id.toString();
    const reqB_Id = requestForHospitalB._id.toString();

    // ----------------------------------------------------
    // TEST 5: Hospital A Admin approves Hospital A request (SUCCESS + MongoDB updated)
    // ----------------------------------------------------
    const resApproveA = await requestJson(`${BASE_URL}/bed-requests/${reqA_Id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const dbReqA = await BedRequest.findById(reqA_Id);
    const isApproveAOk = resApproveA.status === 200 && dbReqA.status === 'approved';
    logTest(5, 'Hospital A Admin approves Hospital A request (MongoDB Persisted)', isApproveAOk, `Status: ${resApproveA.status}, DB Status: ${dbReqA?.status}`);

    // ----------------------------------------------------
    // TEST 6: Hospital A Admin attempts to approve Hospital B request (403 Forbidden + MongoDB unchanged)
    // ----------------------------------------------------
    const resCrossApproveA = await requestJson(`${BASE_URL}/bed-requests/${reqB_Id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const dbReqB_afterA = await BedRequest.findById(reqB_Id);
    const isCrossApproveABlocked = resCrossApproveA.status === 403 && dbReqB_afterA.status === 'pending';
    logTest(6, 'Hospital A Admin attempts to approve Hospital B request (403 + MongoDB Unchanged)', isCrossApproveABlocked, `Status: ${resCrossApproveA.status}, DB Status: ${dbReqB_afterA?.status}`);

    // ----------------------------------------------------
    // TEST 7: Hospital B Admin approves Hospital B request (SUCCESS + MongoDB updated)
    // ----------------------------------------------------
    const resApproveB = await requestJson(`${BASE_URL}/bed-requests/${reqB_Id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${secondAdminToken}` },
    });
    const dbReqB = await BedRequest.findById(reqB_Id);
    const isApproveBOk = resApproveB.status === 200 && dbReqB.status === 'approved';
    logTest(7, 'Hospital B Admin approves Hospital B request (MongoDB Persisted)', isApproveBOk, `Status: ${resApproveB.status}, DB Status: ${dbReqB?.status}`);

    // ----------------------------------------------------
    // TEST 8: Hospital B Admin attempts to approve Hospital A request (403 Forbidden + MongoDB unchanged)
    // ----------------------------------------------------
    const requestForHospitalA2 = await BedRequest.create({
      user: resA_Login.body.data.user.id,
      hospital: hospitalA._id,
      bed: hospitalABed._id,
      bedType: hospitalABed.type,
      patientName: 'Patient For Hospital A 2',
      contactPhone: '9830011112',
      status: 'pending',
    });
    const reqA2_Id = requestForHospitalA2._id.toString();

    const resCrossApproveB = await requestJson(`${BASE_URL}/bed-requests/${reqA2_Id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${secondAdminToken}` },
    });
    const dbReqA2 = await BedRequest.findById(reqA2_Id);
    const isCrossApproveBBlocked = resCrossApproveB.status === 403 && dbReqA2.status === 'pending';
    logTest(8, 'Hospital B Admin attempts to approve Hospital A request (403 + MongoDB Unchanged)', isCrossApproveBBlocked, `Status: ${resCrossApproveB.status}, DB Status: ${dbReqA2?.status}`);

    // ----------------------------------------------------
    // TEST 9: Hospital A Admin updates Hospital A bed availability (SUCCESS + MongoDB updated)
    // ----------------------------------------------------
    const newOccupiedA = Math.max(0, hospitalABed.occupiedBeds + 1);
    const resBedUpdateA = await requestJson(`${BASE_URL}/beds/${hospitalABed._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
      body: JSON.stringify({ occupiedBeds: newOccupiedA }),
    });
    const updatedBedA = await Bed.findById(hospitalABed._id);
    const isBedUpdateAOk = resBedUpdateA.status === 200 && updatedBedA.occupiedBeds === newOccupiedA;
    logTest(9, 'Hospital A Admin updates Hospital A bed availability (MongoDB Persisted)', isBedUpdateAOk, `Status: ${resBedUpdateA.status}, Occupied: ${updatedBedA.occupiedBeds}`);

    // ----------------------------------------------------
    // TEST 10: Hospital A Admin updates Hospital B bed availability (403 + MongoDB unchanged)
    // ----------------------------------------------------
    const beforeOccB = hospitalBBed.occupiedBeds;
    const resBedUpdateCross = await requestJson(`${BASE_URL}/beds/${hospitalBBed._id}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
      body: JSON.stringify({ occupiedBeds: beforeOccB + 1 }),
    });
    const afterBedB = await Bed.findById(hospitalBBed._id);
    const isBedCrossBlocked = resBedUpdateCross.status === 403 && afterBedB.occupiedBeds === beforeOccB;
    logTest(10, 'Hospital A Admin updates Hospital B bed availability (403 Forbidden + Unchanged)', isBedCrossBlocked, `Status: ${resBedUpdateCross.status}, Occupied Unchanged: ${afterBedB.occupiedBeds}`);

    // ----------------------------------------------------
    // TEST 11: Super Admin creates a new hospital admin (Saved to MongoDB Atlas)
    // ----------------------------------------------------
    const newAdminEmail = `dr_new_admin_${Date.now()}@wb.gov.in`;
    const resCreateNewAdmin = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: 'Dr. Dynamic Staff Admin',
        email: newAdminEmail,
        password: 'SecurePassword123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });
    const dbNewUser = await User.findOne({ email: newAdminEmail });
    const isNewAdminPersisted =
      resCreateNewAdmin.status === 201 &&
      !!dbNewUser &&
      dbNewUser.role === 'hospital_admin' &&
      dbNewUser.hospital.toString() === hospitalA._id.toString();
    logTest(11, 'Super Admin creates a new hospital admin (Persisted in MongoDB Atlas)', isNewAdminPersisted, `Status: ${resCreateNewAdmin.status}, Email: ${newAdminEmail}`);

    // ----------------------------------------------------
    // TEST 12: New hospital admin logs in (Successful login with correct hospitalId)
    // ----------------------------------------------------
    const resNewAdminLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: newAdminEmail,
        password: 'SecurePassword123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });
    const isNewAdminLoginOk =
      resNewAdminLogin.status === 200 &&
      resNewAdminLogin.body.data?.user?.role === 'hospital_admin' &&
      resNewAdminLogin.body.data?.user?.hospitalId === hospitalA._id.toString();
    logTest(12, 'New hospital admin logs in (Successful login with correct hospitalId)', isNewAdminLoginOk, `Status: ${resNewAdminLogin.status}, HospitalId: ${resNewAdminLogin.body.data?.user?.hospitalId}`);

    // ----------------------------------------------------
    // TEST 13: Invalid / Non-existent hospitalId rejection on login (HTTP 404)
    // ----------------------------------------------------
    const fakeHospitalId = new mongoose.Types.ObjectId().toString();
    const resFakeHospLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: apolloAdminEmail,
        password: 'Password123!',
        hospitalId: fakeHospitalId,
      }),
    });
    logTest(13, 'Non-existent hospitalId rejection during login (HTTP 404)', resFakeHospLogin.status === 404, `Status: ${resFakeHospLogin.status}`);

    // ----------------------------------------------------
    // TEST 14: Hospital A Admin rejects Hospital A request (Persisted in MongoDB)
    // ----------------------------------------------------
    const resRejectA = await requestJson(`${BASE_URL}/bed-requests/${reqA2_Id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
      body: JSON.stringify({ reason: 'No ICU beds currently available' }),
    });
    const dbReqA2_afterReject = await BedRequest.findById(reqA2_Id);
    const isRejectAOk = resRejectA.status === 200 && dbReqA2_afterReject.status === 'rejected';
    logTest(14, 'Hospital A Admin rejects Hospital A request (MongoDB Persisted)', isRejectAOk, `Status: ${resRejectA.status}, DB Status: ${dbReqA2_afterReject?.status}`);

    // ----------------------------------------------------
    // TEST 15: Hospital A Admin blocked from rejecting Hospital B request (403 Forbidden)
    // ----------------------------------------------------
    const resCrossReject = await requestJson(`${BASE_URL}/bed-requests/${reqB_Id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    logTest(15, 'Hospital A Admin blocked from rejecting Hospital B request (403 Forbidden)', resCrossReject.status === 403, `Status: ${resCrossReject.status}`);

    // ----------------------------------------------------
    // TEST 16: Request query isolation (Hospital A Admin only sees own hospital's requests)
    // ----------------------------------------------------
    const resReqQuery = await requestJson(`${BASE_URL}/bed-requests`, {
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
    });
    const queriedReqs = resReqQuery.body.data || [];
    const allBelongToA = queriedReqs.every(
      (r) => (r.hospital?._id || r.hospital).toString() === hospitalA._id.toString()
    );
    logTest(16, 'Hospital A Admin views own hospital requests only (DB query isolation)', resReqQuery.status === 200 && allBelongToA, `Count: ${queriedReqs.length}`);

    // ----------------------------------------------------
    // TEST 17: Request body hospitalId manipulation ignored (Backend checks DB record)
    // ----------------------------------------------------
    const resTamperBody = await requestJson(`${BASE_URL}/bed-requests/${reqB_Id}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apolloAdminToken}` },
      body: JSON.stringify({ hospitalId: hospitalA._id.toString() }),
    });
    logTest(17, 'Request Body hospitalId Manipulation Blocked by DB Source of Truth', resTamperBody.status === 403, `Status: ${resTamperBody.status}`);

    // ----------------------------------------------------
    // TEST 18: Unauthenticated access rejected (401 Unauthorized)
    // ----------------------------------------------------
    const resUnauth = await requestJson(`${BASE_URL}/bed-requests/${reqA_Id}/approve`, {
      method: 'PATCH',
    });
    logTest(18, 'Unauthenticated operation rejected (401 Unauthorized)', resUnauth.status === 401, `Status: ${resUnauth.status}`);

    // ----------------------------------------------------
    // TEST 19: Password security check (Bcrypt hashed, plaintext never stored)
    // ----------------------------------------------------
    const userInDb = await User.findOne({ email: newAdminEmail }).select('+passwordHash');
    const isBcrypt = userInDb.passwordHash.startsWith('$2b$') || userInDb.passwordHash.startsWith('$2a$');
    const plaintextNotStored = userInDb.passwordHash !== 'SecurePassword123!';
    logTest(19, 'Password Security (Bcrypt hashed, plaintext never stored)', isBcrypt && plaintextNotStored, `Hash format: ${userInDb.passwordHash.slice(0, 10)}...`);

    // ----------------------------------------------------
    // TEST 20: Duplicate email registration prevention (409 Conflict)
    // ----------------------------------------------------
    const resDuplicate = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: 'Duplicate Admin',
        email: newAdminEmail,
        password: 'Password123!',
        hospitalId: hospitalA._id.toString(),
      }),
    });
    logTest(20, 'Duplicate Email Registration Prevention (409 Conflict)', resDuplicate.status === 409, `Status: ${resDuplicate.status}`);

    // ----------------------------------------------------
    // TEST 21: Public bed search & hospital availability preserved (Unauthenticated)
    // ----------------------------------------------------
    const resPublicSearch = await requestJson(`${BASE_URL}/hospitals?search=apollo`);
    const resPublicBeds = await requestJson(`${BASE_URL}/hospitals/${hospitalA._id}/beds`);
    const isPublicOk =
      resPublicSearch.status === 200 &&
      resPublicBeds.status === 200 &&
      Array.isArray(resPublicBeds.body.data);
    logTest(21, 'Public Bed Search & Hospital Availability Preserved (Unauthenticated)', isPublicOk, `Hospitals found: ${resPublicSearch.body.data?.length}, Beds: ${resPublicBeds.body.data?.length}`);

    // ----------------------------------------------------
    // TEST 22: Super Admin Dynamic Hospital List API (Source of Truth)
    // ----------------------------------------------------
    const resAdminHospitals = await requestJson(`${BASE_URL}/admin/hospitals`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const dynamicCountMatches = resAdminHospitals.body.count === allHospitals.length;
    logTest(22, 'Super Admin Dynamic Hospital List API (Source of Truth)', resAdminHospitals.status === 200 && dynamicCountMatches, `Count: ${resAdminHospitals.body.count}`);

  } catch (err) {
    console.error('❌ Test suite error:', err);
  } finally {
    await disconnectDB();
    await new Promise((resolve) => testServer.close(resolve));

    const total = testResults.length;
    const passed = testResults.filter(t => t.passed).length;
    const allPassed = total > 0 && total === passed;

    console.log('\n======================================================');
    console.log(`📊 TEST SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
    console.log('======================================================\n');

    process.exit(allPassed ? 0 : 1);
  }
}

runStaffAuthTests();
