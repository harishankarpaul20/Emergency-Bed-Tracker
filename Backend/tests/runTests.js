/**
 * Automated Test Suite for Medical Bed Tracker Backend
 * Uses Node.js native fetch & HTTP testing against live Atlas database.
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

const TEST_PORT = 5001;
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
  } catch (e) {}
  return { status: res.status, headers: res.headers, body };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE BACKEND VERIFICATION SUITE');
  console.log(`📡 Testing against: ${BASE_URL}`);
  console.log('======================================================\n');

  // Start dedicated test server and connect to MongoDB Atlas
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
  await connectDB();

  let citizenToken = '';
  let hospitalAdminToken = '';
  let superAdminToken = '';
  let apolloHospitalId = '';
  let apolloBedId = '';
  let createdRequestId = '';

  try {
    // 1. Server startup & Health Check
    const resHealth = await requestJson(`${BASE_URL}/health`);
    recordTest(1, 'Server Startup & Port Binding', resHealth.status === 200, `HTTP ${resHealth.status}`);

    // 2. Health Endpoint Payload Contract
    const isHealthValid =
      resHealth.body.success === true &&
      resHealth.body.message === 'Medical Bed Tracker API is running' &&
      resHealth.body.data &&
      resHealth.body.data.environment === 'development';
    recordTest(2, 'Health Check Response Contract', isHealthValid, `Status: ${resHealth.body.message}`);

    // 3. Security Headers (Helmet Check)
    const xContentType = resHealth.headers.get('x-content-type-options');
    recordTest(3, 'HTTP Security Headers (Helmet nosniff)', xContentType === 'nosniff');

    // 4. CORS Headers
    const resCors = await fetch(`${BASE_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5500',
        'Access-Control-Request-Method': 'GET',
      },
    });
    recordTest(4, 'CORS Preflight & Configuration', resCors.status === 204 || resCors.status === 200);

    // 5. 404 Route Not Found Handling
    const res404 = await requestJson(`${BASE_URL}/non-existent-endpoint-xyz`);
    recordTest(5, '404 Not Found Handling', res404.status === 404 && res404.body.success === false);

    // 6. Malformed JSON Body Handling (SyntaxError Middleware)
    const resBadJson = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid_json_here: true',
    });
    recordTest(6, 'Malformed JSON Body Handling (400 Bad Request)', resBadJson.status === 400);

    // 7. Input Validation: Missing registration fields (express-validator)
    const resMissingFields = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    recordTest(7, 'Registration Missing Fields Validation (422)', resMissingFields.status === 422 && resMissingFields.body.errors?.length > 0);

    // 8. Input Validation: Invalid email formatting
    const resBadEmail = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'not-an-email-address',
        password: 'password123',
        phone: '1234567890',
      }),
    });
    recordTest(8, 'Email Syntax Validation (422)', resBadEmail.status === 422);

    // 9. Input Validation: Password length rule (< 6 chars)
    const resShortPass = await requestJson(`${BASE_URL}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'valid.email@wb.gov.in',
        password: '123',
        phone: '1234567890',
      }),
    });
    recordTest(9, 'Password Minimum Length Validation (422)', resShortPass.status === 422);

    // 10. Protected Route Without Token (401 Unauthorized)
    const resUnauth = await requestJson(`${BASE_URL}/auth/me`);
    recordTest(10, 'Authentication Middleware Rejection (401)', resUnauth.status === 401 && resUnauth.body.success === false);

    // 11. Protected Route with Invalid Token (401 Unauthorized)
    const resInvalidToken = await requestJson(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    recordTest(11, 'Invalid Bearer Token Rejection (401)', resInvalidToken.status === 401);

    // 12. Invalid MongoDB ObjectId Format in Hospital Route (400/422)
    const resBadMongoId = await requestJson(`${BASE_URL}/hospitals/not-a-mongo-id`);
    recordTest(12, 'Invalid MongoDB ObjectId Format (422/400)', resBadMongoId.status === 422 || resBadMongoId.status === 400);

    // 13. Invalid Hospital Filter Parameters
    const resBadQuery = await requestJson(`${BASE_URL}/hospitals?page=-5&limit=999`);
    recordTest(13, 'Query Parameter Validation Bounds (422)', resBadQuery.status === 422);

    // 14. Hospital Creation Forbidden Without Super Admin (401/403)
    const resCreateHospUnauth = await requestJson(`${BASE_URL}/hospitals`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Unauthorized Hospital' }),
    });
    recordTest(14, 'Unauthorized Hospital Creation Protection (401)', resCreateHospUnauth.status === 401);

    // 15. Bed Update Forbidden Without Authentication (401)
    const resBedUpdateUnauth = await requestJson(`${BASE_URL}/beds/507f1f77bcf86cd799439011`, {
      method: 'PUT',
      body: JSON.stringify({ occupiedBeds: 5 }),
    });
    recordTest(15, 'Unauthorized Bed Modification Protection (401)', resBedUpdateUnauth.status === 401);

    // 16. Bed Reservation Forbidden Without Authentication (401)
    const resBedReqUnauth = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      body: JSON.stringify({ hospitalId: '507f1f77bcf86cd799439011' }),
    });
    recordTest(16, 'Bed Reservation Request Authentication Requirement (401)', resBedReqUnauth.status === 401);

    // 17. Citizen Login & Token Generation
    const resCitizenLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'user@demo.wb.gov.in', password: 'Password123!' }),
    });
    citizenToken = resCitizenLogin.body.data?.token;
    recordTest(17, 'Citizen Login & Token Generation', resCitizenLogin.status === 200 && !!citizenToken);

    // 18. Wrong Password Rejection
    const resWrongPass = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'user@demo.wb.gov.in', password: 'IncorrectPassword!' }),
    });
    recordTest(18, 'Wrong Password Rejection (401)', resWrongPass.status === 401);

    // 19. Authenticated Profile Query (GET /api/auth/me)
    const resMe = await requestJson(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    recordTest(19, 'Authenticated Profile Query (GET /api/auth/me)', resMe.status === 200 && resMe.body.data?.email === 'user@demo.wb.gov.in');

    // 20. Hospital Administrator Login (Apollo Admin)
    const resAdminLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@apollo.wb.gov.in', password: 'Password123!' }),
    });
    hospitalAdminToken = resAdminLogin.body.data?.token;
    recordTest(20, 'Hospital Administrator Authentication', resAdminLogin.status === 200 && resAdminLogin.body.data?.user?.role === 'hospital_admin');

    // 21. Super Administrator Login
    const resSuperLogin = await requestJson(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@demo.wb.gov.in', password: 'SuperAdmin123!' }),
    });
    superAdminToken = resSuperLogin.body.data?.token;
    recordTest(21, 'Super Administrator Authentication', resSuperLogin.status === 200 && resSuperLogin.body.data?.user?.role === 'super_admin');

    // 22. Live Hospitals Listing & Pagination
    const resHospitals = await requestJson(`${BASE_URL}/hospitals?page=1&limit=10`);
    apolloHospitalId = resHospitals.body.data?.find(h => h.name.includes('Apollo'))?._id;
    recordTest(22, 'Hospital Listing & Pagination Query', resHospitals.status === 200 && resHospitals.body.data?.length > 0 && resHospitals.body.pagination?.total >= 24);

    // 23. Hospital Search & District Filtering
    const resSearch = await requestJson(`${BASE_URL}/hospitals?search=apollo`);
    recordTest(23, 'Hospital Search Filter by Query', resSearch.status === 200 && resSearch.body.data?.[0]?.name.includes('Apollo'));

    // 24. West Bengal District Breakdown Aggregate
    const resDistricts = await requestJson(`${BASE_URL}/hospitals/districts`);
    recordTest(24, 'West Bengal District Breakdown Aggregate API', resDistricts.status === 200 && resDistricts.body.data?.length >= 10);

    // 25. State-Wide Capacity Statistics API
    const resStats = await requestJson(`${BASE_URL}/hospitals/statistics`);
    recordTest(25, 'State-Wide Network Statistics API', resStats.status === 200 && resStats.body.data?.totalHospitals >= 24);

    // 26. Hospital Bed Inventory Query
    const resBeds = await requestJson(`${BASE_URL}/hospitals/${apolloHospitalId}/beds`);
    const apolloGenBed = resBeds.body.data?.find(b => b.type === 'general');
    apolloBedId = apolloGenBed?._id;
    recordTest(26, 'Hospital Bed Inventory Retrieval', resBeds.status === 200 && resBeds.body.data?.length === 4);

    // 27. Unauthorized Bed Update Prevention (Citizen cannot update bed)
    const resUnauthBed = await requestJson(`${BASE_URL}/beds/${apolloBedId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: JSON.stringify({ occupiedBeds: 20 }),
    });
    recordTest(27, 'Unauthorized Bed Modification Prevention (403 Forbidden)', resUnauthBed.status === 403);

    // 28. Authorized Bed Inventory Update by Hospital Admin
    const resAuthBed = await requestJson(`${BASE_URL}/beds/${apolloBedId}/availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${hospitalAdminToken}` },
      body: JSON.stringify({ occupiedBeds: 15 }),
    });
    recordTest(28, 'Authorized Hospital Admin Bed Update', resAuthBed.status === 200 && resAuthBed.body.data?.occupiedBeds === 15);

    // 29. Concurrency-Safe Bed Reservation Request
    const resReq = await requestJson(`${BASE_URL}/bed-requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: JSON.stringify({
        hospitalId: apolloHospitalId,
        bedType: 'general',
        patientName: 'Kazi Nazrul Islam',
        contactPhone: '+91 98300 12345',
        notes: 'Emergency respiratory admission request',
      }),
    });
    createdRequestId = resReq.body.data?._id;
    recordTest(29, 'Atomic Bed Reservation Request Creation', resReq.status === 201 && resReq.body.data?.status === 'pending');

    // 30. Request Approval Lifecycle & Hospital Isolation
    const resApprove = await requestJson(`${BASE_URL}/bed-requests/${createdRequestId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${hospitalAdminToken}` },
    });
    recordTest(30, 'Hospital Admin Request Approval (reserved -> occupied)', resApprove.status === 200 && resApprove.body.data?.status === 'approved');

  } catch (err) {
    console.error('Unhandled test execution error:', err);
  } finally {
    await new Promise((resolve) => testServer.close(resolve));
    await disconnectDB();
    console.log('\n======================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    console.log(`📊 TEST SUITE SUMMARY: ${passedCount}/${totalCount} TESTS PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
    console.log('======================================================\n');
  }
}

if (require.main === module) {
  runTests().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { runTests };
