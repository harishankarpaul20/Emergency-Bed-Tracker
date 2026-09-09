/**
 * Automated Verification Suite for Emergency Patient Intake & Prioritized Hospital Matching
 */
require('../config/bootstrap');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const mongoose = require('mongoose');

const { app } = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const EmergencyIntake = require('../models/EmergencyIntake');

const TEST_PORT = 5002;
const BASE_URL = `http://localhost:${TEST_PORT}/api/emergency`;

const results = [];
function recordTest(num, name, passed, detail = '') {
  results.push({ num, name, passed, detail });
  const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusIcon} [Intake Test ${num.toString().padStart(2, '0')}] ${name}${detail ? ` (${detail})` : ''}`);
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

async function runIntakeTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING EMERGENCY PATIENT INTAKE TEST SUITE');
  console.log(`📡 Testing endpoint: ${BASE_URL}/intake`);
  console.log('======================================================\n');

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(TEST_PORT, resolve));
  await connectDB();

  let createdIntakeId = '';

  try {
    // 1. Missing required fields validation
    const resEmpty = await requestJson(`${BASE_URL}/intake`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    recordTest(1, 'Missing Required Fields Rejection (422)', resEmpty.status === 422, `Errors: ${resEmpty.body.errors ? resEmpty.body.errors.length : 0}`);

    // 2. Invalid contact number format rejection
    const resBadPhone = await requestJson(`${BASE_URL}/intake`, {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Subhasish Roy',
        age: 55,
        sex: 'Male',
        symptoms: 'Chest pain radiating to left arm, sweating',
        condition: 'Very Serious / Critical',
        emergencyType: 'Cardiac Emergency',
        contactNumber: '12345', // Invalid
      }),
    });
    recordTest(2, 'Invalid Phone Number Format Rejection (422)', resBadPhone.status === 422);

    // 3. Out of range age rejection
    const resBadAge = await requestJson(`${BASE_URL}/intake`, {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Subhasish Roy',
        age: 180, // Invalid age
        sex: 'Male',
        symptoms: 'Severe asthma exacerbation',
        condition: 'Serious',
        emergencyType: 'Breathing Problem',
        contactNumber: '9830123456',
      }),
    });
    recordTest(3, 'Out-of-Range Age Rejection (422)', resBadAge.status === 422);

    // 4. Successful Cardiac Emergency intake with "Very Serious / Critical"
    const resCardiac = await requestJson(`${BASE_URL}/intake`, {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Ananya Mukherjee',
        age: 62,
        sex: 'Female',
        symptoms: 'Severe retrosternal chest pressure and dyspnea for 30 minutes',
        condition: 'Very Serious / Critical',
        emergencyType: 'Cardiac Emergency',
        contactNumber: '9831234567',
        attendantName: 'Dr. Debasish Mukherjee',
        ambulanceRequired: 'Yes',
        district: 'Kolkata',
        area: 'Kankurgachi',
      }),
    });
    const cardiacOk =
      resCardiac.status === 201 &&
      resCardiac.body.success === true &&
      resCardiac.body.data.applicationPriority === 'Immediate attention' &&
      Array.isArray(resCardiac.body.data.recommendedHospitals) &&
      resCardiac.body.data.recommendedHospitals.length > 0;

    if (cardiacOk) {
      createdIntakeId = resCardiac.body.data.intakeId;
    }
    recordTest(4, 'Cardiac Critical Intake (201 Created & Immediate Attention Priority)', cardiacOk, `Priority: ${resCardiac.body.data ? resCardiac.body.data.applicationPriority : 'none'}`);

    // 5. Hospital Prioritization verification for Cardiac Critical
    const topCardiacHospital = resCardiac.body.data.recommendedHospitals[0];
    const hasIcuOrEmergency =
      topCardiacHospital &&
      topCardiacHospital.district.toLowerCase() === 'kolkata' &&
      (topCardiacHospital.icuBeds > 0 || topCardiacHospital.status !== 'full');
    recordTest(5, 'Cardiac Prioritization Rationale & ICU Capacity', Boolean(hasIcuOrEmergency), `Top match: ${topCardiacHospital ? topCardiacHospital.name : 'none'}`);

    // 6. Breathing Problem intake with "Serious"
    const resBreathing = await requestJson(`${BASE_URL}/intake`, {
      method: 'POST',
      body: JSON.stringify({
        patientName: 'Rohan Sen',
        age: 40,
        sex: 'Male',
        symptoms: 'Sudden shortness of breath, low oxygen saturation',
        condition: 'Serious',
        emergencyType: 'Breathing Problem',
        contactNumber: '9876543210',
        district: 'Howrah',
        ambulanceRequired: 'Not Sure',
      }),
    });
    const breathingOk =
      resBreathing.status === 201 &&
      resBreathing.body.data.applicationPriority === 'Urgent attention' &&
      resBreathing.body.data.recommendedHospitals.length > 0;
    recordTest(6, 'Breathing Problem Intake (Urgent attention & Oxygen matching)', breathingOk);

    // 7. Non-diagnosis legal disclaimer & demo notice presence
    const disclaimers = resCardiac.body.data.disclaimers;
    const hasDisclaimers =
      disclaimers &&
      disclaimers.medical.includes('does not replace professional medical assessment') &&
      disclaimers.demoData.includes('DEMO DATA');
    recordTest(7, 'Mandatory Medical Non-Diagnosis & Demo Disclaimers Present', Boolean(hasDisclaimers));

    // 8. Privacy: Contact number is masked in the response
    const maskedContact = resCardiac.body.data.maskedContact;
    const isContactMasked =
      maskedContact &&
      maskedContact.includes('******') &&
      !maskedContact.includes('9831234567');
    recordTest(8, 'Patient Contact Number Privacy Masking', Boolean(isContactMasked), `Masked: ${maskedContact}`);

    // 9. MongoDB Persistence Verification
    const savedDoc = await EmergencyIntake.findById(createdIntakeId);
    const isPersisted =
      savedDoc &&
      savedDoc.patientName === 'Ananya Mukherjee' &&
      savedDoc.emergencyType === 'Cardiac Emergency' &&
      savedDoc.status === 'received';
    recordTest(9, 'MongoDB Atlas Persistence Verification', Boolean(isPersisted), `Saved ID: ${createdIntakeId}`);

    // 10. GET /api/emergency/intake/:id retrieval
    const resGet = await requestJson(`${BASE_URL}/intake/${createdIntakeId}`);
    const getOk =
      resGet.status === 200 &&
      resGet.body.success === true &&
      resGet.body.data.patientName === 'Ananya Mukherjee' &&
      resGet.body.data.contactNumber.includes('******');
    recordTest(10, 'Intake Retrieval by ID with Masked Contact', getOk);

  } catch (err) {
    console.error('Test execution error:', err);
    recordTest(99, 'Test Runner Exception', false, err.message);
  } finally {
    await testServer.close();
    await disconnectDB();
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n======================================================');
  console.log(`📊 INTAKE TEST SUITE SUMMARY: ${passedCount}/${results.length} TESTS PASSED`);
  console.log('======================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

if (require.main === module) {
  runIntakeTests();
}

module.exports = { runIntakeTests };
