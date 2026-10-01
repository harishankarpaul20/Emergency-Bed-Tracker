/**
 * testSecurityAudit3Remediation.js
 * Automated verification suite for SEC3-IDOR-01:
 * Blood Request Object-Level Authorization (GET /api/blood-requests/:id)
 */

require('../config/bootstrap');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remediation_verification_only_32bytes!';
}

const { app } = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const BloodRequest = require('../models/BloodRequest');
const generateToken = require('../utils/generateToken');

let server;
let baseUrl;

function makeRequest(method, endpoint, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('SEC3-IDOR-01 REMEDIATION VERIFICATION SUITE');
  console.log('Blood Request Object-Level Authorization');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(id, title, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] Test ${id}: ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${id}: ${title} - ${details}`);
      failed++;
    }
  }

  // 1. Start server on dynamic port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  await connectDB();

  // Test artifacts to clean up
  const createdUserIds = [];
  const createdHospitalIds = [];
  const createdRequestIds = [];

  try {
    // 2. Setup Test Fixtures: Hospitals
    const hospitals = await Hospital.find({ isActive: true }).limit(2);
    if (hospitals.length < 2) {
      throw new Error('At least 2 active hospitals required in DB for tests');
    }
    const hospitalA = hospitals[0];
    const hospitalB = hospitals[1];

    // 3. Setup Test Fixtures: Users
    const timestamp = Date.now();
    const citizenA = await User.create({
      name: 'Citizen Alpha',
      email: `citizen.alpha.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830000001',
      role: 'user',
      isActive: true,
    });
    createdUserIds.push(citizenA._id);

    const citizenB = await User.create({
      name: 'Citizen Beta',
      email: `citizen.beta.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830000002',
      role: 'user',
      isActive: true,
    });
    createdUserIds.push(citizenB._id);

    const adminHospA = await User.create({
      name: 'Admin Hosp Alpha',
      email: `admin.alpha.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830000003',
      role: 'hospital_admin',
      hospital: hospitalA._id,
      isActive: true,
    });
    createdUserIds.push(adminHospA._id);

    const staffHospA = await User.create({
      name: 'Doctor Hosp Alpha',
      email: `doc.alpha.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830000004',
      role: 'doctor',
      hospital: hospitalA._id,
      isActive: true,
    });
    createdUserIds.push(staffHospA._id);

    const superAdmin = await User.create({
      name: 'Super Admin SEC3',
      email: `super.admin.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830000005',
      role: 'super_admin',
      isActive: true,
    });
    createdUserIds.push(superAdmin._id);

    // Tokens
    const tokenCitizenA = generateToken(citizenA);
    const tokenCitizenB = generateToken(citizenB);
    const tokenAdminHospA = generateToken(adminHospA);
    const tokenStaffHospA = generateToken(staffHospA);
    const tokenSuperAdmin = generateToken(superAdmin);

    // 4. Setup Test Fixtures: Blood Requests
    // Request 1: Owned by Citizen A, target recipients: Hospital A
    const customReqIdA = `BR-${Math.floor(10000 + Math.random() * 89999)}`;
    const secretPatientNameA = 'Confidential Patient Alpha';
    const secretPatientPhoneA = '9839999999';
    const secretClinicalNotesA = 'Clinical Diagnosis: Severe Acute Anemia requiring Whole Blood';

    const bloodReqA = await BloodRequest.create({
      requestId: customReqIdA,
      requestType: 'BLOOD',
      patient: {
        name: secretPatientNameA,
        age: 35,
        gender: 'Female',
        contactPhone: secretPatientPhoneA,
      },
      requester: {
        user: citizenA._id,
        userId: citizenA._id,
        name: citizenA.name,
        contact: citizenA.phone,
        role: 'USER',
        relationshipToPatient: 'Family Member',
      },
      bloodRequirement: {
        bloodGroup: 'B+',
        component: 'Whole Blood',
        quantity: 2,
        urgency: 'EMERGENCY',
      },
      reason: secretClinicalNotesA,
      notes: secretClinicalNotesA,
      recipients: [
        {
          hospital: hospitalA._id,
          status: 'PENDING',
          reservedUnits: 0,
        },
      ],
      status: 'PENDING',
    });
    createdRequestIds.push(bloodReqA._id);

    // Request 2: Strictly between Hospital B and Citizen B (Hospital A is completely unrelated)
    const customReqIdB = `BR-${Math.floor(10000 + Math.random() * 89999)}`;
    const secretPatientNameB = 'Confidential Patient Beta';
    const secretPatientPhoneB = '9840000000';
    const secretClinicalNotesB = 'Clinical Diagnosis: Acute Trauma Hemorrhage';

    const bloodReqB = await BloodRequest.create({
      requestId: customReqIdB,
      requestType: 'BLOOD',
      patient: {
        name: secretPatientNameB,
        age: 50,
        gender: 'Male',
        contactPhone: secretPatientPhoneB,
      },
      requester: {
        user: citizenB._id,
        userId: citizenB._id,
        name: citizenB.name,
        contact: citizenB.phone,
        role: 'USER',
        relationshipToPatient: 'Self',
      },
      bloodRequirement: {
        bloodGroup: 'O+',
        component: 'Packed RBC',
        quantity: 3,
        urgency: 'EMERGENCY',
      },
      reason: secretClinicalNotesB,
      notes: secretClinicalNotesB,
      recipients: [
        {
          hospital: hospitalB._id,
          status: 'PENDING',
          reservedUnits: 0,
        },
      ],
      fulfillingHospital: hospitalB._id,
      status: 'PENDING',
    });
    createdRequestIds.push(bloodReqB._id);

    console.log('--- SUITE 1: AUTHENTICATION ENFORCEMENT ---');

    // 1. Unauthenticated request → 401
    const resUnauth = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`);
    record(1, 'Unauthenticated request returns 401 Unauthorized', resUnauth.status === 401, `Status: ${resUnauth.status}`);

    // 2. Invalid token → 401
    const resInvalidToken = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: 'Bearer invalid.bogus.token.signature',
    });
    record(2, 'Invalid authorization token returns 401 Unauthorized', resInvalidToken.status === 401, `Status: ${resInvalidToken.status}`);

    console.log('\n--- SUITE 2: CITIZEN OWNERSHIP & ISOLATION ---');

    // 3. Request owner → 200
    const resOwner = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: `Bearer ${tokenCitizenA}`,
    });
    record(
      3,
      'Request owner (Citizen A) can retrieve own blood request (200 OK)',
      resOwner.status === 200 && resOwner.body?.data?.patient?.name === secretPatientNameA,
      `Status: ${resOwner.status}`
    );

    // 4. Different citizen → 403
    const resDiffCitizen = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: `Bearer ${tokenCitizenB}`,
    });
    record(
      4,
      'Different citizen (Citizen B) denied access to Citizen A blood request (403 Forbidden)',
      resDiffCitizen.status === 403 && resDiffCitizen.body?.success === false,
      `Status: ${resDiffCitizen.status}`
    );

    // 5. Different citizen using custom requestId → 403
    const resDiffCitizenCustom = await makeRequest('GET', `/api/blood-requests/${customReqIdA}`, {
      Authorization: `Bearer ${tokenCitizenB}`,
    });
    record(
      5,
      'Different citizen (Citizen B) denied access via custom requestId BR-XXXXX (403 Forbidden)',
      resDiffCitizenCustom.status === 403 && resDiffCitizenCustom.body?.success === false,
      `Status: ${resDiffCitizenCustom.status}`
    );

    console.log('\n--- SUITE 3: HOSPITAL ISOLATION & ACCESS CONTROL ---');

    // 6. Hospital A admin → Hospital A request → 200
    const resHospAAdminOwn = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: `Bearer ${tokenAdminHospA}`,
    });
    record(
      6,
      'Hospital A admin can view request targeting Hospital A (200 OK)',
      resHospAAdminOwn.status === 200 && resHospAAdminOwn.body?.data?.patient?.name === secretPatientNameA,
      `Status: ${resHospAAdminOwn.status}`
    );

    // 7. Hospital A admin → Hospital B request → 403
    const resHospAAdminUnrelated = await makeRequest('GET', `/api/blood-requests/${bloodReqB._id}`, {
      Authorization: `Bearer ${tokenAdminHospA}`,
    });
    record(
      7,
      'Hospital A admin denied access to unrelated Hospital B blood request (403 Forbidden)',
      resHospAAdminUnrelated.status === 403 && resHospAAdminUnrelated.body?.success === false,
      `Status: ${resHospAAdminUnrelated.status}`
    );

    // 8. Hospital A staff (doctor) → Hospital B request → 403
    const resHospAStaffUnrelated = await makeRequest('GET', `/api/blood-requests/${bloodReqB._id}`, {
      Authorization: `Bearer ${tokenStaffHospA}`,
    });
    record(
      8,
      'Hospital A staff/doctor denied access to unrelated Hospital B blood request (403 Forbidden)',
      resHospAStaffUnrelated.status === 403 && resHospAStaffUnrelated.body?.success === false,
      `Status: ${resHospAStaffUnrelated.status}`
    );

    console.log('\n--- SUITE 4: PRIVILEGED ROLE ACCESS ---');

    // 9. Super admin → request → 200
    const resSuperAdminReqA = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: `Bearer ${tokenSuperAdmin}`,
    });
    const resSuperAdminReqB = await makeRequest('GET', `/api/blood-requests/${bloodReqB._id}`, {
      Authorization: `Bearer ${tokenSuperAdmin}`,
    });
    record(
      9,
      'Super admin retains unrestricted access to any blood request (200 OK)',
      resSuperAdminReqA.status === 200 && resSuperAdminReqB.status === 200,
      `Status ReqA: ${resSuperAdminReqA.status}, ReqB: ${resSuperAdminReqB.status}`
    );

    console.log('\n--- SUITE 5: IDENTIFIER VALIDATION & NOT-FOUND RESPONSES ---');

    // 10. Malformed MongoDB ID → existing validation response (400)
    const resMalformed = await makeRequest('GET', '/api/blood-requests/invalid-mongo-id-123', {
      Authorization: `Bearer ${tokenCitizenA}`,
    });
    record(
      10,
      'Malformed MongoDB identifier returns 400 Bad Request (CastError handler)',
      resMalformed.status === 400 && Array.isArray(resMalformed.body?.errors),
      `Status: ${resMalformed.status}`
    );

    // 11. Nonexistent MongoDB ID → 404
    const nonExistentMongoId = '507f1f77bcf86cd799439011';
    const resNonexistentMongo = await makeRequest('GET', `/api/blood-requests/${nonExistentMongoId}`, {
      Authorization: `Bearer ${tokenCitizenA}`,
    });
    record(
      11,
      'Nonexistent MongoDB identifier returns 404 Not Found',
      resNonexistentMongo.status === 404 && resNonexistentMongo.body?.success === false,
      `Status: ${resNonexistentMongo.status}`
    );

    // 12. Nonexistent custom requestId → 404
    const resNonexistentCustom = await makeRequest('GET', '/api/blood-requests/BR-99999', {
      Authorization: `Bearer ${tokenCitizenA}`,
    });
    record(
      12,
      'Nonexistent custom requestId (BR-99999) returns 404 Not Found',
      resNonexistentCustom.status === 404 && resNonexistentCustom.body?.success === false,
      `Status: ${resNonexistentCustom.status}`
    );

    console.log('\n--- SUITE 6: SENSITIVE DATA LEAKAGE PROTECTION ---');

    // 13. Unauthorized response contains no patient name
    const raw403Body = JSON.stringify(resDiffCitizen.body);
    const leaksPatientName = raw403Body.includes(secretPatientNameA);
    record(
      13,
      'Unauthorized 403 response contains zero patient name data',
      !leaksPatientName && resDiffCitizen.body?.data === undefined,
      `Leaks patient name: ${leaksPatientName}`
    );

    // 14. Unauthorized response contains no phone
    const leaksPhone = raw403Body.includes(secretPatientPhoneA);
    record(
      14,
      'Unauthorized 403 response contains zero patient contact phone data',
      !leaksPhone,
      `Leaks phone: ${leaksPhone}`
    );

    // 15. Unauthorized response contains no clinical notes
    const leaksNotes = raw403Body.includes(secretClinicalNotesA) || raw403Body.includes('Severe Acute Anemia');
    record(
      15,
      'Unauthorized 403 response contains zero clinical diagnosis or notes data',
      !leaksNotes,
      `Leaks notes: ${leaksNotes}`
    );

    // 16. Unauthorized response contains no hospital-sensitive details
    const leaksHospitalDetails = raw403Body.includes('recipients') || raw403Body.includes(hospitalA.name);
    record(
      16,
      'Unauthorized 403 response contains zero hospital or recipient details',
      !leaksHospitalDetails,
      `Leaks hospital details: ${leaksHospitalDetails}`
    );

    console.log('\n--- SUITE 7: IDENTIFIER RESOLUTION INTEGRITY ---');

    // 17. Authorization works correctly for MongoDB _id
    const authOwnerMongo = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: `Bearer ${tokenCitizenA}`,
    });
    const unauthDiffMongo = await makeRequest('GET', `/api/blood-requests/${bloodReqA._id}`, {
      Authorization: `Bearer ${tokenCitizenB}`,
    });
    record(
      17,
      'Authorization works consistently across MongoDB _id (200 for owner, 403 for unauthorized)',
      authOwnerMongo.status === 200 && unauthDiffMongo.status === 403,
      `Owner: ${authOwnerMongo.status}, Diff: ${unauthDiffMongo.status}`
    );

    // 18. Authorization works correctly for custom requestId
    const authOwnerCustom = await makeRequest('GET', `/api/blood-requests/${customReqIdA}`, {
      Authorization: `Bearer ${tokenCitizenA}`,
    });
    const unauthDiffCustom = await makeRequest('GET', `/api/blood-requests/${customReqIdA}`, {
      Authorization: `Bearer ${tokenCitizenB}`,
    });
    record(
      18,
      'Authorization works consistently across custom requestId (200 for owner, 403 for unauthorized)',
      authOwnerCustom.status === 200 && unauthDiffCustom.status === 403,
      `Owner: ${authOwnerCustom.status}, Diff: ${unauthDiffCustom.status}`
    );

  } finally {
    // Cleanup created test records
    try {
      if (createdRequestIds.length) {
        await BloodRequest.deleteMany({ _id: { $in: createdRequestIds } });
      }
      if (createdUserIds.length) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
    } catch (cleanupErr) {
      console.error('Test cleanup error:', cleanupErr.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
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
