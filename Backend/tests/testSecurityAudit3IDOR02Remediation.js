/**
 * testSecurityAudit3IDOR02Remediation.js
 * Dedicated verification suite for SEC3-IDOR-02:
 * Medical Shop Tenant Ownership Verification
 * (PUT /api/medical-shops/:id & DELETE /api/medical-shops/:id)
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
const MedicalShop = require('../models/MedicalShop');
const generateToken = require('../utils/generateToken');

const TEST_PORT = 5007;
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
  console.log('SEC3-IDOR-02 REMEDIATION VERIFICATION SUITE');
  console.log('Medical Shop Tenant Ownership Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;
  let testServer;

  function record(id, title, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] Test ${id.toString().padStart(2, '0')}: ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${id.toString().padStart(2, '0')}: ${title} - ${details}`);
      failed++;
    }
  }

  const createdUserIds = [];
  const createdShopIds = [];

  try {
    await connectDB();

    testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));

    // 1. Resolve 2 existing active hospitals for tenant isolation testing
    const hospitals = await Hospital.find({ isActive: true }).limit(2);
    if (hospitals.length < 2) {
      throw new Error('At least 2 active hospitals required in database');
    }
    const hospitalA = hospitals[0];
    const hospitalB = hospitals[1];

    // 2. Setup Test Users
    const timestamp = Date.now();

    const adminHospA = await User.create({
      name: 'Admin Hospital Alpha',
      email: `admin.hosp.a.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830001111',
      role: 'hospital_admin',
      hospital: hospitalA._id,
      isActive: true,
    });
    createdUserIds.push(adminHospA._id);

    const admin2HospA = await User.create({
      name: 'Second Admin Hospital Alpha',
      email: `admin2.hosp.a.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830002222',
      role: 'hospital_admin',
      hospital: hospitalA._id,
      isActive: true,
    });
    createdUserIds.push(admin2HospA._id);

    const adminHospB = await User.create({
      name: 'Admin Hospital Beta',
      email: `admin.hosp.b.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830003333',
      role: 'hospital_admin',
      hospital: hospitalB._id,
      isActive: true,
    });
    createdUserIds.push(adminHospB._id);

    const citizen = await User.create({
      name: 'Ordinary Citizen User',
      email: `citizen.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830004444',
      role: 'user',
      isActive: true,
    });
    createdUserIds.push(citizen._id);

    const superAdmin = await User.create({
      name: 'Super Admin SEC3-IDOR-02',
      email: `super.admin.${timestamp}@wbhealth.com`,
      passwordHash: '$2a$10$hashedpasswordsampleforverification',
      phone: '9830005555',
      role: 'super_admin',
      isActive: true,
    });
    createdUserIds.push(superAdmin._id);

    // Auth Tokens
    const tokenAdminA = generateToken(adminHospA);
    const tokenAdminA2 = generateToken(admin2HospA);
    const tokenAdminB = generateToken(adminHospB);
    const tokenCitizen = generateToken(citizen);
    const tokenSuperAdmin = generateToken(superAdmin);

    // 3. Setup Test Medical Shops
    // Shop A belongs to Hospital A
    const originalShopAPhone = '+91 98311 11111';
    const originalShopAName = `Alpha Pharmacy ${timestamp}`;
    const shopA = await MedicalShop.create({
      name: originalShopAName,
      address: '10 Alpha Health Blvd',
      area: 'Salt Lake',
      city: 'Kolkata',
      district: 'North 24 Parganas',
      phone: originalShopAPhone,
      is24x7: true,
      hospital: hospitalA._id,
      createdBy: adminHospA._id,
      isActive: true,
    });
    createdShopIds.push(shopA._id);

    // Shop B belongs to Hospital B
    const originalShopBPhone = '+91 98322 22222';
    const originalShopBName = `Beta Pharmacy ${timestamp}`;
    const shopB = await MedicalShop.create({
      name: originalShopBName,
      address: '20 Beta Health Ave',
      area: 'Barasat',
      city: 'Barasat',
      district: 'North 24 Parganas',
      phone: originalShopBPhone,
      is24x7: true,
      hospital: hospitalB._id,
      createdBy: adminHospB._id,
      isActive: true,
    });
    createdShopIds.push(shopB._id);

    console.log('--- SUITE 1: AUTHENTICATION ENFORCEMENT ---');

    // 1. Unauthenticated PUT → 401
    const resUnauthPut = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'PUT',
      body: JSON.stringify({ phone: '+91 99999 99999' }),
    });
    record(1, 'Unauthenticated PUT request rejected with 401', resUnauthPut.status === 401, `Status: ${resUnauthPut.status}`);

    // 2. Unauthenticated DELETE → 401
    const resUnauthDel = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'DELETE',
    });
    record(2, 'Unauthenticated DELETE request rejected with 401', resUnauthDel.status === 401, `Status: ${resUnauthDel.status}`);

    // 3. Invalid JWT PUT → 401
    const resInvalidJwtPut = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer forged.invalid.token' },
      body: JSON.stringify({ phone: '+91 99999 99999' }),
    });
    record(3, 'Invalid JWT token on PUT rejected with 401', resInvalidJwtPut.status === 401, `Status: ${resInvalidJwtPut.status}`);

    // 4. Invalid JWT DELETE → 401
    const resInvalidJwtDel = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer forged.invalid.token' },
    });
    record(4, 'Invalid JWT token on DELETE rejected with 401', resInvalidJwtDel.status === 401, `Status: ${resInvalidJwtDel.status}`);

    console.log('\n--- SUITE 2: TENANT ISOLATION ---');

    // 5. Hospital A authorized user can update Hospital A Medical Shop
    const updatedPhoneA = '+91 98311 99999';
    const resHospAUpdateOwn = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ phone: updatedPhoneA }),
    });
    record(
      5,
      'Hospital A authorized admin can update Hospital A Medical Shop (200 OK)',
      resHospAUpdateOwn.status === 200 && resHospAUpdateOwn.body.medicalShop?.phone === updatedPhoneA,
      `Status: ${resHospAUpdateOwn.status}`
    );

    // 6. Hospital A authorized peer admin can also update Hospital A Medical Shop
    const staffUpdatedPhoneA = '+91 98311 88888';
    const resHospAStaffUpdateOwn = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA2}` },
      body: JSON.stringify({ phone: staffUpdatedPhoneA }),
    });
    record(
      6,
      'Hospital A authorized peer admin can update Hospital A Medical Shop (200 OK)',
      resHospAStaffUpdateOwn.status === 200 && resHospAStaffUpdateOwn.body.medicalShop?.phone === staffUpdatedPhoneA,
      `Status: ${resHospAStaffUpdateOwn.status}`
    );

    // 7. Hospital A user cannot update Hospital B Medical Shop
    const resHospAUpdateShopB = await requestJson(`${BASE_URL}/medical-shops/${shopB._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ phone: '+91 99999 00000', name: 'Malicious Hijacked Name' }),
    });
    record(
      7,
      'Hospital A user blocked from updating Hospital B Medical Shop (403 Forbidden)',
      resHospAUpdateShopB.status === 403 && resHospAUpdateShopB.body.success === false,
      `Status: ${resHospAUpdateShopB.status}`
    );

    // 8. Hospital A user cannot delete Hospital B Medical Shop
    const resHospADeleteShopB = await requestJson(`${BASE_URL}/medical-shops/${shopB._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    record(
      8,
      'Hospital A user blocked from deleting Hospital B Medical Shop (403 Forbidden)',
      resHospADeleteShopB.status === 403 && resHospADeleteShopB.body.success === false,
      `Status: ${resHospADeleteShopB.status}`
    );

    console.log('\n--- SUITE 3: OWNERSHIP / ROLE CHECKS ---');

    // 9. Unauthorized role (Citizen/user) cannot update any shop
    const resCitizenUpdate = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenCitizen}` },
      body: JSON.stringify({ phone: '+91 99999 11111' }),
    });
    record(
      9,
      'Unauthorized role (citizen) rejected from updating shop with 403 Forbidden',
      resCitizenUpdate.status === 403,
      `Status: ${resCitizenUpdate.status}`
    );

    // 10. Unauthorized role (Citizen/user) cannot delete any shop
    const resCitizenDelete = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCitizen}` },
    });
    record(
      10,
      'Unauthorized role (citizen) rejected from deleting shop with 403 Forbidden',
      resCitizenDelete.status === 403,
      `Status: ${resCitizenDelete.status}`
    );

    // 11. Super Admin retains global administrative access to update and delete
    const superAdminPhoneUpdate = '+91 98322 77777';
    const resSuperAdminUpdate = await requestJson(`${BASE_URL}/medical-shops/${shopB._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
      body: JSON.stringify({ phone: superAdminPhoneUpdate }),
    });
    record(
      11,
      'Super Admin retains global access to update any medical shop (200 OK)',
      resSuperAdminUpdate.status === 200 && resSuperAdminUpdate.body.medicalShop?.phone === superAdminPhoneUpdate,
      `Status: ${resSuperAdminUpdate.status}`
    );

    console.log('\n--- SUITE 4: ID & PAYLOAD MANIPULATION DEFENSES ---');

    // 12. Changing :id to another tenant shop cannot bypass authorization
    const resManipulatedId = await requestJson(`${BASE_URL}/medical-shops/${shopB._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ name: 'Tampered' }),
    });
    record(
      12,
      'Supplying another tenant :id in URL is strictly blocked (403 Forbidden)',
      resManipulatedId.status === 403,
      `Status: ${resManipulatedId.status}`
    );

    // 13. Changing hospital in request body cannot bypass authorization or reassign ownership
    const resBodyHospitalTamper = await requestJson(`${BASE_URL}/medical-shops/${shopB._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ hospital: hospitalA._id.toString(), phone: '+91 98888 88888' }),
    });
    record(
      13,
      'Attempting to reassign hospital tenant in request body is blocked with 403 Forbidden',
      resBodyHospitalTamper.status === 403,
      `Status: ${resBodyHospitalTamper.status}`
    );

    // 14. Passing createdBy / owner in request body is ignored and blocked
    const resBodyOwnerTamper = await requestJson(`${BASE_URL}/medical-shops/${shopB._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ createdBy: adminHospA._id.toString() }),
    });
    record(
      14,
      'Attempting to reassign createdBy in request body is blocked with 403 Forbidden',
      resBodyOwnerTamper.status === 403,
      `Status: ${resBodyOwnerTamper.status}`
    );

    console.log('\n--- SUITE 5: NONEXISTENT & MALFORMED IDENTIFIERS ---');

    // 15. Nonexistent Medical Shop update → existing expected 404 behavior
    const nonExistentMongoId = '507f1f77bcf86cd799439011';
    const resNonexistentPut = await requestJson(`${BASE_URL}/medical-shops/${nonExistentMongoId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
      body: JSON.stringify({ phone: '+91 98311 00000' }),
    });
    record(
      15,
      'Nonexistent Medical Shop update returns 404 Not Found',
      resNonexistentPut.status === 404 && resNonexistentPut.body.success === false,
      `Status: ${resNonexistentPut.status}`
    );

    // 16. Nonexistent Medical Shop delete → existing expected 404 behavior
    const resNonexistentDel = await requestJson(`${BASE_URL}/medical-shops/${nonExistentMongoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    record(
      16,
      'Nonexistent Medical Shop delete returns 404 Not Found',
      resNonexistentDel.status === 404 && resNonexistentDel.body.success === false,
      `Status: ${resNonexistentDel.status}`
    );

    console.log('\n--- SUITE 6: DATABASE STATE & INTEGRITY VERIFICATION ---');

    // 17. Unauthorized PUT does not modify the target Medical Shop in MongoDB
    const shopBDocAfterAttempts = await MedicalShop.findById(shopB._id).lean();
    record(
      17,
      'Database Integrity: Unauthorized PUT attempts did NOT modify Shop B in MongoDB',
      shopBDocAfterAttempts.name === originalShopBName && shopBDocAfterAttempts.hospital.toString() === hospitalB._id.toString(),
      `Stored Name: "${shopBDocAfterAttempts.name}", Stored Hospital: ${shopBDocAfterAttempts.hospital}`
    );

    // 18. Unauthorized DELETE does not delete the target Medical Shop in MongoDB
    record(
      18,
      'Database Integrity: Unauthorized DELETE attempt did NOT delete Shop B from MongoDB',
      shopBDocAfterAttempts != null && shopBDocAfterAttempts._id.toString() === shopB._id.toString(),
      `Shop B exists in DB: ${Boolean(shopBDocAfterAttempts)}`
    );

    // 19. Hospital A authorized admin can delete Hospital A's own Medical Shop
    const resHospADeleteOwn = await requestJson(`${BASE_URL}/medical-shops/${shopA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` },
    });
    const shopADocAfterDelete = await MedicalShop.findById(shopA._id);
    record(
      19,
      'Hospital A authorized admin can delete Hospital A own Medical Shop and remove from DB',
      resHospADeleteOwn.status === 200 && shopADocAfterDelete === null,
      `Delete Status: ${resHospADeleteOwn.status}, Exists in DB: ${Boolean(shopADocAfterDelete)}`
    );

  } finally {
    // Cleanup created test records
    try {
      if (createdShopIds.length) {
        await MedicalShop.deleteMany({ _id: { $in: createdShopIds } });
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
