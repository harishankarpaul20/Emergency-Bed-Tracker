/**
 * testSecurityAudit2Remediation.js
 * Comprehensive automated verification for AUTH-04, AUTH-05, and AUTH-06 remediations.
 */

require('../config/bootstrap');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');

// Ensure test environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remediation_verification_only_32bytes!';
}

const { app } = require('../server');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
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
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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
          body: json
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
  console.log('AUTH-04, AUTH-05, AUTH-06 REMEDIATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(title, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title} - ${details}`);
      failed++;
    }
  }

  // Start temporary server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  await connectDB();

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: AUTH-04 (Token Expiration & Revocation)
    // ----------------------------------------------------
    console.log('[SUITE 1] AUTH-04: Short-lived Access Token & Server-side Session Lifecycle');

    // 1.1 Access Token Lifetime is 15m (900 seconds)
    const testPayload = { id: '6a9e9a5774b2ff9e0afbfa6d', role: 'user' };
    const sampleToken = generateToken(testPayload);
    const decoded = jwt.decode(sampleToken);
    const lifetimeSeconds = decoded.exp - decoded.iat;
    record(
      'AUTH-04.1: Access token default expiration is 15 minutes (900s)',
      lifetimeSeconds === 900,
      `Expected 900s, got ${lifetimeSeconds}s`
    );

    // 1.2 Access Token uses explicit HS256 algorithm
    const tokenHeader = JSON.parse(Buffer.from(sampleToken.split('.')[0], 'base64').toString());
    record(
      'AUTH-04.2: Access token explicitly uses HS256 algorithm',
      tokenHeader.alg === 'HS256',
      `Expected alg HS256, got ${tokenHeader.alg}`
    );

    // 1.3 Register a test user for session lifecycle
    const userEmail = `auth_test_${Date.now()}@wb.gov.in`;
    const regRes = await makeRequest('POST', '/api/auth/register', {}, {
      name: 'Auth Test User',
      email: userEmail,
      password: 'SecurePassword123!',
      phone: '9876543210'
    });

    record(
      'AUTH-04.3: User registration succeeds with session issuance',
      regRes.status === 201 && regRes.body.data?.token && regRes.body.data?.csrfToken,
      `Status: ${regRes.status}, Body: ${JSON.stringify(regRes.body)}`
    );

    // Extract refresh cookie and CSRF token
    const rawCookies = regRes.headers['set-cookie'] || [];
    const refreshCookieStr = rawCookies.find(c => c.startsWith('medbed_refresh_token='));
    record(
      'AUTH-04.4: Registration sets HttpOnly medbed_refresh_token cookie',
      !!refreshCookieStr && refreshCookieStr.includes('HttpOnly'),
      `Set-Cookie: ${JSON.stringify(rawCookies)}`
    );

    const csrfToken = regRes.body.data?.csrfToken;
    const cookieVal = refreshCookieStr ? refreshCookieStr.split(';')[0] : '';

    // 1.4 Refresh Token rotation
    const refreshRes = await makeRequest('POST', '/api/auth/refresh', {
      'Cookie': cookieVal,
      'X-CSRF-Token': csrfToken
    });

    record(
      'AUTH-04.5: POST /api/auth/refresh rotates tokens successfully',
      refreshRes.status === 200 && refreshRes.body.data?.token && refreshRes.body.data?.csrfToken,
      `Status: ${refreshRes.status}, Body: ${JSON.stringify(refreshRes.body)}`
    );

    const newCookies = refreshRes.headers['set-cookie'] || [];
    const newRefreshCookie = newCookies.find(c => c.startsWith('medbed_refresh_token='));
    record(
      'AUTH-04.6: POST /api/auth/refresh sets new rotated refresh cookie',
      !!newRefreshCookie && newRefreshCookie !== refreshCookieStr,
      `Old: ${refreshCookieStr}, New: ${newRefreshCookie}`
    );

    // 1.5 Server-side Revocation on Logout
    const newCookieVal = newRefreshCookie ? newRefreshCookie.split(';')[0] : '';
    const newCsrf = refreshRes.body.data?.csrfToken;
    const logoutRes = await makeRequest('POST', '/api/auth/logout', {
      'Cookie': newCookieVal,
      'Authorization': `Bearer ${refreshRes.body.data.token}`,
      'X-CSRF-Token': newCsrf
    });

    record(
      'AUTH-04.7: POST /api/auth/logout succeeds and clears cookie',
      logoutRes.status === 200,
      `Status: ${logoutRes.status}, Body: ${JSON.stringify(logoutRes.body)}`
    );

    // 1.6 Verify revoked token cannot be refreshed
    const postLogoutRefresh = await makeRequest('POST', '/api/auth/refresh', {
      'Cookie': newCookieVal,
      'X-CSRF-Token': newCsrf
    });

    record(
      'AUTH-04.8: Refresh using revoked token is rejected with 401',
      postLogoutRefresh.status === 401,
      `Status: ${postLogoutRefresh.status}, Body: ${JSON.stringify(postLogoutRefresh.body)}`
    );

    // ----------------------------------------------------
    // TEST SUITE 2: AUTH-05 (Password Minimum Length >= 8)
    // ----------------------------------------------------
    console.log('\n[SUITE 2] AUTH-05: Password Minimum Length Enforcement (>= 8 characters)');

    // 2.1 Rejection of password < 8 characters on public registration
    const shortPassRes = await makeRequest('POST', '/api/auth/register', {}, {
      name: 'Short Pass User',
      email: `short_${Date.now()}@wb.gov.in`,
      password: 'Pass1!', // 6 characters
      phone: '9876543210'
    });

    record(
      'AUTH-05.1: Registration rejects 6-character password with 422',
      shortPassRes.status === 422,
      `Status: ${shortPassRes.status}, Body: ${JSON.stringify(shortPassRes.body)}`
    );

    const isMinLengthMsg = JSON.stringify(shortPassRes.body).toLowerCase().includes('8');
    record(
      'AUTH-05.2: Error message explicitly mentions at least 8 characters',
      isMinLengthMsg,
      `Body: ${JSON.stringify(shortPassRes.body)}`
    );

    // 2.2 Acceptance of password >= 8 characters
    const validPassRes = await makeRequest('POST', '/api/auth/register', {}, {
      name: 'Valid Pass User',
      email: `valid_${Date.now()}@wb.gov.in`,
      password: 'Password8!', // 10 characters
      phone: '9876543210'
    });

    record(
      'AUTH-05.3: Registration accepts 8+ character password',
      validPassRes.status === 201,
      `Status: ${validPassRes.status}, Body: ${JSON.stringify(validPassRes.body)}`
    );

    // 2.3 Verify existing user logins are not broken
    const existingLoginRes = await makeRequest('POST', '/api/auth/login', {}, {
      email: 'user@demo.wb.gov.in',
      password: 'Password123!'
    });

    record(
      'AUTH-05.4: Existing user login (user@demo.wb.gov.in) succeeds without disruption',
      existingLoginRes.status === 200 && existingLoginRes.body.data?.token,
      `Status: ${existingLoginRes.status}, Body: ${JSON.stringify(existingLoginRes.body)}`
    );

    // ----------------------------------------------------
    // TEST SUITE 3: AUTH-06 (No localStorage Token Storage & CSRF Protection)
    // ----------------------------------------------------
    console.log('\n[SUITE 3] AUTH-06: Elimination of localStorage Storage & CSRF Defense');

    // 3.1 CSRF Validation on Refresh Endpoint
    const loginRes = await makeRequest('POST', '/api/auth/login', {}, {
      email: 'user@demo.wb.gov.in',
      password: 'Password123!'
    });

    const loginCookies = loginRes.headers['set-cookie'] || [];
    const loginRefreshCookie = loginCookies.find(c => c.startsWith('medbed_refresh_token='));
    const loginCookieVal = loginRefreshCookie ? loginRefreshCookie.split(';')[0] : '';

    // Attempt refresh WITHOUT CSRF token
    const refreshNoCsrf = await makeRequest('POST', '/api/auth/refresh', {
      'Cookie': loginCookieVal
    });

    record(
      'AUTH-06.1: Cookie refresh without CSRF token is rejected with 403',
      refreshNoCsrf.status === 403,
      `Status: ${refreshNoCsrf.status}, Body: ${JSON.stringify(refreshNoCsrf.body)}`
    );

    // Attempt refresh WITH valid CSRF token
    const validCsrf = loginRes.body.data?.csrfToken;
    const refreshWithCsrf = await makeRequest('POST', '/api/auth/refresh', {
      'Cookie': loginCookieVal,
      'X-CSRF-Token': validCsrf
    });

    record(
      'AUTH-06.2: Cookie refresh with valid CSRF token succeeds',
      refreshWithCsrf.status === 200,
      `Status: ${refreshWithCsrf.status}, Body: ${JSON.stringify(refreshWithCsrf.body)}`
    );

    // 3.2 Frontend verification: Check script.js for zero localStorage.setItem('medbed_auth_token')
    const scriptContent = fs.readFileSync(path.join(__dirname, '../../script.js'), 'utf8');
    const hasSetItem = scriptContent.includes("localStorage.setItem('medbed_auth_token'");
    const hasGetItem = scriptContent.includes("localStorage.getItem('medbed_auth_token'");
    
    record(
      'AUTH-06.3: Frontend script.js has ZERO localStorage.setItem("medbed_auth_token")',
      !hasSetItem,
      'Found localStorage.setItem for medbed_auth_token'
    );

    record(
      'AUTH-06.4: Frontend script.js has ZERO localStorage.getItem("medbed_auth_token")',
      !hasGetItem,
      'Found localStorage.getItem for medbed_auth_token'
    );

    record(
      'AUTH-06.5: Frontend script.js defines silentRefresh() and passes credentials: "include"',
      scriptContent.includes('silentRefresh') && scriptContent.includes("credentials: 'include'"),
      'Missing silentRefresh or credentials include'
    );

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    await disconnectDB().catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`REMEDIATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
