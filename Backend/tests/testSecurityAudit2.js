/**
 * Automated Verification Suite for Security Audit #2 Remediation
 * Verifies AUTH-01, AUTH-02, and AUTH-03
 */
require('../config/bootstrap');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { app } = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const EmergencyIntake = require('../models/EmergencyIntake');

const TEST_PORT = 5006;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

const results = [];
function recordTest(num, name, passed, detail = '') {
  results.push({ num, name, passed, detail });
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusIcon} [Test ${num.toString().padStart(2, '0')}] ${name}${detail ? ` (${detail})` : ''}`);
}

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

async function runSecurityAudit2Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING SECURITY AUDIT #2 (AUTH-01, AUTH-02, AUTH-03) VERIFICATION');
  console.log(`📡 Target API: ${BASE_URL}`);
  console.log('======================================================\n');

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
  await connectDB();

  const createdUserIds = [];
  let testIntakeId = '';

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be defined in environment for tests');
    }

    // ==========================================================
    // AUTH-01: PREVENT SELF-ASSIGNED ADMIN ROLES
    // ==========================================================
    console.log('--- SECTION 1: AUTH-01 REGISTRATION ROLE SAFETY ---');

    // 1. Normal registration creates role "user"
    const normalEmail = `sec_user_${Date.now()}@example.com`;
    const resNormal = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Standard Citizen',
        email: normalEmail,
        password: 'Password123!',
        phone: '9830011111',
      }),
    });
    const userDoc1 = await User.findOne({ email: normalEmail });
    if (userDoc1) createdUserIds.push(userDoc1._id);

    const isNormalUser =
      resNormal.status === 201 &&
      resNormal.body.data?.user?.role === 'user' &&
      userDoc1?.role === 'user';
    recordTest(1, 'Normal registration creates role "user"', isNormalUser, `Role: ${userDoc1?.role}`);

    // 2. Registration with role="hospital_admin" CANNOT create hospital_admin
    const hospAdminAttemptEmail = `hosp_attempt_${Date.now()}@example.com`;
    const resHospAdminAttempt = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Attacker Impersonator',
        email: hospAdminAttemptEmail,
        password: 'Password123!',
        phone: '9830022222',
        role: 'hospital_admin',
      }),
    });
    const userDoc2 = await User.findOne({ email: hospAdminAttemptEmail });
    if (userDoc2) createdUserIds.push(userDoc2._id);

    const isHospAdminBlocked =
      userDoc2 !== null &&
      userDoc2.role === 'user' &&
      userDoc2.role !== 'hospital_admin' &&
      resHospAdminAttempt.body.data?.user?.role === 'user';
    recordTest(2, 'Registration with role=hospital_admin strictly creates role "user"', isHospAdminBlocked, `Assigned Role: ${userDoc2?.role}`);

    // 3. Registration with role="super_admin" CANNOT create super_admin
    const superAdminAttemptEmail = `super_attempt_${Date.now()}@example.com`;
    const resSuperAdminAttempt = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Attacker Super Admin',
        email: superAdminAttemptEmail,
        password: 'Password123!',
        phone: '9830033333',
        role: 'super_admin',
      }),
    });
    const userDoc3 = await User.findOne({ email: superAdminAttemptEmail });
    if (userDoc3) createdUserIds.push(userDoc3._id);

    const isSuperAdminBlocked =
      userDoc3 !== null &&
      userDoc3.role === 'user' &&
      userDoc3.role !== 'super_admin' &&
      resSuperAdminAttempt.body.data?.user?.role === 'user';
    recordTest(3, 'Registration with role=super_admin strictly creates role "user"', isSuperAdminBlocked, `Assigned Role: ${userDoc3?.role}`);

    // 4. Registration with role="doctor" CANNOT create doctor
    const doctorAttemptEmail = `doc_attempt_${Date.now()}@example.com`;
    const resDoctorAttempt = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Attacker Doctor',
        email: doctorAttemptEmail,
        password: 'Password123!',
        phone: '9830044444',
        role: 'doctor',
      }),
    });
    const userDoc4 = await User.findOne({ email: doctorAttemptEmail });
    if (userDoc4) createdUserIds.push(userDoc4._id);

    const isDoctorBlocked =
      userDoc4 !== null &&
      userDoc4.role === 'user' &&
      userDoc4.role !== 'doctor' &&
      resDoctorAttempt.body.data?.user?.role === 'user';
    recordTest(4, 'Registration with role=doctor strictly creates role "user"', isDoctorBlocked, `Assigned Role: ${userDoc4?.role}`);

    // 5. Existing protected staff creation by Super Admin still works
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    const superAdminToken = jwt.sign(
      { id: existingSuperAdmin ? existingSuperAdmin._id : new mongoose.Types.ObjectId(), role: 'super_admin' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const targetHosp = await Hospital.findOne({});
    const legitimateStaffEmail = `legit_admin_${Date.now()}@wb.gov.in`;
    const resCreateStaff = await requestJson(`${BASE_URL}/admin/staff`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: 'Dr. Legitimate Administrator',
        email: legitimateStaffEmail,
        password: 'Password123!',
        hospitalId: targetHosp ? targetHosp._id.toString() : new mongoose.Types.ObjectId().toString(),
      }),
    });
    const userDoc5 = await User.findOne({ email: legitimateStaffEmail });
    if (userDoc5) createdUserIds.push(userDoc5._id);

    const isStaffCreationWorking =
      resCreateStaff.status === 201 &&
      userDoc5 !== null &&
      userDoc5.role === 'hospital_admin';
    recordTest(5, 'Legitimate administrative staff creation workflow preserved', isStaffCreationWorking, `Status: ${resCreateStaff.status}, Role: ${userDoc5?.role}`);

    // ==========================================================
    // AUTH-02: PROTECT EMERGENCY INTAKE RECORDS
    // ==========================================================
    console.log('\n--- SECTION 2: AUTH-02 EMERGENCY INTAKE AUTHORIZATION ---');

    // Create an intake record for testing
    const resIntakeCreate = await requestJson(`${BASE_URL}/emergency/intake`, {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Confidential Patient',
        age: 48,
        sex: 'Female',
        symptoms: 'Suspected appendicitis with acute abdomen',
        condition: 'Serious',
        emergencyType: 'General Emergency',
        contactNumber: '9830055555',
        district: 'Kolkata',
      }),
    });
    testIntakeId = resIntakeCreate.body.data?.intakeId;

    // 6. GET /api/emergency/intake/:id without token -> 401
    const resIntakeNoToken = await requestJson(`${BASE_URL}/emergency/intake/${testIntakeId}`);
    recordTest(6, 'Intake retrieval without token rejected with HTTP 401', resIntakeNoToken.status === 401, `Status: ${resIntakeNoToken.status}`);

    // 7. GET /api/emergency/intake/:id with invalid token -> 401
    const resIntakeBadToken = await requestJson(`${BASE_URL}/emergency/intake/${testIntakeId}`, {
      headers: { Authorization: 'Bearer invalid_garbage_token_123' },
    });
    recordTest(7, 'Intake retrieval with invalid token rejected with HTTP 401', resIntakeBadToken.status === 401, `Status: ${resIntakeBadToken.status}`);

    // 8. GET /api/emergency/intake/:id with valid unauthorized user (different citizen) -> 403
    const unauthorizedCitizenToken = jwt.sign(
      { id: userDoc1._id, role: 'user' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const resIntakeUnauthorized = await requestJson(`${BASE_URL}/emergency/intake/${testIntakeId}`, {
      headers: { Authorization: `Bearer ${unauthorizedCitizenToken}` },
    });
    recordTest(8, 'Unauthorized citizen access rejected with HTTP 403 Forbidden', resIntakeUnauthorized.status === 403, `Status: ${resIntakeUnauthorized.status}`);

    // 9. GET /api/emergency/intake/:id with valid authorized user (Super Admin) -> 200
    const resIntakeSuperAdmin = await requestJson(`${BASE_URL}/emergency/intake/${testIntakeId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const isSuperAdminAllowed =
      resIntakeSuperAdmin.status === 200 &&
      resIntakeSuperAdmin.body.success === true &&
      resIntakeSuperAdmin.body.data?.patientName === 'Confidential Patient';
    recordTest(9, 'Authorized Super Admin retrieves intake record (HTTP 200)', isSuperAdminAllowed, `Status: ${resIntakeSuperAdmin.status}`);

    // 10. GET /api/emergency/intake/:id with valid authorized user (Doctor) -> 200
    let doctorUser = await User.findOne({ role: 'doctor' });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: 'Dr. Test Physician',
        email: `dr_test_${Date.now()}@wb.gov.in`,
        passwordHash: 'Password123!',
        role: 'doctor',
      });
      createdUserIds.push(doctorUser._id);
    }
    const doctorToken = jwt.sign(
      { id: doctorUser._id, role: 'doctor' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const resIntakeDoctor = await requestJson(`${BASE_URL}/emergency/intake/${testIntakeId}`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    recordTest(10, 'Authorized Doctor retrieves intake record (HTTP 200)', resIntakeDoctor.status === 200, `Status: ${resIntakeDoctor.status}`);

    // 11. GET /api/emergency/intake/:id nonexistent ID -> 404
    const nonexistentId = new mongoose.Types.ObjectId();
    const resIntake404 = await requestJson(`${BASE_URL}/emergency/intake/${nonexistentId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    recordTest(11, 'Nonexistent intake record returns safe HTTP 404', resIntake404.status === 404, `Status: ${resIntake404.status}`);

    // 12. GET /api/emergency/intake/:id invalid ID format -> 422
    const resIntakeInvalidId = await requestJson(`${BASE_URL}/emergency/intake/not-a-valid-mongo-id`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    recordTest(12, 'Invalid intake ID format rejected with HTTP 422', resIntakeInvalidId.status === 422, `Status: ${resIntakeInvalidId.status}`);

    // ==========================================================
    // AUTH-03: RENDER REVERSE PROXY / RATE LIMITING
    // ==========================================================
    console.log('\n--- SECTION 3: AUTH-03 REVERSE PROXY & RATE LIMITING ---');

    // 13. Express trust proxy is configured to 1 (single reverse proxy hop for Render)
    const trustProxySetting = app.get('trust proxy');
    recordTest(13, 'Express trust proxy setting equals 1 for Render reverse proxy', trustProxySetting === 1 || trustProxySetting === true, `Setting: ${trustProxySetting}`);

    // 14. Rate limit headers are present on login endpoint
    const resRateLimitCheck = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.195',
      },
      body: JSON.stringify({ email: 'ratelimit_test@example.com', password: 'bad_password' }),
    });
    const ratelimitLimit = resRateLimitCheck.headers.get('ratelimit-limit') || resRateLimitCheck.headers.get('x-ratelimit-limit');
    recordTest(14, 'Rate limit headers present on /api/auth/login', Boolean(ratelimitLimit), `Limit: ${ratelimitLimit}`);

    // 15. Rate limit headers are present on registration endpoint
    const resRegRateLimitCheck = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.196',
      },
      body: JSON.stringify({}),
    });
    const regRatelimitLimit = resRegRateLimitCheck.headers.get('ratelimit-limit') || resRegRateLimitCheck.headers.get('x-ratelimit-limit');
    recordTest(15, 'Rate limit headers present on /api/auth/register', Boolean(regRatelimitLimit), `Limit: ${regRatelimitLimit}`);

  } catch (err) {
    console.error('Test execution error:', err);
    recordTest(99, 'Test Exception Occurred', false, err.message);
  } finally {
    // Cleanup created test records
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (testIntakeId) {
      await EmergencyIntake.deleteOne({ _id: testIntakeId });
    }
    await testServer.close();
    await disconnectDB();
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n======================================================');
  console.log(`📊 SECURITY AUDIT #2 SUMMARY: ${passedCount}/${results.length} TESTS PASSED`);
  console.log('======================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSecurityAudit2Tests();
}

module.exports = { runSecurityAudit2Tests };
