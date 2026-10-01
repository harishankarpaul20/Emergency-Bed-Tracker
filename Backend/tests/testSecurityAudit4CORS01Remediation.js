/**
 * SECURITY AUDIT #4 — POST-FIX VERIFICATION TEST SUITE
 * Finding: SEC4-CORS-01 (CORS Origin Validation & Null Origin Elimination)
 * Scope: Strict origin allowlist, elimination of *.github.io regex wildcard,
 * elimination of null origin, environment-aware development origin handling.
 */

require('../config/bootstrap');
const http = require('http');
const { app, isOriginAllowed, getAllowedOrigins } = require('../server');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function sendRequest({ host, port, path, method, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host,
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runCORSVerificationTests() {
  console.log('================================================================');
  console.log('  SEC4-CORS-01 VERIFICATION SUITE — ORIGIN POLICY & PREFLIGHT  ');
  console.log('================================================================\n');

  // Preserve original NODE_ENV
  const originalNodeEnv = process.env.NODE_ENV;

  // -------------------------------------------------------------
  // SECTION 1: UNIT EVALUATION — PRODUCTION ENVIRONMENT MODE
  // -------------------------------------------------------------
  console.log('--- SECTION 1: PRODUCTION ENVIRONMENT ORIGIN RULES ---');
  process.env.NODE_ENV = 'production';

  // TEST 1: Trusted production origin
  assert(
    isOriginAllowed('https://harishankarpaul20.github.io') === true,
    'TEST 1: Trusted production origin (https://harishankarpaul20.github.io) is ALLOWED'
  );

  // TEST 2: Attacker GitHub Pages
  assert(
    isOriginAllowed('https://attacker.github.io') === false,
    'TEST 2: Attacker GitHub Pages (https://attacker.github.io) is BLOCKED'
  );

  // TEST 3: Another GitHub Pages site
  assert(
    isOriginAllowed('https://malicious-project.github.io') === false,
    'TEST 3: Arbitrary GitHub Pages (https://malicious-project.github.io) is BLOCKED'
  );

  // TEST 4: null origin (string 'null' and literal null)
  assert(
    isOriginAllowed('null') === false && isOriginAllowed(null) === false,
    'TEST 4: null origin (\'null\' and null) is BLOCKED'
  );

  // TEST 5: External malicious origin
  assert(
    isOriginAllowed('https://evil.example.com') === false,
    'TEST 5: External malicious origin (https://evil.example.com) is BLOCKED'
  );

  // TEST 6: HTTP version of production origin
  assert(
    isOriginAllowed('http://harishankarpaul20.github.io') === false,
    'TEST 6: HTTP insecure version (http://harishankarpaul20.github.io) is BLOCKED'
  );

  // TEST 7: Lookalike domain (suffix injection)
  assert(
    isOriginAllowed('https://harishankarpaul20.github.io.evil.com') === false,
    'TEST 7: Lookalike domain (https://harishankarpaul20.github.io.evil.com) is BLOCKED'
  );

  // TEST 8: Subdomain lookalike (prefix injection)
  assert(
    isOriginAllowed('https://evil.harishankarpaul20.github.io') === false,
    'TEST 8: Subdomain lookalike (https://evil.harishankarpaul20.github.io) is BLOCKED'
  );

  // Additional boundary checks
  assert(
    isOriginAllowed('https://evil.com/https://harishankarpaul20.github.io') === false,
    'TEST 8b: Path-injected lookalike (https://evil.com/https://...) is BLOCKED'
  );

  assert(
    isOriginAllowed(undefined) === false && isOriginAllowed('') === false,
    'TEST 8c: Falsy/undefined origin is safely rejected by isOriginAllowed'
  );

  // Production check: Localhost must NOT be allowed in production
  assert(
    isOriginAllowed('http://localhost:5500') === false &&
    isOriginAllowed('http://127.0.0.1:3000') === false,
    'TEST 8d: Localhost origins are BLOCKED in production mode'
  );

  // -------------------------------------------------------------
  // SECTION 2: DEVELOPMENT ENVIRONMENT MODE
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: DEVELOPMENT ENVIRONMENT ORIGIN RULES ---');
  process.env.NODE_ENV = 'development';

  assert(
    isOriginAllowed('https://harishankarpaul20.github.io') === true,
    'Dev 1: Production frontend is ALLOWED in development mode'
  );

  assert(
    isOriginAllowed('http://localhost:5500') === true,
    'Dev 2: Localhost:5500 is ALLOWED in development mode'
  );

  assert(
    isOriginAllowed('http://127.0.0.1:5500') === true,
    'Dev 3: 127.0.0.1:5500 is ALLOWED in development mode'
  );

  assert(
    isOriginAllowed('http://localhost:3000') === true,
    'Dev 4: Localhost:3000 is ALLOWED in development mode'
  );

  assert(
    isOriginAllowed('https://attacker.github.io') === false,
    'Dev 5: Attacker GitHub Pages is STILL BLOCKED in development mode'
  );

  assert(
    isOriginAllowed('null') === false,
    'Dev 6: null origin is STILL BLOCKED in development mode'
  );

  // -------------------------------------------------------------
  // SECTION 3: LIVE HTTP & PREFLIGHT OPTIONS TESTS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: LIVE HTTP / PREFLIGHT (OPTIONS) TESTS ---');
  // Reset to original NODE_ENV for server testing
  process.env.NODE_ENV = originalNodeEnv || 'development';

  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const port = testServer.address().port;

  try {
    // TEST 9: Trusted production origin with preflight OPTIONS request
    const preflightAllowed = await sendRequest({
      host: '127.0.0.1',
      port,
      path: '/api/beds',
      method: 'OPTIONS',
      headers: {
        origin: 'https://harishankarpaul20.github.io',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, Authorization',
      },
    });

    assert(
      preflightAllowed.statusCode === 204 &&
      preflightAllowed.headers['access-control-allow-origin'] === 'https://harishankarpaul20.github.io' &&
      preflightAllowed.headers['access-control-allow-credentials'] === 'true',
      'TEST 9: Preflight OPTIONS for trusted origin receives 204 with valid ACAO and ACAC headers'
    );

    // TEST 10: Malicious preflight OPTIONS request
    const preflightAttacker = await sendRequest({
      host: '127.0.0.1',
      port,
      path: '/api/beds',
      method: 'OPTIONS',
      headers: {
        origin: 'https://attacker.github.io',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type, Authorization',
      },
    });

    assert(
      !preflightAttacker.headers['access-control-allow-origin'] &&
      !preflightAttacker.headers['access-control-allow-credentials'],
      'TEST 10: Preflight OPTIONS for attacker origin has NO ACAO or ACAC headers (blocked)'
    );

    // TEST 11: Preflight for null origin
    const preflightNull = await sendRequest({
      host: '127.0.0.1',
      port,
      path: '/api/beds',
      method: 'OPTIONS',
      headers: {
        origin: 'null',
        'access-control-request-method': 'GET',
      },
    });

    assert(
      !preflightNull.headers['access-control-allow-origin'] &&
      !preflightNull.headers['access-control-allow-credentials'],
      'TEST 11: Preflight OPTIONS for null origin has NO ACAO or ACAC headers (blocked)'
    );

    // TEST 12: Actual GET request with trusted origin
    const getTrusted = await sendRequest({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      method: 'GET',
      headers: {
        origin: 'https://harishankarpaul20.github.io',
      },
    });

    assert(
      getTrusted.headers['access-control-allow-origin'] === 'https://harishankarpaul20.github.io' &&
      getTrusted.headers['access-control-allow-credentials'] === 'true',
      'TEST 12: Live GET with trusted origin returns exact ACAO and ACAC=true'
    );

    // TEST 13: Actual GET request with attacker origin
    const getAttacker = await sendRequest({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      method: 'GET',
      headers: {
        origin: 'https://attacker.github.io',
      },
    });

    assert(
      !getAttacker.headers['access-control-allow-origin'] &&
      !getAttacker.headers['access-control-allow-credentials'],
      'TEST 13: Live GET with attacker origin returns NO ACAO or ACAC headers'
    );

    // TEST 14: Non-browser direct request without Origin header (e.g. curl/health check)
    const getNoOrigin = await sendRequest({
      host: '127.0.0.1',
      port,
      path: '/api/health',
      method: 'GET',
      headers: {},
    });

    assert(
      getNoOrigin.statusCode === 200 &&
      !getNoOrigin.headers['access-control-allow-origin'],
      'TEST 14: Direct request without Origin header completes normally with 200 and no ACAO'
    );

  } finally {
    testServer.close();
    process.env.NODE_ENV = originalNodeEnv;
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCORSVerificationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
