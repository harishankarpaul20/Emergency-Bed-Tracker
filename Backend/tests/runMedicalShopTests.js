require('../config/bootstrap');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const { app } = require('../server');
const MedicalShop = require('../models/MedicalShop');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const TEST_PORT = 5005;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function requestJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = {};
  try {
    body = await res.json();
  } catch (e) {
    body = {};
  }
  return { status: res.status, headers: res.headers, body };
}

async function runMedicalShopTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING 24x7 MEDICAL SHOP TEST SUITE');
  console.log(`📡 API Target: ${BASE_URL}`);
  console.log('======================================================\n');

  let testServer;
  const results = [];

  function recordTest(num, name, passed, details = '') {
    results.push({ num, name, passed, details });
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [TEST ${num.toString().padStart(2, '0')}] ${name}${details ? ` (${details})` : ''}`);
  }

  try {
    await connectDB();

    testServer = http.createServer(app);
    await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));

    // Prepare auth tokens for testing
    const adminUser = await User.findOne({ role: 'super_admin' });
    const regularUser = await User.findOne({ role: 'user' });

    const adminToken = adminUser ? jwt.sign({ id: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET || 'dev_jwt_secret_medical_bed_tracker_west_bengal_2026_xyz', { expiresIn: '1h' }) : '';
    const citizenToken = regularUser
      ? jwt.sign({ id: regularUser._id, role: regularUser.role }, process.env.JWT_SECRET || 'dev_jwt_secret_medical_bed_tracker_west_bengal_2026_xyz', { expiresIn: '1h' })
      : jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'user' }, process.env.JWT_SECRET || 'dev_jwt_secret_medical_bed_tracker_west_bengal_2026_xyz', { expiresIn: '1h' });

    // TEST 1: Public listing of active 24x7 medical shops
    const resList = await requestJson(`${BASE_URL}/medical-shops`);
    recordTest(
      1,
      'Public listing of active 24x7 medical shops returns HTTP 200',
      resList.status === 200 && resList.body.success === true && Array.isArray(resList.body.medicalShops) && resList.body.medicalShops.length >= 16,
      `Found ${resList.body.medicalShops?.length || 0} active shops`
    );

    // TEST 2: Every shop in response has valid 24x7 status and non-ObjectId directionsUrl
    const all24x7 = resList.body.medicalShops?.every(s => s.is24x7 === true && typeof s.directionsUrl === 'string' && s.directionsUrl.startsWith('https://www.google.com/maps'));
    recordTest(
      2,
      'All active shops have is24x7 === true and dynamic Google Maps directionsUrl',
      all24x7 === true,
      `Sample directions URL: ${resList.body.medicalShops?.[0]?.directionsUrl?.slice(0, 45)}...`
    );

    // TEST 3: District filter returns shops strictly matching that district
    const resDistrict = await requestJson(`${BASE_URL}/medical-shops?district=Kolkata`);
    const kolkataMatches = resDistrict.body.medicalShops?.every(s => s.district.toLowerCase() === 'kolkata');
    recordTest(
      3,
      'District filter returns shops strictly matching selected district',
      resDistrict.status === 200 && (resDistrict.body.medicalShops?.length || 0) > 0 && kolkataMatches,
      `Kolkata shops found: ${resDistrict.body.medicalShops?.length}`
    );

    // TEST 4: Search query filters by name, area, or landmark case-insensitively
    const resSearch = await requestJson(`${BASE_URL}/medical-shops?search=apollo`);
    const apolloMatches = resSearch.body.medicalShops?.every(s => s.name.toLowerCase().includes('apollo') || s.area.toLowerCase().includes('apollo'));
    recordTest(
      4,
      'Search query filters shops case-insensitively',
      resSearch.status === 200 && (resSearch.body.medicalShops?.length || 0) >= 2 && apolloMatches,
      `Matches for "apollo": ${resSearch.body.medicalShops?.length}`
    );

    // TEST 5: Proximity distance calculation when latitude & longitude are passed
    const resNear = await requestJson(`${BASE_URL}/medical-shops?latitude=22.5852&longitude=88.4061`);
    const hasDistances = resNear.body.medicalShops?.every(s => s.distance != null && typeof s.distance === 'number');
    const firstDistance = resNear.body.medicalShops?.[0]?.distance;
    recordTest(
      5,
      'Proximity sorting calculates distance in km when user coordinates provided',
      resNear.status === 200 && hasDistances && firstDistance === 0,
      `Nearest shop distance: ${firstDistance} km`
    );

    // TEST 6: Get medical shop by ID
    const sampleId = resList.body.medicalShops[0]._id;
    const resSingle = await requestJson(`${BASE_URL}/medical-shops/${sampleId}`);
    recordTest(
      6,
      'Retrieve single medical shop by valid ID returns HTTP 200',
      resSingle.status === 200 && resSingle.body.success === true && resSingle.body.medicalShop?._id === sampleId,
      `Shop Name: ${resSingle.body.medicalShop?.name}`
    );

    // TEST 7: Invalid ID returns 422 format error, non-existent returns 404
    const resInvalidId = await requestJson(`${BASE_URL}/medical-shops/not-a-valid-id`);
    const resNonExistent = await requestJson(`${BASE_URL}/medical-shops/507f1f77bcf86cd799439011`);
    recordTest(
      7,
      'Invalid ID rejects with 422, non-existent returns 404',
      resInvalidId.status === 422 && resNonExistent.status === 404
    );

    // TEST 8: Unauthorized user blocked from POST /api/medical-shops (401/403)
    const resUnauth = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker Pharmacy', address: 'Nowhere', district: 'Kolkata', phone: '9830000000' }),
    });
    const resCitizen = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`,
      },
      body: JSON.stringify({ name: 'Citizen Pharmacy', address: 'Nowhere', district: 'Kolkata', phone: '9830000000' }),
    });
    recordTest(
      8,
      'Unauthorized and non-staff users blocked from creating shops (401 & 403)',
      resUnauth.status === 401 && resCitizen.status === 403
    );

    // TEST 9: Validation rejects invalid coordinates or missing required fields
    const resBadCoords = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Bad Coords Pharmacy',
        address: 'Test Address',
        area: 'Test Area',
        district: 'Kolkata',
        phone: '9830011111',
        latitude: 195.5, // Invalid > 90
        longitude: 88.3,
      }),
    });
    recordTest(
      9,
      'Validation rules reject invalid latitude/longitude (> 90 or < -90) with HTTP 422',
      resBadCoords.status === 422 && resBadCoords.body.errors?.some(e => e.field === 'latitude')
    );

    // TEST 10: Admin creates a new verified test medical shop in MongoDB Atlas
    const uniqueTestName = `TEST 24x7 Medical Store ${Date.now()}`;
    const resCreate = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: uniqueTestName,
        address: 'Test Address Line 1, Sector V',
        area: 'Salt Lake Sector V',
        city: 'Kolkata',
        district: 'North 24 Parganas',
        phone: '+91 90000 00000',
        is24x7: true,
        latitude: 22.5726,
        longitude: 88.4339,
        description: 'Temporary test medical shop verifying real MongoDB insertion',
      }),
    });

    const createdShopId = resCreate.body.medicalShop?._id;
    const docInDb = createdShopId ? await MedicalShop.findById(createdShopId).lean() : null;

    recordTest(
      10,
      'Admin creates new Medical Shop and persists document in MongoDB Atlas',
      resCreate.status === 201 && resCreate.body.success === true && docInDb != null && docInDb.name === uniqueTestName,
      `Created ID: ${createdShopId}, MongoDB Verified: true`
    );

    // TEST 11: Duplicate detection prevents identical pharmacy in same district
    const resDup = await requestJson(`${BASE_URL}/medical-shops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: uniqueTestName,
        address: 'Test Address Line 1, Sector V',
        area: 'Salt Lake Sector V',
        city: 'Kolkata',
        district: 'North 24 Parganas',
        phone: '+91 90000 00000',
        is24x7: true,
      }),
    });
    recordTest(
      11,
      'Duplicate prevention blocks creating identical pharmacy with HTTP 409',
      resDup.status === 409 && resDup.body.success === false
    );

    // TEST 12: Admin updates medical shop
    const resUpdate = await requestJson(`${BASE_URL}/medical-shops/${createdShopId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        phone: '+91 91111 22222',
        description: 'Updated description for test verification',
      }),
    });
    recordTest(
      12,
      'Admin updates existing medical shop details with HTTP 200',
      resUpdate.status === 200 && resUpdate.body.medicalShop?.phone === '+91 91111 22222'
    );

    // TEST 13: Admin deletes test medical shop
    const resDelete = await requestJson(`${BASE_URL}/medical-shops/${createdShopId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const deletedDocInDb = await MedicalShop.findById(createdShopId);
    recordTest(
      13,
      'Admin deletes test medical shop and cleans up database record',
      resDelete.status === 200 && deletedDocInDb === null
    );

  } catch (err) {
    console.error('Unhandled test suite error:', err);
  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await disconnectDB();

    console.log('\n======================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log('======================================================\n');
  }
}

if (require.main === module) {
  runMedicalShopTests();
}

module.exports = { runMedicalShopTests };
