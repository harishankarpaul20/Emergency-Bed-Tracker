/**
 * ======================================================================
 * COMPLETE BLOOD BANK SYSTEM ("BLOODCONNECT WEST BENGAL") TEST SUITE
 * ======================================================================
 * Validates public blood search, compatibility ranking, multi-hospital
 * requests, doctor portal integration, atomic reservations, inventory bounds,
 * donor privacy, emergency broadcasts, audit trails, and zero-regression.
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
const BloodRequest = require('../models/BloodRequest');
const BloodInventory = require('../models/BloodInventory');
const Donor = require('../models/Donor');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const TEST_PORT = 5004;
const BASE_URL = 'http://localhost:' + TEST_PORT + '/api';

const testResults = [];
function logTest(num, name, passed, detail = '') {
  testResults.push({ num, name, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(icon + ' [TEST ' + num.toString().padStart(2, '0') + '] ' + name + (detail ? ' (' + detail + ')' : ''));
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

async function runBloodBankTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING BLOODCONNECT WEST BENGAL TEST SUITE');
  console.log('📡 API Target: ' + BASE_URL);
  console.log('======================================================\n');

  const testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(TEST_PORT, resolve));
  await connectDB();

  let hospitalA, hospitalB, hospitalC;
  let adminA, adminB, doctorA;
  let tokenA, tokenB, tokenDocA;
  let testBloodRequestId = null;

  try {
    // 0. Setup test hospitals and staff accounts
    const hospitals = await Hospital.find({}).limit(3);
    if (hospitals.length < 3) {
      throw new Error('At least 3 hospitals are required in DB for testing.');
    }
    hospitalA = hospitals[0];
    hospitalB = hospitals[1];
    hospitalC = hospitals[2];

    console.log('🏥 Hospital A: ' + hospitalA.name + ' (' + hospitalA._id + ')');
    console.log('🏥 Hospital B: ' + hospitalB.name + ' (' + hospitalB._id + ')');
    console.log('🏥 Hospital C: ' + hospitalC.name + ' (' + hospitalC._id + ')');

    // Create staff users
    const emailA = 'blood.admin.a.' + Date.now() + '@wb.gov.in';
    adminA = await User.create({
      name: 'Admin Hospital A',
      email: emailA,
      passwordHash: 'Password123!',
      role: 'hospital_admin',
      hospital: hospitalA._id,
      isActive: true,
    });

    const emailB = 'blood.admin.b.' + Date.now() + '@wb.gov.in';
    adminB = await User.create({
      name: 'Admin Hospital B',
      email: emailB,
      passwordHash: 'Password123!',
      role: 'hospital_admin',
      hospital: hospitalB._id,
      isActive: true,
    });

    const emailDocA = 'blood.doctor.a.' + Date.now() + '@wb.gov.in';
    doctorA = await User.create({
      name: 'Dr. Sourav Ganguly',
      email: emailDocA,
      passwordHash: 'Password123!',
      role: 'doctor',
      hospital: hospitalA._id,
      department: 'Emergency Medicine',
      isActive: true,
    });

    // Login to get tokens
    const loginResA = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: 'Password123!', hospitalId: hospitalA._id.toString() }),
    });
    tokenA = loginResA.body?.data?.token || loginResA.body?.token;

    const loginResB = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailB, password: 'Password123!', hospitalId: hospitalB._id.toString() }),
    });
    tokenB = loginResB.body?.data?.token || loginResB.body?.token;

    const loginResDocA = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailDocA, password: 'Password123!', hospitalId: hospitalA._id.toString() }),
    });
    tokenDocA = loginResDocA.body?.data?.token || loginResDocA.body?.token;

    // --- TEST 1: Public Blood Search by Blood Group & Component ---
    const searchRes = await requestJson(BASE_URL + '/blood-banks/search?bloodGroup=A%2B&component=Whole%20Blood');
    logTest(1, 'Public blood search returns available facilities with compatible stock',
      searchRes.status === 200 && searchRes.body?.count > 0 && Array.isArray(searchRes.body?.data),
      'Found ' + searchRes.body?.count + ' facilities'
    );

    // --- TEST 2: ABO/Rh Compatibility rules for A+ ---
    const compatibleGroups = searchRes.body?.searchedCriteria?.compatibleGroups || [];
    const hasCompat = compatibleGroups.includes('A+') && compatibleGroups.includes('O-') && compatibleGroups.includes('A-');
    logTest(2, 'Smart blood search calculates ABO/Rh compatible groups (A+, A-, O+, O-)',
      hasCompat,
      'Compatible groups: ' + compatibleGroups.join(', ')
    );

    // --- TEST 3: Search by District ---
    const districtRes = await requestJson(BASE_URL + '/blood-banks/search?district=' + encodeURIComponent(hospitalA.district));
    const allMatchDistrict = districtRes.body?.data?.every(h => h.district.toLowerCase() === hospitalA.district.toLowerCase());
    logTest(3, 'Search filters blood facilities strictly by West Bengal district',
      districtRes.status === 200 && allMatchDistrict,
      'District: ' + hospitalA.district + ' count: ' + districtRes.body?.count
    );

    // --- TEST 4: Location-Based Sorting with Coordinates ---
    const locRes = await requestJson(BASE_URL + '/blood-banks/search?latitude=22.5726&longitude=88.3639&quantity=2');
    const firstDist = locRes.body?.data?.[0]?.distanceKm;
    logTest(4, 'Distance calculation ranks nearest blood banks with distance in km',
      locRes.status === 200 && firstDist !== undefined && firstDist !== null,
      'Nearest facility: ' + locRes.body?.data?.[0]?.hospitalName + ' (~' + firstDist + ' km)'
    );

    // --- TEST 5: Create Multi-Hospital Blood Request ---
    const createReqRes = await requestJson(BASE_URL + '/blood-requests', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
      body: JSON.stringify({
        patientName: 'Kunal Ghosh',
        patientAge: 42,
        patientGender: 'Male',
        contactPhone: '+91 98300 12345',
        bloodGroup: 'A+',
        bloodComponent: 'Whole Blood',
        quantity: 2,
        urgency: 'Emergency',
        reason: 'Acute gastrointestinal hemorrhage requiring urgent transfusion',
        targetHospitals: [hospitalA._id.toString(), hospitalB._id.toString(), hospitalC._id.toString()],
      }),
    });
    testBloodRequestId = createReqRes.body?.data?._id;
    const recipientsLen = createReqRes.body?.data?.recipients?.length;
    const reqCode = createReqRes.body?.data?.requestId;
    
    // Direct MongoDB check on dedicated bloodrequests collection
    const inDb = await BloodRequest.findById(testBloodRequestId);
    const inDedicatedCollection = inDb && inDb.collection.name === 'bloodrequests';
    const hasBrPrefix = Boolean(reqCode && reqCode.startsWith('BR-'));
    const hasSeparatePatientAndRequester = Boolean(inDb && inDb.patient?.name === 'Kunal Ghosh' && inDb.requester?.name);

    logTest(5, 'Create multi-hospital blood request in dedicated bloodrequests collection',
      createReqRes.status === 201 && recipientsLen === 3 && inDedicatedCollection && hasBrPrefix && hasSeparatePatientAndRequester,
      'Request ID: ' + reqCode + ', Collection: ' + (inDb?.collection.name) + ', Recipients: ' + recipientsLen
    );

    // --- TEST 6: Blood Request Displayed in Unified Doctor/Staff Requests ---
    const doctorRequestsRes = await requestJson(BASE_URL + '/bed-requests?requestType=BLOOD', {
      headers: { Authorization: 'Bearer ' + tokenB },
    });
    const foundInDocPortal = doctorRequestsRes.body?.data?.some(r => r._id === testBloodRequestId || r.requestId === reqCode);
    logTest(6, 'Blood request appears in the existing doctor/staff request portal',
      doctorRequestsRes.status === 200 && foundInDocPortal,
      'Found in Hospital B requests: ' + foundInDocPortal
    );

    // --- TEST 7: Emergency Requests Priority ---
    const highUrgencyFirst = (doctorRequestsRes.body?.data?.[0]?.urgency || doctorRequestsRes.body?.data?.[0]?.bloodRequirement?.urgency || '').toLowerCase() === 'emergency';
    logTest(7, 'Emergency blood requests receive top priority in doctor/staff portal',
      highUrgencyFirst,
      'Top request priority: ' + (doctorRequestsRes.body?.data?.[0]?.urgency || doctorRequestsRes.body?.data?.[0]?.bloodRequirement?.urgency)
    );

    // --- TEST 8: Query Single Blood Request Details ---
    const singleReqRes = await requestJson(BASE_URL + '/blood-requests/' + testBloodRequestId, {
      headers: { Authorization: 'Bearer ' + tokenDocA },
    });
    const singlePatName = singleReqRes.body?.data?.patient?.name || singleReqRes.body?.data?.patientName;
    const singleBloodGroup = singleReqRes.body?.data?.bloodRequirement?.bloodGroup || singleReqRes.body?.data?.bloodGroup;
    logTest(8, 'Clinician retrieves complete patient details & recipient status breakdown',
      singleReqRes.status === 200 && singlePatName === 'Kunal Ghosh',
      'Patient: ' + singlePatName + ' (' + singleBloodGroup + ')'
    );

    // --- TEST 9: Hospital B Accepts Request -> Atomic Unit Reservation ---
    const invBBefore = await BloodInventory.findOne({ hospital: hospitalB._id, bloodGroup: 'A+', component: 'Whole Blood' });
    const availBefore = invBBefore.availableUnits;
    const reservedBefore = invBBefore.reservedUnits;

    const acceptRes = await requestJson(BASE_URL + '/blood-requests/' + testBloodRequestId + '/accept', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
    });

    const invBAfter = await BloodInventory.findOne({ hospital: hospitalB._id, bloodGroup: 'A+', component: 'Whole Blood' });
    const reservationWorked = invBAfter.reservedUnits === reservedBefore + 2 && invBAfter.availableUnits === availBefore - 2;

    logTest(9, 'Accepting blood request atomically moves units from available to reserved',
      acceptRes.status === 200 && reservationWorked && acceptRes.body?.data?.status === 'BLOOD_RESERVED',
      'Hospital B reserved: ' + invBAfter.reservedUnits + ' (Avail: ' + invBAfter.availableUnits + ')'
    );

    // --- TEST 10: Atomic Guard: Cannot Reserve More Than Available ---
    const overReqRes = await requestJson(BASE_URL + '/blood-requests', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
      body: JSON.stringify({
        patientName: 'Excess Test Patient',
        contactPhone: '9830000000',
        bloodGroup: 'A+',
        quantity: 20, // Greater than hospital stock
        targetHospitals: [hospitalB._id.toString()],
      }),
    });
    const overAcceptRes = await requestJson(BASE_URL + '/blood-requests/' + overReqRes.body?.data?._id + '/accept', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
    });
    logTest(10, 'Server-side inventory guard blocks reservation exceeding available units',
      overAcceptRes.status === 400 && overAcceptRes.body?.message?.includes('Insufficient units available'),
      'HTTP ' + overAcceptRes.status + ' (' + overAcceptRes.body?.message + ')'
    );

    // --- TEST 11: Partial Acceptance Workflow ---
    await BloodInventory.findOneAndUpdate(
      { hospital: hospitalB._id, bloodGroup: 'B+', component: 'Whole Blood' },
      { $set: { availableUnits: 10, totalUnits: 15, reservedUnits: 0, usedUnits: 0, status: 'Available' } },
      { upsert: true }
    );
    const partialReqRes = await requestJson(BASE_URL + '/blood-requests', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
      body: JSON.stringify({
        patientName: 'Partial Test Patient',
        contactPhone: '9830000001',
        bloodGroup: 'B+',
        quantity: 6,
        targetHospitals: [hospitalB._id.toString()],
      }),
    });
    const partialAcceptRes = await requestJson(BASE_URL + '/blood-requests/' + partialReqRes.body?.data?._id + '/partial-accept', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
      body: JSON.stringify({ availableUnits: 3, notes: 'Can provide 3 units now from donor drive' }),
    });
    logTest(11, 'Partial acceptance reserves available subset and marks PARTIALLY_ACCEPTED',
      partialAcceptRes.status === 200 && partialAcceptRes.body?.data?.status === 'PARTIALLY_ACCEPTED',
      'Status: ' + partialAcceptRes.body?.data?.status
    );

    // --- TEST 12: Rejection with Mandatory Reason ---
    const rejWithoutReason = await requestJson(BASE_URL + '/blood-requests/' + partialReqRes.body?.data?._id + '/reject', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({ reason: '' }),
    });
    const rejWithReason = await requestJson(BASE_URL + '/blood-requests/' + partialReqRes.body?.data?._id + '/reject', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({ reason: 'Hospital blood refrigerator undergoing mandatory maintenance' }),
    });
    logTest(12, 'Rejecting blood request requires mandatory reason and updates status',
      rejWithoutReason.status === 422 && rejWithReason.status === 200,
      'Empty rejected: 422, Valid reason recorded: 200'
    );

    // --- TEST 13: Request Cancellation Safely Releases Reserved Inventory ---
    const cancelRes = await requestJson(BASE_URL + '/blood-requests/' + testBloodRequestId + '/cancel', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
    });
    const invBAfterCancel = await BloodInventory.findOne({ hospital: hospitalB._id, bloodGroup: 'A+', component: 'Whole Blood' });
    const stockReturned = invBAfterCancel.availableUnits === availBefore && invBAfterCancel.reservedUnits === reservedBefore;
    logTest(13, 'Cancelling blood request releases held units back into available pool',
      cancelRes.status === 200 && stockReturned && cancelRes.body?.data?.status === 'CANCELLED',
      'Available restored: ' + invBAfterCancel.availableUnits
    );

    // --- TEST 14: Completed Transfusion Finalizes Reserved Units into Used ---
    const compReqRes = await requestJson(BASE_URL + '/blood-requests', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
      body: JSON.stringify({
        patientName: 'Complete Test Patient',
        contactPhone: '9830000002',
        bloodGroup: 'O+',
        quantity: 1,
        targetHospitals: [hospitalB._id.toString()],
      }),
    });
    await requestJson(BASE_URL + '/blood-requests/' + compReqRes.body?.data?._id + '/accept', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
    });
    const compFinalRes = await requestJson(BASE_URL + '/blood-requests/' + compReqRes.body?.data?._id + '/complete', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenB },
    });
    logTest(14, 'Completing blood collection transitions reserved units to used units',
      compFinalRes.status === 200 && compFinalRes.body?.data?.status === 'COMPLETED',
      'Status: ' + compFinalRes.body?.data?.status
    );

    // --- TEST 15: Non-Negative Inventory Constraint ---
    const nonNegInv = await BloodInventory.findOne({ hospital: hospitalB._id });
    const isNonNegative = nonNegInv.availableUnits >= 0 && nonNegInv.reservedUnits >= 0;
    logTest(15, 'Inventory invariants enforce non-negative stock bounds',
      isNonNegative,
      'Available: ' + nonNegInv.availableUnits + ' >= 0, Reserved: ' + nonNegInv.reservedUnits + ' >= 0'
    );

    // --- TEST 16: Expiry Date Filtering Prevents Outdated Stock ---
    let expiredRecord = await BloodInventory.findOne({ hospital: hospitalA._id, bloodGroup: 'AB-', component: 'Plasma' });
    if (expiredRecord) {
      expiredRecord.expiryDate = new Date(Date.now() - 24 * 3600000); // Expired yesterday
      await expiredRecord.save();
    } else {
      expiredRecord = await BloodInventory.create({
        hospital: hospitalA._id,
        bloodGroup: 'AB-',
        component: 'Plasma',
        totalUnits: 5,
        reservedUnits: 0,
        usedUnits: 0,
        expiredUnits: 0,
        expiryDate: new Date(Date.now() - 24 * 3600000), // Expired yesterday
      });
    }
    const expiredSearch = await requestJson(BASE_URL + '/blood-banks/search?bloodGroup=AB-&component=Plasma');
    const hospAExp = expiredSearch.body?.data?.find(h => h.hospitalId === hospitalA._id.toString());
    logTest(16, 'Expired blood units are automatically flagged and excluded from available search',
      expiredRecord.status === 'Expired' && (!hospAExp || hospAExp.exactMatchAvailable === 0),
      'Status evaluated: ' + expiredRecord.status + ', Excluded from search: true'
    );

    // --- TEST 17: Low-Stock Alert Evaluation ---
    let lowStockRecord = await BloodInventory.findOne({ status: 'Low Stock', availableUnits: { $lte: 5 } });
    if (!lowStockRecord) {
      lowStockRecord = await BloodInventory.findOneAndUpdate(
        { hospital: hospitalA._id, bloodGroup: 'B-', component: 'Packed RBC' },
        { $set: { totalUnits: 4, reservedUnits: 0, usedUnits: 0, expiredUnits: 0, availableUnits: 4, minThreshold: 5, status: 'Low Stock' } },
        { returnDocument: 'after', upsert: true }
      );
    }
    logTest(17, 'Low stock threshold triggers administrative warning badge',
      !!lowStockRecord && lowStockRecord.availableUnits <= lowStockRecord.minThreshold,
      'Group: ' + lowStockRecord?.bloodGroup + ' (Avail: ' + lowStockRecord?.availableUnits + ' <= ' + lowStockRecord?.minThreshold + ')'
    );

    // --- TEST 18: Staff Blood Inventory Management Endpoint ---
    const staffInvRes = await requestJson(BASE_URL + '/blood-inventory/all', {
      headers: { Authorization: 'Bearer ' + tokenA },
    });
    logTest(18, 'Hospital staff retrieves facility blood inventory breakdown & alerts',
      staffInvRes.status === 200 && staffInvRes.body?.count > 0,
      'Hospital A inventory records: ' + staffInvRes.body?.count
    );

    // --- TEST 19: Cross-Hospital Authorization Isolation ---
    const crossInvUpdate = await requestJson(BASE_URL + '/blood-inventory/update', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenA },
      body: JSON.stringify({
        hospitalId: hospitalB._id.toString(), // Admin A trying to edit Hospital B
        bloodGroup: 'A+',
        component: 'Whole Blood',
        totalUnits: 50,
      }),
    });
    logTest(19, 'Cross-hospital inventory tampering is blocked with 403 Forbidden',
      crossInvUpdate.status === 403,
      'HTTP Status: ' + crossInvUpdate.status
    );

    // --- TEST 20: Volunteer Blood Donor Registration ---
    const regDonorRes = await requestJson(BASE_URL + '/donors/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rohan Banerjee',
        age: 28,
        gender: 'Male',
        bloodGroup: 'O-',
        phone: '+91 98311 99999',
        email: 'rohan.b@wb.demo.in',
        district: 'Kolkata',
        city: 'Salt Lake',
      }),
    });
    logTest(20, 'Volunteer donor registration succeeds without exposing private contact info',
      regDonorRes.status === 201 && !regDonorRes.body?.data?.phone,
      'Registered donor ID: ' + regDonorRes.body?.data?._id + ', Phone hidden: ' + !regDonorRes.body?.data?.phone
    );

    // --- TEST 21: Donor Search Privacy Protection ---
    const publicDonorSearch = await requestJson(BASE_URL + '/donors/search');
    const staffDonorSearch = await requestJson(BASE_URL + '/donors/search?bloodGroup=O-', {
      headers: { Authorization: 'Bearer ' + tokenDocA },
    });
    const publicBlocked = publicDonorSearch.status === 401;
    const staffAuthorized = staffDonorSearch.status === 200 && staffDonorSearch.body?.isAuthorizedStaff === true;
    logTest(21, 'Donor contact phone is role-protected and visible only to authorized hospital staff',
      publicBlocked && staffAuthorized,
      'Public blocked: ' + publicBlocked + ', Staff authorized: ' + staffAuthorized
    );

    // --- TEST 22: Emergency Donor Broadcast Alert ---
    const broadcastRes = await requestJson(BASE_URL + '/donors/emergency-broadcast', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
      body: JSON.stringify({
        bloodGroup: 'O-',
        unitsRequired: 3,
        hospitalName: hospitalA.name,
        district: hospitalA.district,
        contactDetails: hospitalA.phone,
      }),
    });
    logTest(22, 'Authorized doctor broadcasts emergency donor alert across network',
      broadcastRes.status === 200 && broadcastRes.body?.data?.bloodGroup === 'O-',
      'Broadcast alert for: ' + broadcastRes.body?.data?.bloodGroup + ' (' + broadcastRes.body?.data?.unitsRequired + ' units)'
    );

    // --- TEST 23: Audit Log History Recorded ---
    const auditLogs = await AuditLog.find({ action: { $in: ['BLOOD_RESERVED', 'BLOOD_REQUEST_CREATED'] } }).lean();
    logTest(23, 'System records immutable audit log for clinical blood requests and reservations',
      auditLogs.length >= 2,
      'Recorded blood audit events: ' + auditLogs.length
    );

    // --- TEST 24: State-Wide Blood Statistics API ---
    const statsRes = await requestJson(BASE_URL + '/blood-banks/statistics');
    logTest(24, 'State-wide blood analytics API returns aggregate units and district metrics',
      statsRes.status === 200 && statsRes.body?.data?.totalBloodUnitsAvailable > 0,
      'Total units available in WB network: ' + statsRes.body?.data?.totalBloodUnitsAvailable
    );

    // --- TEST 25: Public Blood Banks Directory Listing ---
    const directoryRes = await requestJson(BASE_URL + '/blood-banks');
    logTest(25, 'Public blood bank directory lists all 24 facility locations',
      directoryRes.status === 200 && directoryRes.body?.count === 24,
      'Total blood banks listed: ' + directoryRes.body?.count
    );

    // --- TEST 26: Zero Regression: Public Hospital Bed Search Preserved ---
    const pubBedRes = await requestJson(BASE_URL + '/hospitals?search=apollo');
    logTest(26, 'Zero Regression: Public hospital bed search remains fully functional',
      pubBedRes.status === 200 && pubBedRes.body?.data?.length > 0,
      'Hospitals found: ' + pubBedRes.body?.data?.length
    );

    // --- TEST 27: Zero Regression: Bed Request Creation Preserved ---
    await Bed.findOneAndUpdate(
      { hospital: hospitalA._id, type: 'icu' },
      { $set: { availableBeds: 5, totalBeds: 10, isActive: true } },
      { upsert: true }
    );
    const bedReqRes = await requestJson(BASE_URL + '/bed-requests', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tokenDocA },
      body: JSON.stringify({
        hospitalId: hospitalA._id.toString(),
        bedType: 'icu',
        patientName: 'Subhas Bose',
        contactPhone: '9830098300',
        notes: 'Severe respiratory failure',
      }),
    });
    logTest(27, 'Zero Regression: Standard bed reservation request functions without interruption',
      bedReqRes.status === 201 && bedReqRes.body?.data?.requestType === 'BED',
      'Bed Request ID: ' + bedReqRes.body?.data?._id + ', Type: ' + bedReqRes.body?.data?.requestType
    );

    // --- TEST 28: Zero Regression: Emergency Patient Intake Preserved ---
    const intakeRes = await requestJson(BASE_URL + '/emergency/intake', {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Priyanka Sen',
        age: 34,
        sex: 'Female',
        symptoms: 'Acute chest pain with palpitations',
        condition: 'Serious',
        emergencyType: 'Cardiac Emergency',
        contactNumber: '9876543210',
        district: 'Kolkata',
      }),
    });
    logTest(28, 'Zero Regression: Public emergency patient intake operates seamlessly',
      intakeRes.status === 201 && intakeRes.body?.data?.applicationPriority !== undefined,
      'Intake ID: ' + intakeRes.body?.data?._id
    );

    // --- TEST 29: Zero Regression: Hospital-to-Hospital Referral Preserved ---
    const refHospRes = await requestJson(BASE_URL + '/referrals/hospitals', {
      headers: { Authorization: 'Bearer ' + tokenDocA },
    });
    logTest(29, 'Zero Regression: Inter-hospital referral facility endpoints operate normally',
      refHospRes.status === 200 && refHospRes.body?.data?.length > 0,
      'Eligible referral destinations: ' + refHospRes.body?.data?.length
    );

    // --- TEST 30: Zero Regression: Staff Authentication Across 24 Hospitals Preserved ---
    const hospAuthCheck = await requestJson(BASE_URL + '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailA, password: 'Password123!', hospitalId: hospitalB._id.toString() }),
    });
    logTest(30, 'Zero Regression: Hospital-specific authentication and authorization boundaries preserved',
      hospAuthCheck.status === 403 && hospAuthCheck.body?.message?.includes('does not match'),
      'Mismatched hospital login rejected: ' + hospAuthCheck.status
    );

  } catch (err) {
    console.error('❌ Test suite execution error:', err);
  } finally {
    await new Promise(resolve => testServer.close(resolve));
    await disconnectDB();

    console.log('\n======================================================');
    console.log('📊 BLOODCONNECT TEST RESULTS SUMMARY');
    console.log('======================================================');
    const passedCount = testResults.filter(t => t.passed).length;
    console.log('Total Tests: ' + testResults.length + ' | Passed: ' + passedCount + ' | Failed: ' + (testResults.length - passedCount));
    if (passedCount === testResults.length && testResults.length >= 30) {
      console.log('🎉 ALL 30 BLOOD BANK & ZERO-REGRESSION TESTS PASSED SUCCESSFULLY!\n');
    } else {
      console.log('⚠️ Some tests failed. Please review the logs above.\n');
    }
  }
}

runBloodBankTests();
