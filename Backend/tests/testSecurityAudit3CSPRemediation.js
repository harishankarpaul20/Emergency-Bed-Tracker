/**
 * testSecurityAudit3CSPRemediation.js
 * Dedicated verification suite for SEC3-CSP-01:
 * Content Security Policy (CSP) Remediation
 */

require('../config/bootstrap');
const fs = require('fs');
const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_jwt_secret_for_remediation_verification_only_32bytes!';
}

const { app } = require('../server');

const TEST_PORT = 5010;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function runTests() {
  console.log('====================================================');
  console.log('SEC3-CSP-01 REMEDIATION VERIFICATION SUITE');
  console.log('Content Security Policy (CSP)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(id, title, condition, details = '') {
    if (condition) {
      console.log(`  [PASS] Test ${id.toString().padStart(2, '0')}: ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${id.toString().padStart(2, '0')}: ${title} - ${details}`);
      failed++;
    }
  }

  let testServer;

  try {
    testServer = http.createServer(app);
    await new Promise((resolve, reject) => {
      testServer.listen(TEST_PORT, () => resolve());
      testServer.on('error', reject);
    });

    // -----------------------------------------------------------------
    // SECTION 1: Frontend HTML Meta-Tag CSP Verification (index.html)
    // -----------------------------------------------------------------
    console.log('--- SECTION 1: Frontend Meta-Tag CSP Verification ---');

    const indexPath = path.join(__dirname, '../../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');

    // Test 01: CSP meta tag is present
    const cspMetaMatch = indexHtml.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["'](.*?)["']\s*\/?>/i);
    record(
      1,
      'index.html contains <meta http-equiv="Content-Security-Policy"> tag',
      Boolean(cspMetaMatch && cspMetaMatch[1]),
      cspMetaMatch ? 'Found' : 'Missing'
    );

    // Test 02: Exactly one CSP meta tag exists (no duplicate or conflicting definitions)
    const allCspMeta = indexHtml.match(/http-equiv=["']Content-Security-Policy["']/gi) || [];
    record(
      2,
      'Exactly one Content-Security-Policy meta tag exists in index.html (no duplicate)',
      allCspMeta.length === 1,
      `Count: ${allCspMeta.length}`
    );

    // Test 03: Meta tag is located inside <head>...</head>
    const headMatch = indexHtml.match(/<head[\s\S]*?<\/head>/i);
    const isInsideHead = headMatch ? headMatch[0].includes('Content-Security-Policy') : false;
    record(
      3,
      'Content-Security-Policy meta tag is located inside <head> element',
      isInsideHead,
      isInsideHead ? 'Inside <head>' : 'Outside <head>'
    );

    const policy = cspMetaMatch ? cspMetaMatch[1] : '';

    // Test 04: default-src 'self' baseline
    record(
      4,
      "Policy defines default-src 'self'",
      policy.includes("default-src 'self'"),
      `Policy: ${policy}`
    );

    // Test 05: script-src contains 'self', cdn.socket.io, and unpkg.com
    const scriptSrcMatch = policy.match(/script-src\s+([^;]+)/);
    const scriptDirectives = scriptSrcMatch ? scriptSrcMatch[1] : '';
    const scriptHasSelf = scriptDirectives.includes("'self'");
    const scriptHasSocketIo = scriptDirectives.includes('https://cdn.socket.io');
    const scriptHasUnpkg = scriptDirectives.includes('https://unpkg.com');
    record(
      5,
      "script-src permits 'self', https://cdn.socket.io, and https://unpkg.com",
      scriptHasSelf && scriptHasSocketIo && scriptHasUnpkg,
      `script-src: ${scriptDirectives}`
    );

    // Test 06: script-src strictly disallows 'unsafe-inline'
    record(
      6,
      "script-src strictly omits 'unsafe-inline' (zero inline script risk)",
      !scriptDirectives.includes("'unsafe-inline'"),
      `script-src: ${scriptDirectives}`
    );

    // Test 07: script-src strictly disallows 'unsafe-eval'
    record(
      7,
      "script-src strictly omits 'unsafe-eval' (zero eval risk)",
      !scriptDirectives.includes("'unsafe-eval'"),
      `script-src: ${scriptDirectives}`
    );

    // Test 08: style-src contains 'self', 'unsafe-inline', Google Fonts, and unpkg
    const styleSrcMatch = policy.match(/style-src\s+([^;]+)/);
    const styleDirectives = styleSrcMatch ? styleSrcMatch[1] : '';
    record(
      8,
      "style-src allows 'self', 'unsafe-inline', https://fonts.googleapis.com, and https://unpkg.com",
      styleDirectives.includes("'self'") &&
        styleDirectives.includes("'unsafe-inline'") &&
        styleDirectives.includes('https://fonts.googleapis.com') &&
        styleDirectives.includes('https://unpkg.com'),
      `style-src: ${styleDirectives}`
    );

    // Test 09: img-src contains 'self', data:, OpenStreetMap tiles, and unpkg
    const imgSrcMatch = policy.match(/img-src\s+([^;]+)/);
    const imgDirectives = imgSrcMatch ? imgSrcMatch[1] : '';
    record(
      9,
      "img-src allows 'self', data:, https://*.tile.openstreetmap.org, and https://unpkg.com",
      imgDirectives.includes("'self'") &&
        imgDirectives.includes('data:') &&
        imgDirectives.includes('https://*.tile.openstreetmap.org') &&
        imgDirectives.includes('https://unpkg.com'),
      `img-src: ${imgDirectives}`
    );

    // Test 10: font-src contains 'self', https://fonts.gstatic.com, and data:
    const fontSrcMatch = policy.match(/font-src\s+([^;]+)/);
    const fontDirectives = fontSrcMatch ? fontSrcMatch[1] : '';
    record(
      10,
      "font-src allows 'self', https://fonts.gstatic.com, and data:",
      fontDirectives.includes("'self'") &&
        fontDirectives.includes('https://fonts.gstatic.com') &&
        fontDirectives.includes('data:'),
      `font-src: ${fontDirectives}`
    );

    // Test 11: connect-src contains 'self', Render backend HTTPS and WSS
    const connectSrcMatch = policy.match(/connect-src\s+([^;]+)/);
    const connectDirectives = connectSrcMatch ? connectSrcMatch[1] : '';
    record(
      11,
      "connect-src allows 'self', https://emergency-bed-tracker.onrender.com, and wss://emergency-bed-tracker.onrender.com",
      connectDirectives.includes("'self'") &&
        connectDirectives.includes('https://emergency-bed-tracker.onrender.com') &&
        connectDirectives.includes('wss://emergency-bed-tracker.onrender.com'),
      `connect-src: ${connectDirectives}`
    );

    // Test 12: object-src 'none' and frame-src 'none'
    record(
      12,
      "Policy restricts object-src 'none' and frame-src 'none'",
      policy.includes("object-src 'none'") && policy.includes("frame-src 'none'"),
      `Policy: ${policy}`
    );

    // Test 13: base-uri 'self' and form-action 'self'
    record(
      13,
      "Policy restricts base-uri 'self' and form-action 'self'",
      policy.includes("base-uri 'self'") && policy.includes("form-action 'self'"),
      `Policy: ${policy}`
    );

    // Test 14: Overly broad wildcards and unneeded third parties are NOT present
    const hasBroadWildcard = policy.includes(' * ') || policy.endsWith(' *');
    const hasGroqDirect = policy.includes('api.groq.com');
    const hasHttpWildcard = policy.includes('http: ') || policy.includes('http:;');
    record(
      14,
      'Policy omits broad wildcards (*), unneeded direct AI endpoints (api.groq.com), and insecure schemes',
      !hasBroadWildcard && !hasGroqDirect && !hasHttpWildcard,
      `Policy: ${policy}`
    );

    // Test 15: Production policy omits localhost
    const hasLocalhostInProdPolicy = policy.includes('localhost') || policy.includes('127.0.0.1');
    record(
      15,
      'Frontend production CSP omits localhost / 127.0.0.1 origins',
      !hasLocalhostInProdPolicy,
      `Policy: ${policy}`
    );

    // -----------------------------------------------------------------
    // SECTION 2: Backend Helmet HTTP Header Verification
    // -----------------------------------------------------------------
    console.log('\n--- SECTION 2: Backend Helmet HTTP Header Verification ---');

    // Test 16: GET /api/health emits Content-Security-Policy header
    const resHealth = await fetch(`${BASE_URL}/health`);
    const backendCsp = resHealth.headers.get('content-security-policy') || '';
    record(
      16,
      'Backend GET /api/health emits Content-Security-Policy header',
      Boolean(backendCsp),
      `Header: ${backendCsp || 'MISSING'}`
    );

    // Test 17: Backend CSP defines default-src 'none'
    record(
      17,
      "Backend API CSP defines default-src 'none'",
      backendCsp.includes("default-src 'none'"),
      `Header: ${backendCsp}`
    );

    // Test 18: Backend CSP defines frame-ancestors 'none' (anti-framing)
    record(
      18,
      "Backend API CSP defines frame-ancestors 'none'",
      backendCsp.includes("frame-ancestors 'none'"),
      `Header: ${backendCsp}`
    );

    // Test 19: Backend/server.js no longer contains contentSecurityPolicy: false
    const serverJsPath = path.join(__dirname, '../server.js');
    const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
    const hasCspFalse = /contentSecurityPolicy:\s*false/.test(serverJsContent);
    record(
      19,
      'Backend/server.js does NOT contain contentSecurityPolicy: false',
      !hasCspFalse,
      hasCspFalse ? 'Found contentSecurityPolicy: false' : 'Disabled flag removed'
    );

    // Test 20: Existing security headers (HSTS, nosniff, SAMEORIGIN) remain present
    const hsts = resHealth.headers.get('strict-transport-security');
    const nosniff = resHealth.headers.get('x-content-type-options');
    const xframe = resHealth.headers.get('x-frame-options');
    record(
      20,
      'Existing security headers (Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options) preserved',
      Boolean(hsts) && nosniff === 'nosniff' && xframe === 'SAMEORIGIN',
      `HSTS: ${hsts}, nosniff: ${nosniff}, xframe: ${xframe}`
    );

  } finally {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
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
