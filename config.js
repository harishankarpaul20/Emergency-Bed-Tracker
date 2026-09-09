/**
 * =========================================================
 * EMERGENCY BED TRACKER — ENVIRONMENT & API CONFIGURATION
 * =========================================================
 * Automatically routes API and WebSocket connections based on the current environment:
 * - Localhost / File: Connects to local Node.js backend (http://localhost:5000)
 * - GitHub Pages / Production: Connects to deployed HTTPS backend service
 * - Manual Override: Allows testing custom endpoints via localStorage or window override
 */

(function () {
  'use strict';

  // 1. Production Backend URL (Configure this with your deployed backend URL on Render, Railway, etc.)
  // Note: Must be an HTTPS endpoint when the frontend is served via GitHub Pages (HTTPS).
  const PRODUCTION_BACKEND_URL = 'https://emergency-bed-tracker-backend.onrender.com';
  const PRODUCTION_API_URL = `${PRODUCTION_BACKEND_URL}/api`;

  // 2. Local Development Backend URL
  const LOCAL_BACKEND_URL = 'http://localhost:5000';
  const LOCAL_API_URL = `${LOCAL_BACKEND_URL}/api`;

  // 3. Detect Environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const isLocal = Boolean(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    protocol === 'file:' ||
    hostname === ''
  );

  // 4. Resolve Active URLs (Priority: window override > localStorage override > environment default)
  const customApiOverride = window.API_BASE_URL || localStorage.getItem('API_BASE_URL');
  const customSocketOverride = window.SOCKET_URL || localStorage.getItem('SOCKET_URL');

  window.API_BASE_URL = customApiOverride || (isLocal ? LOCAL_API_URL : PRODUCTION_API_URL);
  window.SOCKET_URL = customSocketOverride || (isLocal ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_URL);

  // 5. Expose helper for live switching directly in browser console
  window.setBackendUrl = function (url) {
    if (!url) {
      localStorage.removeItem('API_BASE_URL');
      localStorage.removeItem('SOCKET_URL');
      console.log('🔄 Reset backend URL to environment default.');
    } else {
      const cleanUrl = url.replace(/\/+$/, '');
      const apiUrl = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
      const socketUrl = cleanUrl.replace(/\/api$/, '');
      localStorage.setItem('API_BASE_URL', apiUrl);
      localStorage.setItem('SOCKET_URL', socketUrl);
      console.log(`✅ Backend URL updated: ${apiUrl}`);
    }
    window.location.reload();
  };

  console.info(
    `🏥 Medical Bed Tracker API Target: ${window.API_BASE_URL} [${isLocal ? 'Local Dev' : 'Production/GitHub Pages'}]`
  );
})();
