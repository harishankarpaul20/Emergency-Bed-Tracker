/* =========================================================
   EMERGENCY BED TRACKER — WEST BENGAL — SCRIPT
   Enhanced with Node.js/Express API, MongoDB Atlas & Socket.IO
   ========================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------
     0. BACKEND CONFIGURATION
     ----------------------------------------------------- */
  const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';
  const SOCKET_URL = window.SOCKET_URL || 'http://localhost:5000';

  /* -----------------------------------------------------
     1. WEST BENGAL DISTRICTS
     ----------------------------------------------------- */
  const DISTRICTS = [
    "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
    "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram",
    "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia",
    "North 24 Parganas", "South 24 Parganas", "Paschim Bardhaman",
    "Purba Bardhaman", "Paschim Medinipur", "Purba Medinipur",
    "Purulia", "Uttar Dinajpur"
  ];

  /* -----------------------------------------------------
     2. DEMO HOSPITAL FALLBACK DATA
     Used as initial state and safe fallback if backend is offline.
     ----------------------------------------------------- */
  let hospitals = [
    { id: 1, _id: "6a9e9a4074b2ff9e0afbf9fa", name: "Apollo Multispeciality Hospitals", district: "Kolkata", area: "Kankurgachi", address: "58 Canal Circular Road, Kolkata", latitude: 22.5820, longitude: 88.3960, distance: 3.1, phone: "Demo contact — 033-2320-3040", generalBeds: 18, icuBeds: 5, oxygenBeds: 8, ventilators: 2, status: "available", lastUpdated: "2 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services", "Ambulance Support"] },
    { id: 2, _id: "6a9e9a4174b2ff9e0afbf9ff", name: "Ruby General Hospital", district: "Kolkata", area: "Kasba", address: "Kasba Golpark, Kolkata", latitude: 22.5140, longitude: 88.3850, distance: 4.4, phone: "Demo contact — 033-2442-6091", generalBeds: 9, icuBeds: 3, oxygenBeds: 4, ventilators: 1, status: "limited", lastUpdated: "5 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"] },
    { id: 3, _id: "6a9e9a4374b2ff9e0afbfa04", name: "R G Kar Medical College & Hospital", district: "Kolkata", area: "Shyambazar", address: "1 Khudiram Bose Sarani, Shyambazar, Kolkata", latitude: 22.6030, longitude: 88.3760, distance: 6.8, phone: "Demo contact — 033-2555-7656", generalBeds: 0, icuBeds: 0, oxygenBeds: 0, ventilators: 0, status: "full", lastUpdated: "1 minute ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "Ambulance Support"] },
    { id: 4, _id: "6a9e9a4474b2ff9e0afbfa09", name: "CMRI Hospital", district: "Kolkata", area: "New Alipore", address: "7/2 Diamond Harbour Road, New Alipore, Kolkata", latitude: 22.5090, longitude: 88.3320, distance: 5.5, phone: "Demo contact — 033-3090-3090", generalBeds: 15, icuBeds: 4, oxygenBeds: 7, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services"] },
    { id: 5, _id: "6a9e9a4574b2ff9e0afbfa0e", name: "Fortis Hospital Anandapur", district: "Kolkata", area: "Anandapur", address: "730 Anandapur, E.M. Bypass, Kolkata", latitude: 22.5100, longitude: 88.3980, distance: 7.2, phone: "Demo contact — 033-6628-4444", generalBeds: 6, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "6 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 6, _id: "6a9e9a4674b2ff9e0afbfa13", name: "Woodlands Multispeciality Hospital", district: "Kolkata", area: "Alipore", address: "8/5 Alipore Road, Kolkata", latitude: 22.5330, longitude: 88.3300, distance: 4.9, phone: "Demo contact — 033-2456-7075", generalBeds: 12, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"] },
    { id: 7, _id: "6a9e9a4774b2ff9e0afbfa18", name: "Howrah Emergency Medical Centre", district: "Howrah", area: "Howrah", address: "Howrah", latitude: 22.5958, longitude: 88.2636, distance: 8.0, phone: "Demo contact — not a verified number", generalBeds: 14, icuBeds: 3, oxygenBeds: 6, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Ambulance Support"] },
    { id: 8, _id: "6a9e9a4874b2ff9e0afbfa1d", name: "Salt Lake Emergency Care Centre", district: "North 24 Parganas", area: "Salt Lake", address: "Salt Lake, North 24 Parganas", latitude: 22.5790, longitude: 88.4310, distance: 9.3, phone: "Demo contact — not a verified number", generalBeds: 11, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 9, _id: "6a9e9a4974b2ff9e0afbfa22", name: "Bidhannagar Medical Centre", district: "North 24 Parganas", area: "Bidhannagar", address: "Bidhannagar, North 24 Parganas", latitude: 22.5850, longitude: 88.4160, distance: 8.7, phone: "Demo contact — not a verified number", generalBeds: 4, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "7 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 10, _id: "6a9e9a4a74b2ff9e0afbfa27", name: "South City Emergency Hospital", district: "South 24 Parganas", area: "Jadavpur", address: "Jadavpur, South 24 Parganas", latitude: 22.4990, longitude: 88.3710, distance: 6.4, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 11, _id: "6a9e9a4b74b2ff9e0afbfa2c", name: "Asansol District Hospital", district: "Paschim Bardhaman", area: "Asansol", address: "Asansol, Paschim Bardhaman", latitude: 23.6739, longitude: 86.9524, distance: 210, phone: "Demo contact — not a verified number", generalBeds: 16, icuBeds: 4, oxygenBeds: 7, ventilators: 2, status: "available", lastUpdated: "2 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Ambulance Support"] },
    { id: 12, _id: "6a9e9a4c74b2ff9e0afbfa31", name: "Durgapur Sub Divisional Hospital", district: "Paschim Bardhaman", area: "Durgapur", address: "Durgapur, Paschim Bardhaman", latitude: 23.5204, longitude: 87.3119, distance: 195, phone: "Demo contact — not a verified number", generalBeds: 7, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 13, _id: "6a9e9a4c74b2ff9e0afbfa36", name: "North Bengal Emergency Care Centre", district: "Darjeeling", area: "Siliguri", address: "Siliguri, Darjeeling", latitude: 26.7271, longitude: 88.3953, distance: 570, phone: "Demo contact — not a verified number", generalBeds: 13, icuBeds: 4, oxygenBeds: 6, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 14, _id: "6a9e9a4e74b2ff9e0afbfa3b", name: "Siliguri Medical Support Centre", district: "Darjeeling", area: "Siliguri", address: "Siliguri, Darjeeling", latitude: 26.7100, longitude: 88.4290, distance: 575, phone: "Demo contact — not a verified number", generalBeds: 3, icuBeds: 1, oxygenBeds: 1, ventilators: 0, status: "limited", lastUpdated: "8 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 15, _id: "6a9e9a4f74b2ff9e0afbfa40", name: "Jalpaiguri Emergency Hospital", district: "Jalpaiguri", area: "Jalpaiguri", address: "Jalpaiguri", latitude: 26.5433, longitude: 88.7293, distance: 600, phone: "Demo contact — not a verified number", generalBeds: 10, icuBeds: 2, oxygenBeds: 4, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 16, _id: "6a9e9a5074b2ff9e0afbfa45", name: "Malda Emergency Care Centre", district: "Malda", area: "Malda", address: "Malda", latitude: 25.0088, longitude: 88.1414, distance: 340, phone: "Demo contact — not a verified number", generalBeds: 9, icuBeds: 2, oxygenBeds: 4, ventilators: 1, status: "available", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 17, _id: "6a9e9a5074b2ff9e0afbfa4a", name: "Murshidabad Medical Centre", district: "Murshidabad", area: "Berhampore", address: "Berhampore, Murshidabad", latitude: 24.0965, longitude: 88.2517, distance: 210, phone: "Demo contact — not a verified number", generalBeds: 5, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "7 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 18, _id: "6a9e9a5174b2ff9e0afbfa4f", name: "Kalyani Emergency Hospital", district: "Nadia", area: "Kalyani", address: "Kalyani, Nadia", latitude: 22.9750, longitude: 88.4340, distance: 55, phone: "Demo contact — not a verified number", generalBeds: 12, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 19, _id: "6a9e9a5274b2ff9e0afbfa54", name: "Haldia Emergency Medical Centre", district: "Purba Medinipur", area: "Haldia", address: "Haldia, Purba Medinipur", latitude: 22.0667, longitude: 88.0698, distance: 120, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 20, _id: "6a9e9a5474b2ff9e0afbfa59", name: "Kharagpur Emergency Hospital", district: "Paschim Medinipur", area: "Kharagpur", address: "Kharagpur, Paschim Medinipur", latitude: 22.3460, longitude: 87.2320, distance: 130, phone: "Demo contact — not a verified number", generalBeds: 6, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 21, _id: "6a9e9a5474b2ff9e0afbfa5e", name: "Bankura Emergency Care Centre", district: "Bankura", area: "Bankura", address: "Bankura", latitude: 23.2324, longitude: 87.0740, distance: 200, phone: "Demo contact — not a verified number", generalBeds: 7, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 22, _id: "6a9e9a5574b2ff9e0afbfa63", name: "Purulia Emergency Medical Centre", district: "Purulia", area: "Purulia", address: "Purulia", latitude: 23.3320, longitude: 86.3650, distance: 260, phone: "Demo contact — not a verified number", generalBeds: 4, icuBeds: 1, oxygenBeds: 1, ventilators: 0, status: "limited", lastUpdated: "8 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 23, _id: "6a9e9a5674b2ff9e0afbfa68", name: "Cooch Behar Emergency Hospital", district: "Cooch Behar", area: "Cooch Behar", address: "Cooch Behar", latitude: 26.3260, longitude: 89.4470, distance: 650, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 24, _id: "6a9e9a5774b2ff9e0afbfa6d", name: "Birbhum Medical Support Centre", district: "Birbhum", area: "Suri", address: "Suri, Birbhum", latitude: 23.9200, longitude: 87.5340, distance: 220, phone: "Demo contact — not a verified number", generalBeds: 5, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] }
  ];

  const STATUS_LABEL = { available: "🟢 AVAILABLE", limited: "🟡 LIMITED", full: "🔴 FULL" };
  const MAX_CAPACITY_REFERENCE = 25; // demo denominator for the illustrative capacity bar

  /* -----------------------------------------------------
     3. APPLICATION STATE & DOM REFERENCES
     ----------------------------------------------------- */
  let activeHospital = null;
  // In-memory authentication state (AUTH-06: No access tokens in localStorage/sessionStorage)
  let authToken = '';
  let csrfToken = '';
  let currentUser = null;
  let isRefreshing = null;
  let leafletMap = null;
  let markerLayerGroup = null;

  // Clear legacy tokens from localStorage if any exist
  try {
    localStorage.removeItem('medbed_auth_token');
  } catch (e) {}


  const hospitalGrid = document.getElementById('hospitalGrid');
  const emptyState = document.getElementById('emptyState');
  const resultsMeta = document.getElementById('resultsMeta');
  const loadingState = document.getElementById('loadingState');
  const districtGrid = document.getElementById('districtGrid');

  const filterDistrict = document.getElementById('filterDistrict');
  const filterCity = document.getElementById('filterCity');
  const filterBedType = document.getElementById('filterBedType');
  const filterAvailability = document.getElementById('filterAvailability');
  const filterSearch = document.getElementById('filterSearch');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const emptyClearBtn = document.getElementById('emptyClearBtn');

  const heroSearchForm = document.getElementById('heroSearchForm');
  const heroSearchInput = document.getElementById('heroSearchInput');
  const useLocationBtn = document.getElementById('useLocationBtn');

  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  const toast = document.getElementById('toast');
  let activeDistrictChip = 'all';

  // Hospital Details Modal DOM
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCloseBtn2 = document.getElementById('modalCloseBtn2');
  const modalRequestBedBtn = document.getElementById('modalRequestBedBtn');
  let lastFocusedEl = null;

  // Bed Request Modal DOM
  const requestBedModalOverlay = document.getElementById('requestBedModalOverlay');
  const requestModalCloseBtn = document.getElementById('requestModalCloseBtn');
  const cancelBedRequestBtn = document.getElementById('cancelBedRequestBtn');
  const bedRequestForm = document.getElementById('bedRequestForm');
  const submitBedRequestBtn = document.getElementById('submitBedRequestBtn');

  // Staff Portal Modal DOM
  const staffPortalModalOverlay = document.getElementById('staffPortalModalOverlay');
  const staffModalCloseBtn = document.getElementById('staffModalCloseBtn');
  const staffLoginCloseBtn = document.getElementById('staffLoginCloseBtn');
  const staffLoginForm = document.getElementById('staffLoginForm');
  const staffHospitalSelect = document.getElementById('staffHospitalSelect');
  const staffLoginSubmitBtn = document.getElementById('staffLoginSubmitBtn');
  const staffLoginSection = document.getElementById('staffLoginSection');
  const staffDashboardSection = document.getElementById('staffDashboardSection');
  const staffAuthBadge = document.getElementById('staffAuthBadge');
  const staffHospName = document.getElementById('staffHospName');
  const staffUserEmail = document.getElementById('staffUserEmail');
  const staffBedTableBody = document.getElementById('staffBedTableBody');
  const staffRequestsContainer = document.getElementById('staffRequestsContainer');
  const staffLogoutBtn = document.getElementById('staffLogoutBtn');
  const prefillApolloBtn = document.getElementById('prefillApolloBtn');
  const prefillSuperBtn = document.getElementById('prefillSuperBtn');
  const navStaffPortalBtn = document.getElementById('navStaffPortalBtn');
  const mobileStaffPortalBtn = document.getElementById('mobileStaffPortalBtn');
  const superAdminSection = document.getElementById('superAdminSection');
  const superAdminHospitalCountBadge = document.getElementById('superAdminHospitalCountBadge');
  const createHospitalAdminForm = document.getElementById('createHospitalAdminForm');
  const newAdminName = document.getElementById('newAdminName');
  const newAdminEmail = document.getElementById('newAdminEmail');
  const newAdminPassword = document.getElementById('newAdminPassword');
  const newAdminHospital = document.getElementById('newAdminHospital');
  const createAdminSubmitBtn = document.getElementById('createAdminSubmitBtn');
  const staffAdminsTableBody = document.getElementById('staffAdminsTableBody');
  const superAdminHospSelect = document.getElementById('superAdminHospSelect');

  /* -----------------------------------------------------
     4. API CLIENT & HTTP UTILITIES
     ----------------------------------------------------- */
  async function silentRefresh() {
    if (isRefreshing) return isRefreshing;

    isRefreshing = (async () => {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers,
          credentials: 'include'
        });

        if (!res.ok) {
          authToken = '';
          csrfToken = '';
          currentUser = null;
          return false;
        }

        const body = await res.json();
        if (body.data?.token) {
          authToken = body.data.token;
          csrfToken = body.data.csrfToken || '';
          currentUser = body.data.user || null;
          return true;
        }
        return false;
      } catch (err) {
        return false;
      } finally {
        isRefreshing = null;
      }
    })();

    return isRefreshing;
  }

  async function apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const config = {
      credentials: 'include',
      ...options,
      headers,
    };

    let res;
    try {
      res = await fetch(`${API_BASE_URL}${endpoint}`, config);
    } catch (netErr) {
      const prodApiUrl = 'https://emergency-bed-tracker.onrender.com/api';
      const isLocal = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1' ||
                      window.location.protocol === 'file:';
      if (isLocal && API_BASE_URL !== prodApiUrl) {
        console.warn(`Local backend unreachable at ${API_BASE_URL}. Retrying with live Render backend: ${prodApiUrl}`);
        try {
          res = await fetch(`${prodApiUrl}${endpoint}`, config);
          window.API_BASE_URL = prodApiUrl;
        } catch (fbErr) {
          throw netErr;
        }
      } else {
        throw netErr;
      }
    }

    let body = {};
    try {
      body = await res.json();
    } catch (e) {
      body = {};
    }

    if (!res.ok) {
      // If 401 and request was authenticated, try silent refresh once
      if (res.status === 401 && !options._isRetry && !endpoint.startsWith('/auth/')) {
        const refreshed = await silentRefresh();
        if (refreshed) {
          return apiRequest(endpoint, { ...options, _isRetry: true });
        }
        authToken = '';
        csrfToken = '';
        currentUser = null;
      } else if (res.status === 401 && endpoint.startsWith('/auth/')) {
        authToken = '';
        csrfToken = '';
        currentUser = null;
      }
      const errMsg = body.message || body.errors?.[0]?.message || `Request failed with status ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }


  function formatErrorMessage(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (item.message) return typeof item.message === 'string' ? item.message : formatErrorMessage(item.message);
    if (item.msg) return typeof item.msg === 'string' ? item.msg : formatErrorMessage(item.msg);
    if (item.error) return typeof item.error === 'string' ? item.error : formatErrorMessage(item.error);
    if (Array.isArray(item.errors) && item.errors.length) return formatErrorMessage(item.errors[0]);
    if (typeof item === 'object') {
      if (item.label) return item.label;
      const values = Object.values(item).map(v => (typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''))).filter(Boolean);
      if (values.length) return values.join(' - ');
      try { return JSON.stringify(item); } catch (e) { return String(item); }
    }
    return String(item);
  }

  function showToast(message, duration = 3400) {
    if (!toast) return;
    toast.textContent = typeof message === 'string' ? message : formatErrorMessage(message);
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toRad(deg) { return (deg * Math.PI) / 180; }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  }

  /* -----------------------------------------------------
     5. LOAD DATA FROM BACKEND APIS
     ----------------------------------------------------- */
  async function fetchHospitalsFromBackend() {
    try {
      loadingState.hidden = false;
      const res = await apiRequest('/hospitals?limit=100');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        hospitals = res.data;
        updateStatistics();
        renderDistrictExplorer();
        populateCityDropdown(filterDistrict.value);
        renderHospitals(filterHospitals());
        updateMapMarkers();
        populateStaffHospitalDropdown();
      }
    } catch (err) {
      console.warn('Backend hospital fetch note (using fallback):', err.message);
    } finally {
      loadingState.hidden = true;
    }
  }

  function populateStaffHospitalDropdown() {
    if (!staffHospitalSelect) return;
    const currentVal = staffHospitalSelect.value;
    staffHospitalSelect.innerHTML = '<option value="">Select Hospital ▼</option>' +
      hospitals.map(h => `<option value="${h._id || h.id}">${escapeHtml(h.name)} (${escapeHtml(h.district)})</option>`).join('');
    if (currentVal) {
      staffHospitalSelect.value = currentVal;
    }
  }

  async function fetchStatisticsFromBackend() {
    try {
      const res = await apiRequest('/hospitals/statistics');
      if (res.success && res.data) {
        const s = res.data;
        setStat('statDistricts', s.districtsCovered);
        setStat('statHospitals', s.totalHospitals);
        setStat('statBeds', s.totalBedsTracked);
        setStat('statIcu', s.totalIcuBeds);
        setStat('statAvailable', s.availableHospitals);
        setStat('statFull', s.fullHospitals);

        setStat('dashDistricts', s.districtsCovered);
        setStat('dashHospitals', s.totalHospitals);
        setStat('dashBeds', s.totalBedsTracked);
        setStat('dashIcu', s.totalIcuBeds);
        observeCounters();
      }
    } catch (err) {
      updateStatistics();
    }
  }

  /* -----------------------------------------------------
     6. POPULATE DISTRICT & CITY DROPDOWNS
     ----------------------------------------------------- */
  function populateDistrictDropdown() {
    filterDistrict.innerHTML = '<option value="all">All West Bengal Districts</option>';
    DISTRICTS.slice().sort().forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      filterDistrict.appendChild(opt);
    });
  }

  function populateCityDropdown(districtFilter) {
    const current = filterCity.value;
    filterCity.innerHTML = '<option value="all">All Cities / Areas</option>';
    const areas = Array.from(new Set(
      hospitals
        .filter(h => districtFilter === 'all' || h.district === districtFilter)
        .map(h => h.area)
    )).filter(Boolean).sort();

    areas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      filterCity.appendChild(opt);
    });
    if (areas.includes(current)) filterCity.value = current;
  }

  filterDistrict.addEventListener('change', () => {
    populateCityDropdown(filterDistrict.value);
    syncDistrictChips(filterDistrict.value);
  });

  /* -----------------------------------------------------
     7. DISTRICT EXPLORER CHIPS
     ----------------------------------------------------- */
  function renderDistrictExplorer() {
    const counts = {};
    hospitals.forEach(h => { counts[h.district] = (counts[h.district] || 0) + 1; });

    const chipsHtml = DISTRICTS.slice().sort().map(d => {
      const count = counts[d] || 0;
      return `<button type="button" class="district-chip ${activeDistrictChip === d ? 'active' : ''}" data-district="${escapeHtml(d)}">
        📍 ${escapeHtml(d)} <span class="chip-count">${count}</span>
      </button>`;
    }).join('');

    districtGrid.innerHTML = chipsHtml;

    districtGrid.querySelectorAll('.district-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const district = chip.dataset.district;
        filterByDistrict(district);
      });
    });
  }

  function syncDistrictChips(district) {
    activeDistrictChip = district;
    districtGrid.querySelectorAll('.district-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.district === district);
    });
  }

  function filterByDistrict(district) {
    filterDistrict.value = district;
    populateCityDropdown(district);
    syncDistrictChips(district);
    document.getElementById('hospitals').scrollIntoView({ behavior: 'smooth' });
    searchHospitals();
  }

  /* -----------------------------------------------------
     8. RENDER HOSPITAL CARDS
     ----------------------------------------------------- */
  function bedNumClass(value) {
    return value === 0 ? 'hc-bed-num zero' : 'hc-bed-num';
  }

  function capacityFillClass(status) {
    if (status === 'full') return 'hc-capacity-fill full';
    if (status === 'limited') return 'hc-capacity-fill limited';
    return 'hc-capacity-fill';
  }

  function renderHospitalCard(h) {
    const isFull = h.generalBeds === 0 && h.icuBeds === 0 && h.oxygenBeds === 0;
    const statusLabel = isFull ? "🔴 CURRENTLY FULL" : STATUS_LABEL[h.status] || "🟢 AVAILABLE";
    const totalBeds = (h.generalBeds || 0) + (h.icuBeds || 0) + (h.oxygenBeds || 0);
    const capacityPct = Math.min(100, Math.round((totalBeds / MAX_CAPACITY_REFERENCE) * 100));
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ', ' + (h.address || h.area))}`;
    const targetId = h._id || h.id;

    const matchChips = (h.matchReasons && h.matchReasons.length > 0)
      ? `
        <div class="hc-match-badge" title="Clinical match criteria">
          <span>🎯 Prioritized Match:</span>
        </div>
        <div class="hc-match-reasons">
          ${h.matchReasons.slice(0, 3).map(r => `<span class="hc-match-chip">✓ ${escapeHtml(r)}</span>`).join('')}
        </div>
      `
      : '';

    return `
      <article class="hospital-card" data-id="${targetId}" tabindex="0" aria-label="${escapeHtml(h.name)}">
        <div class="hc-top">
          <div class="hc-title-row">
            <span class="hc-icon" aria-hidden="true">🏥</span>
            <div>
              <h3 class="hc-name">${escapeHtml(h.name)}</h3>
              ${h.verified || h.isVerified
                ? '<p class="hc-verified">✓ Verified location</p>'
                : '<p class="hc-demo-tag">⚠ Demo Hospital Record</p>'}
            </div>
          </div>
          <span class="status-badge ${h.status}">${statusLabel}</span>
        </div>

        ${matchChips}

        <div class="hc-meta" style="${matchChips ? 'margin-top: 10px;' : ''}">
          <span>📍 ${escapeHtml(h.district)}</span>
          <span>📍 ${escapeHtml(h.area)}</span>
          <span>${typeof h.distance === 'number' ? h.distance.toFixed(1) : '3.5'} km away</span>
        </div>

        <div class="hc-beds">
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.generalBeds || 0)}">${h.generalBeds || 0}</span>
            <span class="hc-bed-label">General</span>
          </div>
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.icuBeds || 0)}">${h.icuBeds || 0}</span>
            <span class="hc-bed-label">ICU</span>
          </div>
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.oxygenBeds || 0)}">${h.oxygenBeds || 0}</span>
            <span class="hc-bed-label">Oxygen</span>
          </div>
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.ventilators || 0)}">${h.ventilators || 0}</span>
            <span class="hc-bed-label">Vent.</span>
          </div>
        </div>

        <div class="hc-capacity">
          <span class="hc-capacity-label"><span>General capacity (live)</span><span>${capacityPct}%</span></span>
          <div class="hc-capacity-track">
            <div class="${capacityFillClass(h.status)}" style="width:${capacityPct}%"></div>
          </div>
        </div>

        <p class="hc-updated">Last update: ${escapeHtml(h.lastUpdated || 'Recently')}</p>
        <p class="hc-demo-note">Connected to Live Bed Network</p>

        <div class="hc-actions">
          <button class="btn btn-primary btn-sm view-details-btn" data-id="${targetId}">VIEW DETAILS</button>
          <button class="btn btn-emergency btn-sm card-req-btn" data-id="${targetId}">🛏️ BOOK</button>
          <a href="${directionsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🗺️ DIRECTIONS</a>
        </div>
      </article>
    `;
  }

  function renderHospitals(list) {
    if (!list.length) {
      hospitalGrid.innerHTML = '';
      emptyState.hidden = false;
      resultsMeta.textContent = `Showing 0 of ${hospitals.length} hospitals`;
      return;
    }
    emptyState.hidden = true;
    hospitalGrid.innerHTML = list.map(renderHospitalCard).join('');
    resultsMeta.textContent = `Showing ${list.length} of ${hospitals.length} hospitals`;

    hospitalGrid.querySelectorAll('.view-details-btn').forEach(btn => {
      btn.addEventListener('click', () => showHospitalDetails(btn.dataset.id));
    });

    hospitalGrid.querySelectorAll('.card-req-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBedRequestModal(btn.dataset.id);
      });
    });
  }

  /* -----------------------------------------------------
     9. FILTER FUNCTIONS
     ----------------------------------------------------- */
  function filterByBedType(list, bedType) {
    if (bedType === 'general') return list.filter(h => (h.generalBeds || 0) > 0);
    if (bedType === 'icu') return list.filter(h => (h.icuBeds || 0) > 0);
    if (bedType === 'oxygen') return list.filter(h => (h.oxygenBeds || 0) > 0);
    if (bedType === 'ventilator') return list.filter(h => (h.ventilators || 0) > 0);
    return list;
  }

  function filterByAvailability(list, availability) {
    if (availability === 'all') return list;
    return list.filter(h => h.status === availability);
  }

  function filterHospitals() {
    const district = filterDistrict.value;
    const city = filterCity.value;
    const bedType = filterBedType.value;
    const availability = filterAvailability.value;
    const query = (filterSearch.value || '').trim().toLowerCase();

    let list = hospitals.slice();

    if (district !== 'all') list = list.filter(h => h.district.toLowerCase() === district.toLowerCase());
    if (city !== 'all') list = list.filter(h => h.area.toLowerCase() === city.toLowerCase());
    list = filterByBedType(list, bedType);
    list = filterByAvailability(list, availability);

    if (query) {
      list = list.filter(h => {
        const haystack = `${h.name} ${h.district} ${h.area} ${h.address || ''}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    return list.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  let searchDebounceTimer = null;
  function searchHospitals() {
    clearTimeout(searchDebounceTimer);
    loadingState.hidden = false;
    hospitalGrid.style.opacity = '0.4';

    searchDebounceTimer = setTimeout(() => {
      const results = filterHospitals();
      renderHospitals(results);
      hospitalGrid.style.opacity = '1';
      loadingState.hidden = true;
    }, 150);
  }

  function clearFilters() {
    filterDistrict.value = 'all';
    populateCityDropdown('all');
    filterBedType.value = 'all';
    filterAvailability.value = 'all';
    filterSearch.value = '';
    syncDistrictChips('all');
    renderHospitals(hospitals.slice().sort((a, b) => (a.distance || 0) - (b.distance || 0)));
  }

  applyFiltersBtn.addEventListener('click', searchHospitals);
  clearFiltersBtn.addEventListener('click', clearFilters);
  emptyClearBtn.addEventListener('click', clearFilters);
  filterSearch.addEventListener('keyup', (e) => { if (e.key === 'Enter') searchHospitals(); });

  heroSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    filterSearch.value = heroSearchInput.value;
    searchHospitals();
    document.getElementById('find-beds').scrollIntoView({ behavior: 'smooth' });
  });

  /* -----------------------------------------------------
     10. HOSPITAL DETAILS MODAL
     ----------------------------------------------------- */
  function showHospitalDetails(id) {
    const h = hospitals.find(x => x._id === id || x.id == id);
    if (!h) return;

    activeHospital = h;

    document.getElementById('modalHospitalName').textContent = h.name;
    const verifiedEl = document.getElementById('modalVerified');
    const isVer = h.verified || h.isVerified;
    verifiedEl.textContent = isVer ? '✓ Verified location' : '⚠ Demo Hospital Record';
    verifiedEl.style.color = isVer ? 'var(--success)' : 'var(--warning)';

    const badge = document.getElementById('modalStatusBadge');
    const isFull = (h.generalBeds || 0) === 0 && (h.icuBeds || 0) === 0 && (h.oxygenBeds || 0) === 0;
    badge.className = 'status-badge ' + h.status;
    badge.textContent = isFull ? '🔴 CURRENTLY FULL' : STATUS_LABEL[h.status] || '🟢 AVAILABLE';

    document.getElementById('modalDistrict').textContent = h.district;
    document.getElementById('modalArea').textContent = h.area;
    document.getElementById('modalAddress').textContent = h.address || h.area;
    document.getElementById('modalEmergencyDept').textContent = (h.facilities || []).includes('Emergency Department') ? 'Yes, 24/7' : 'Not listed';
    document.getElementById('modalPhone').textContent = h.phone || '033-2320-3040';
    document.getElementById('modalLastUpdated').textContent = h.lastUpdated || 'Recently';

    document.getElementById('modalGeneralBeds').textContent = h.generalBeds || 0;
    document.getElementById('modalIcuBeds').textContent = h.icuBeds || 0;
    document.getElementById('modalOxygenBeds').textContent = h.oxygenBeds || 0;
    document.getElementById('modalVentilators').textContent = h.ventilators || 0;

    const facList = document.getElementById('modalFacilities');
    facList.innerHTML = (h.facilities && h.facilities.length > 0)
      ? h.facilities.map(f => `<li>${escapeHtml(f)}</li>`).join('')
      : '<li>Emergency Department</li><li>Oxygen Support</li>';

    document.getElementById('modalCallBtn').href = 'tel:112';
    document.getElementById('modalDirectionsBtn').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ', ' + (h.address || h.area))}`;

    lastFocusedEl = document.activeElement;
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    modalCloseBtn.focus();
  }

  function closeModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalCloseBtn2.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

  /* -----------------------------------------------------
     11. BED RESERVATION MODAL & CONCURRENCY-SAFE BOOKING
     ----------------------------------------------------- */
  function openBedRequestModal(hospId) {
    const h = hospitals.find(x => x._id === hospId || x.id == hospId);
    if (!h) return;

    activeHospital = h;
    document.getElementById('reqHospitalId').value = h._id || h.id;
    document.getElementById('requestHospitalSubtitle').textContent = `${h.name} (${h.district})`;
    requestBedModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeBedRequestModal() {
    requestBedModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  modalRequestBedBtn.addEventListener('click', () => {
    closeModal();
    if (activeHospital) {
      openBedRequestModal(activeHospital._id || activeHospital.id);
    }
  });

  requestModalCloseBtn.addEventListener('click', closeBedRequestModal);
  cancelBedRequestBtn.addEventListener('click', closeBedRequestModal);
  requestBedModalOverlay.addEventListener('click', (e) => {
    if (e.target === requestBedModalOverlay) closeBedRequestModal();
  });

  bedRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const hospitalId = document.getElementById('reqHospitalId').value;
    const patientName = document.getElementById('reqPatientName').value.trim();
    const contactPhone = document.getElementById('reqContactPhone').value.trim();
    const bedType = document.getElementById('reqBedType').value;
    const notes = document.getElementById('reqNotes').value.trim();

    submitBedRequestBtn.disabled = true;
    submitBedRequestBtn.textContent = '⏳ Reserving Bed...';

    async function ensureAuth() {
      if (!authToken) {
        // Attempt silent refresh first
        const refreshed = await silentRefresh();
        if (refreshed && authToken) return;

        try {
          const authRes = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'user@demo.wb.gov.in', password: 'Password123!' })
          });
          if (authRes.data?.token) {
            authToken = authRes.data.token;
            csrfToken = authRes.data.csrfToken || '';
            currentUser = authRes.data.user || null;
          }
        } catch (authErr) {
          // If login fails, try citizen registration
          const regRes = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: patientName || 'Citizen User',
              email: `patient_${Date.now()}@wb.gov.in`,
              password: 'Password123!',
              phone: contactPhone || '9876543210',
            })
          });
          if (regRes.data?.token) {
            authToken = regRes.data.token;
            csrfToken = regRes.data.csrfToken || '';
            currentUser = regRes.data.user || null;
          }
        }
      }
    }


    try {
      await ensureAuth();

      // Submit atomic reservation request to backend
      const payload = {
        hospitalId,
        bedType,
        patientName,
        contactPhone,
        notes,
      };

      let res;
      try {
        res = await apiRequest('/bed-requests', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (reqErr) {
        if (reqErr.status === 401) {
          // Token expired or invalid: re-auth and retry once
          await ensureAuth();
          res = await apiRequest('/bed-requests', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        } else {
          throw reqErr;
        }
      }

      showToast(`✅ Bed reservation confirmed! 1 ${bedType.toUpperCase()} bed held at ${activeHospital?.name || 'hospital'}.`);
      bedRequestForm.reset();
      closeBedRequestModal();
      fetchHospitalsFromBackend();
    } catch (err) {
      showToast(`❌ Reservation failed: ${err.message}`);
    } finally {
      submitBedRequestBtn.disabled = false;
      submitBedRequestBtn.textContent = 'CONFIRM RESERVATION';
    }
  });

  /* -----------------------------------------------------
     12. STAFF PORTAL & BED MANAGEMENT
     ----------------------------------------------------- */
  async function openStaffPortalModal() {
    staffPortalModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    populateStaffHospitalDropdown();

    if (!authToken) {
      await silentRefresh();
    }

    if (authToken) {
      if (checkStaffSessionTimeout()) {
        renderStaffLoginForm();
        return;
      }
    }

    if (authToken && currentUser) {
      resetStaffInactivityTimer();
      renderStaffDashboard();
    } else if (authToken) {
      // Validate existing token
      apiRequest('/auth/me')
        .then(res => {
          currentUser = res.data;
          resetStaffInactivityTimer();
          renderStaffDashboard();
        })
        .catch(() => {
          authToken = '';
          csrfToken = '';
          currentUser = null;
          localStorage.removeItem('medbed_staff_last_active');
          renderStaffLoginForm();
        });
    } else {
      renderStaffLoginForm();
    }
  }

  function closeStaffPortalModal() {
    staffPortalModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function renderStaffLoginForm() {
    staffLoginSection.hidden = false;
    staffDashboardSection.hidden = true;
    staffAuthBadge.textContent = '🔒 Not Logged In';
    staffAuthBadge.className = 'status-badge';
    populateStaffHospitalDropdown();
  }

  let currentSuperAdminHospId = null;

  async function renderStaffDashboard() {
    staffLoginSection.hidden = true;
    staffDashboardSection.hidden = false;

    const isSuper = currentUser.role === 'super_admin';
    staffAuthBadge.textContent = isSuper ? '🟢 SUPER ADMIN' : '🟢 HOSPITAL ADMIN';
    staffAuthBadge.className = 'status-badge available';

    staffUserEmail.textContent = `${currentUser.email} (${currentUser.name} — ${isSuper ? 'State Administrator' : 'Hospital Administrator'})`;

    if (isSuper) {
      if (superAdminSection) superAdminSection.hidden = false;
      await initSuperAdminDashboard();
    } else {
      if (superAdminSection) superAdminSection.hidden = true;
      const targetHosp = currentUser.hospital || hospitals[0];
      staffHospName.textContent = targetHosp.name || 'Assigned Hospital Network';
      const hospId = targetHosp._id || targetHosp.id;
      loadHospitalBedsAndRequests(hospId);
    }
  }

  async function initSuperAdminDashboard() {
    try {
      // 1. Fetch dynamic hospital list for dropdown and count
      const res = await apiRequest('/admin/hospitals');
      const adminHospitals = res.data || [];
      const totalCount = res.count !== undefined ? res.count : adminHospitals.length;

      if (superAdminHospitalCountBadge) {
        superAdminHospitalCountBadge.textContent = `🏥 ${totalCount} Hospitals in Network`;
      }

      // Populate newAdminHospital dropdown dynamically
      if (newAdminHospital) {
        newAdminHospital.innerHTML = '<option value="">Select Hospital ▼</option>' +
          adminHospitals.map(h => `<option value="${h.id || h._id}">${escapeHtml(h.name)} (${escapeHtml(h.district)})</option>`).join('');
      }

      // Populate superAdminHospSelect dropdown for inspecting beds
      if (superAdminHospSelect) {
        superAdminHospSelect.innerHTML = adminHospitals.map(h => `<option value="${h.id || h._id}">${escapeHtml(h.name)} (${escapeHtml(h.district)})</option>`).join('');
        if (!currentSuperAdminHospId && adminHospitals.length > 0) {
          currentSuperAdminHospId = adminHospitals[0].id || adminHospitals[0]._id;
        }
        if (currentSuperAdminHospId) {
          superAdminHospSelect.value = currentSuperAdminHospId;
        }
      }

      // Set current viewed hospital header
      const activeHospObj = adminHospitals.find(h => (h.id || h._id) === currentSuperAdminHospId) || adminHospitals[0];
      staffHospName.textContent = activeHospObj ? activeHospObj.name : 'State Hospital Network';

      // 2. Load staff list
      await loadStaffAdminsList();

      // 3. Load beds & requests for active hospital
      if (currentSuperAdminHospId) {
        loadHospitalBedsAndRequests(currentSuperAdminHospId);
      }
    } catch (err) {
      console.warn('Super Admin init note:', err.message);
    }
  }

  async function loadStaffAdminsList() {
    if (!staffAdminsTableBody) return;
    try {
      const res = await apiRequest('/admin/staff');
      const staffList = res.data || [];

      if (!staffList.length) {
        staffAdminsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 16px;">No staff administrators registered yet.</td></tr>';
        return;
      }

      staffAdminsTableBody.innerHTML = staffList.map(u => {
        const hospName = u.hospital ? (u.hospital.name || 'Assigned Facility') : (u.role === 'super_admin' ? 'Global (All Facilities)' : 'None');
        const isSuper = u.role === 'super_admin';
        return `
          <tr data-user-id="${u._id || u.id}">
            <td><strong>${escapeHtml(u.name)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(hospName)}</td>
            <td><span class="status-badge ${isSuper ? 'available' : ''}">${escapeHtml(u.role)}</span></td>
            <td><span class="status-badge ${u.isActive ? 'available' : 'full'}">${u.isActive ? '🟢 Active' : '⚪ Inactive'}</span></td>
            <td>
              ${isSuper ? '<span style="font-size: 0.8rem; color: var(--muted);">Protected</span>' : `
                <button type="button" class="btn btn-outline btn-xs toggle-staff-status-btn" data-id="${u._id || u.id}" data-active="${u.isActive}">
                  ${u.isActive ? 'Deactivate' : 'Activate'}
                </button>
              `}
            </td>
          </tr>
        `;
      }).join('');

      // Wire toggle buttons
      staffAdminsTableBody.querySelectorAll('.toggle-staff-status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const userId = btn.dataset.id;
          const currentActive = btn.dataset.active === 'true';
          try {
            await apiRequest(`/admin/staff/${userId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ isActive: !currentActive }),
            });
            showToast(`Staff account ${!currentActive ? 'activated' : 'deactivated'}.`);
            await loadStaffAdminsList();
          } catch (e) {
            showToast(`❌ ${e.message}`);
          }
        });
      });
    } catch (err) {
      staffAdminsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 16px;">Failed to load staff accounts: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function loadHospitalBedsAndRequests(hospId) {
    try {
      const bedsRes = await apiRequest(`/hospitals/${hospId}/beds`);
      renderStaffBedTable(bedsRes.data || []);
      loadStaffBedRequests(hospId);
    } catch (err) {
      console.warn('Failed to load hospital beds:', err.message);
    }
  }

  function renderStaffBedTable(beds) {
    if (!beds.length) {
      staffBedTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 16px; color: var(--muted);">No bed inventory records found for this facility.</td></tr>';
      return;
    }

    staffBedTableBody.innerHTML = beds.map(b => `
      <tr data-bed-id="${b._id}">
        <td><strong>${escapeHtml(b.type.toUpperCase())}</strong></td>
        <td>${b.totalBeds}</td>
        <td>${b.occupiedBeds}</td>
        <td>${b.reservedBeds}</td>
        <td><strong style="color: ${b.availableBeds > 0 ? 'var(--success)' : 'var(--danger)'}">${b.availableBeds}</strong></td>
        <td>
          <div class="bed-counter-ctrl">
            <button type="button" class="bed-dec-btn" data-id="${b._id}" data-occupied="${b.occupiedBeds}" title="Decrease occupied bed count">−</button>
            <span>${b.occupiedBeds}</span>
            <button type="button" class="bed-inc-btn" data-id="${b._id}" data-occupied="${b.occupiedBeds}" data-total="${b.totalBeds}" title="Increase occupied bed count">+</button>
          </div>
        </td>
      </tr>
    `).join('');

    staffBedTableBody.querySelectorAll('.bed-dec-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const occ = Math.max(0, parseInt(btn.dataset.occupied, 10) - 1);
        await updateBedAvailability(btn.dataset.id, occ);
      });
    });

    staffBedTableBody.querySelectorAll('.bed-inc-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const total = parseInt(btn.dataset.total, 10);
        const occ = Math.min(total, parseInt(btn.dataset.occupied, 10) + 1);
        await updateBedAvailability(btn.dataset.id, occ);
      });
    });
  }

  async function updateBedAvailability(bedId, newOccupied) {
    try {
      await apiRequest(`/beds/${bedId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ occupiedBeds: newOccupied })
      });
      showToast('⚡ Live bed capacity updated.');
      const activeHospId = (currentUser.role === 'super_admin') ? currentSuperAdminHospId : (currentUser.hospital?._id || currentUser.hospitalId || currentUser.hospital);
      if (activeHospId) {
        loadHospitalBedsAndRequests(activeHospId);
      } else {
        renderStaffDashboard();
      }
      fetchHospitalsFromBackend();
    } catch (err) {
      showToast(`❌ Error: ${err.message}`);
    }
  }

  async function loadStaffBedRequests(hospId = null) {
    try {
      const url = (currentUser.role === 'super_admin' && hospId) ? `/bed-requests?hospital=${hospId}` : '/bed-requests';
      const res = await apiRequest(url);
      const reqs = res.data || [];
      window._staffRequestsCache = reqs;
      if (!reqs.length) {
        staffRequestsContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem;">No bed requests found for this facility.</p>';
        return;
      }

      staffRequestsContainer.innerHTML = reqs.slice(0, 10).map(r => {
        const patientDisplayName = escapeHtml(r.patientName || (r.user && typeof r.user === 'object' ? r.user.name : '') || 'Patient');
        const userDoc = (r.user && typeof r.user === 'object') ? r.user : null;
        const requesterName = userDoc?.name ? escapeHtml(userDoc.name) : '';
        const hasDiffRequester = requesterName && requesterName.toLowerCase() !== (r.patientName || '').toLowerCase();

        const hospDoc = (r.hospital && typeof r.hospital === 'object') ? r.hospital : null;
        const hospDisplayName = hospDoc?.name ? escapeHtml(hospDoc.name) : '';
        const hospLoc = hospDoc ? [hospDoc.area, hospDoc.district].filter(Boolean).map(escapeHtml).join(', ') : '';

        const bedDoc = (r.bed && typeof r.bed === 'object') ? r.bed : null;
        const bedTypeStr = escapeHtml((bedDoc?.type || r.bedType || 'General').toUpperCase());
        const bedStats = (bedDoc && typeof bedDoc.availableBeds === 'number')
          ? ` (${bedDoc.availableBeds} avail / ${bedDoc.totalBeds || 0} total)`
          : '';

        const phoneDisplay = escapeHtml(r.contactPhone || userDoc?.phone || 'N/A');
        const statusStr = escapeHtml((r.status || 'pending').toUpperCase());
        const statusClass = escapeHtml(r.status || 'pending');

        return `
        <div class="staff-req-card" data-req-id="${r._id}">
          <div class="staff-req-info">
            <h4>${patientDisplayName} · <span class="status-badge ${statusClass}">${statusStr}</span></h4>
            ${hospDisplayName ? `<p style="margin-bottom: 2px;">🏥 <strong>${hospDisplayName}</strong>${hospLoc ? ` <span style="font-size: 0.78rem;">(${hospLoc})</span>` : ''}</p>` : ''}
            <p style="margin-bottom: 2px;">🛏️ Bed: <strong>${bedTypeStr}</strong>${bedStats} · 📞 Phone: ${phoneDisplay}</p>
            ${hasDiffRequester ? `<p style="font-size: 0.78rem; color: var(--muted); margin-bottom: 2px;">👤 Requested by: <strong>${requesterName}</strong>${userDoc.phone ? ` (${escapeHtml(userDoc.phone)})` : ''}</p>` : ''}
            ${r.notes ? `<p style="font-style: italic; margin-top: 3px;">"${escapeHtml(r.notes)}"</p>` : ''}
          </div>
          <div class="staff-req-actions">
            ${r.status === 'pending' ? `
              <button type="button" class="btn btn-primary btn-xs req-approve-btn" data-id="${r._id}">Approve</button>
              <button type="button" class="btn btn-outline btn-xs req-reject-btn" data-id="${r._id}">Reject</button>
            ` : `<span>Completed</span>`}
            <button type="button" class="btn btn-outline btn-xs req-refer-btn" data-id="${r._id}" style="color: #0284c7; border-color: #0284c7;">REFER PATIENT</button>
          </div>
        </div>
      `;
      }).join('');

      staffRequestsContainer.querySelectorAll('.req-approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/bed-requests/${btn.dataset.id}/approve`, { method: 'PATCH' });
            showToast('✅ Bed request approved.');
            loadStaffBedRequests(hospId);
            fetchHospitalsFromBackend();
          } catch (e) { showToast(`❌ ${e.message}`); }
        });
      });

      staffRequestsContainer.querySelectorAll('.req-reject-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/bed-requests/${btn.dataset.id}/reject`, { method: 'PATCH' });
            showToast('Bed request rejected. Bed released back to pool.');
            loadStaffBedRequests(hospId);
            fetchHospitalsFromBackend();
          } catch (e) { showToast(`❌ ${e.message}`); }
        });
      });
    } catch (err) {
      staffRequestsContainer.innerHTML = `<p style="color: var(--muted); font-size: 0.88rem;">No requests currently available.</p>`;
    }
  }

  // Super Admin Event Listeners
  if (superAdminHospSelect) {
    superAdminHospSelect.addEventListener('change', () => {
      currentSuperAdminHospId = superAdminHospSelect.value;
      const selectedOpt = superAdminHospSelect.options[superAdminHospSelect.selectedIndex];
      staffHospName.textContent = selectedOpt ? selectedOpt.textContent.split(' (')[0] : 'Selected Hospital';
      loadHospitalBedsAndRequests(currentSuperAdminHospId);
    });
  }

  if (createHospitalAdminForm) {
    createHospitalAdminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newAdminName.value.trim();
      const email = newAdminEmail.value.trim();
      const password = newAdminPassword.value;
      const hospitalId = newAdminHospital.value;

      if (!name || !email || !password || !hospitalId) {
        showToast('Please fill in all required fields.');
        return;
      }

      createAdminSubmitBtn.disabled = true;
      createAdminSubmitBtn.textContent = '⏳ Creating...';

      try {
        const res = await apiRequest('/admin/staff', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, hospitalId }),
        });

        showToast(res.message || '✅ Hospital administrator created successfully.');
        createHospitalAdminForm.reset();
        await loadStaffAdminsList();
      } catch (err) {
        showToast(`❌ ${err.message}`);
      } finally {
        createAdminSubmitBtn.disabled = false;
        createAdminSubmitBtn.textContent = 'CREATE HOSPITAL ADMIN';
      }
    });
  }

  /* -----------------------------------------------------
     12.1 STAFF INACTIVITY SESSION TIMEOUT (15 MINUTES)
     ----------------------------------------------------- */
  const STAFF_SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  let staffInactivityTimer = null;

  function updateStaffLastActivity() {
    const now = Date.now();
    localStorage.setItem('medbed_staff_last_active', String(now));
  }

  function getStaffLastActivity() {
    const val = localStorage.getItem('medbed_staff_last_active');
    return val ? parseInt(val, 10) : 0;
  }

  function resetStaffInactivityTimer() {
    if (staffInactivityTimer) {
      clearTimeout(staffInactivityTimer);
      staffInactivityTimer = null;
    }

    if (!authToken) {
      return;
    }

    updateStaffLastActivity();

    staffInactivityTimer = setTimeout(() => {
      checkStaffSessionTimeout();
    }, STAFF_SESSION_TIMEOUT_MS);
  }

  function checkStaffSessionTimeout() {
    if (!authToken) return false;

    const lastActive = getStaffLastActivity();
    const elapsed = Date.now() - lastActive;

    if (elapsed >= STAFF_SESSION_TIMEOUT_MS) {
      handleStaffInactivityLogout();
      return true;
    } else {
      const remaining = STAFF_SESSION_TIMEOUT_MS - elapsed;
      if (staffInactivityTimer) clearTimeout(staffInactivityTimer);
      staffInactivityTimer = setTimeout(() => {
        checkStaffSessionTimeout();
      }, remaining);
      return false;
    }
  }

  function handleStaffInactivityLogout() {
    if (staffInactivityTimer) {
      clearTimeout(staffInactivityTimer);
      staffInactivityTimer = null;
    }

    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});

    authToken = '';
    csrfToken = '';
    currentUser = null;
    localStorage.removeItem('medbed_staff_last_active');

    // Ensure staff login form is rendered
    renderStaffLoginForm();

    // Show exact required expiration notification
    showToast('Your session expired due to inactivity. Please log in again.', 5000);
  }

  // Register user interaction listeners to keep active session alive
  const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  ACTIVITY_EVENTS.forEach(evt => {
    window.addEventListener(evt, () => {
      if (authToken) {
        const lastActive = getStaffLastActivity();
        // Throttle updates to at most once every 3 seconds to avoid unnecessary overhead
        if (Date.now() - lastActive > 3000) {
          resetStaffInactivityTimer();
        }
      }
    }, { passive: true });
  });

  // Staff Login Submission
  staffLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hospitalId = staffHospitalSelect ? staffHospitalSelect.value : '';
    const email = document.getElementById('staffEmail').value.trim();
    const password = document.getElementById('staffPassword').value;

    staffLoginSubmitBtn.disabled = true;
    staffLoginSubmitBtn.textContent = '⏳ Logging in...';

    try {
      const payload = { email, password };
      if (hospitalId) {
        payload.hospitalId = hospitalId;
      }

      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      authToken = res.data.token;
      csrfToken = res.data.csrfToken || '';
      currentUser = res.data.user;
      resetStaffInactivityTimer();

      showToast(`👋 Welcome, ${currentUser.name}!`);
      renderStaffDashboard();
    } catch (err) {
      showToast(`❌ Login failed: ${err.message}`);
    } finally {
      staffLoginSubmitBtn.disabled = false;
      staffLoginSubmitBtn.textContent = 'LOG IN';
    }
  });

  staffLogoutBtn.addEventListener('click', async () => {
    if (staffInactivityTimer) {
      clearTimeout(staffInactivityTimer);
      staffInactivityTimer = null;
    }
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    }
    authToken = '';
    csrfToken = '';
    currentUser = null;
    localStorage.removeItem('medbed_staff_last_active');
    showToast('Logged out of Staff Portal.');
    renderStaffLoginForm();
  });

  // Demo Prefill Buttons
  if (prefillApolloBtn) {
    prefillApolloBtn.addEventListener('click', () => {
      document.getElementById('staffEmail').value = 'admin@apollo.wb.gov.in';
      document.getElementById('staffPassword').value = 'Password123!';
      if (staffHospitalSelect) {
        const apolloOpt = Array.from(staffHospitalSelect.options).find(o => o.text.toLowerCase().includes('apollo'));
        if (apolloOpt) {
          staffHospitalSelect.value = apolloOpt.value;
        }
      }
    });
  }
  if (prefillSuperBtn) {
    prefillSuperBtn.addEventListener('click', () => {
      document.getElementById('staffEmail').value = 'superadmin@demo.wb.gov.in';
      document.getElementById('staffPassword').value = 'SuperAdmin123!';
      if (staffHospitalSelect) {
        staffHospitalSelect.value = '';
      }
    });
  }

  if (navStaffPortalBtn) navStaffPortalBtn.addEventListener('click', (e) => { e.preventDefault(); openStaffPortalModal(); });
  if (mobileStaffPortalBtn) mobileStaffPortalBtn.addEventListener('click', (e) => { e.preventDefault(); openStaffPortalModal(); });
  staffModalCloseBtn.addEventListener('click', closeStaffPortalModal);
  staffLoginCloseBtn.addEventListener('click', closeStaffPortalModal);
  staffPortalModalOverlay.addEventListener('click', (e) => {
    if (e.target === staffPortalModalOverlay) closeStaffPortalModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!requestBedModalOverlay.hidden) closeBedRequestModal();
      if (!staffPortalModalOverlay.hidden) closeStaffPortalModal();
      if (!modalOverlay.hidden) closeModal();
    }
  });

  /* -----------------------------------------------------
     13. MOBILE NAVIGATION
     ----------------------------------------------------- */
  hamburgerBtn.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
    hamburgerBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
  }));

  /* -----------------------------------------------------
     14. DYNAMIC STATISTICS & COUNTERS
     ----------------------------------------------------- */
  function updateStatistics() {
    const districtsCovered = new Set(hospitals.map(h => h.district)).size;
    const totalHospitals = hospitals.length;
    const totalBeds = hospitals.reduce((sum, h) => sum + (h.generalBeds || 0) + (h.icuBeds || 0) + (h.oxygenBeds || 0), 0);
    const totalIcu = hospitals.reduce((sum, h) => sum + (h.icuBeds || 0), 0);
    const availableCount = hospitals.filter(h => h.status === 'available').length;
    const fullCount = hospitals.filter(h => h.status === 'full').length;

    setStat('statDistricts', districtsCovered);
    setStat('statHospitals', totalHospitals);
    setStat('statBeds', totalBeds);
    setStat('statIcu', totalIcu);
    setStat('statAvailable', availableCount);
    setStat('statFull', fullCount);

    setStat('dashDistricts', districtsCovered);
    setStat('dashHospitals', totalHospitals);
    setStat('dashBeds', totalBeds);
    setStat('dashIcu', totalIcu);
  }

  function setStat(elId, value) {
    const el = document.getElementById(elId);
    if (el) el.dataset.countTarget = value;
  }

  function animateCounter(el) {
    const target = Number(el.dataset.countTarget || el.dataset.count || 0);
    const duration = 1000;
    const start = performance.now();
    if (el._rafId) cancelAnimationFrame(el._rafId);

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        el._rafId = requestAnimationFrame(tick);
      } else {
        el.textContent = target;
        el._rafId = null;
      }
    }
    el._rafId = requestAnimationFrame(tick);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  function observeCounters() {
    document.querySelectorAll('.stat-num, .dash-num').forEach(el => counterObserver.observe(el));
  }

  function initScrollReveal() {
    const revealTargets = document.querySelectorAll(
      '.stat-card, .step-card, .future-card, .legend-item, .emergency-card, .district-chip'
    );
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealTargets.forEach(el => { el.classList.add('reveal'); revealObserver.observe(el); });
  }

  /* -----------------------------------------------------
     15. GEOLOCATION — "USE MY LOCATION"
     ----------------------------------------------------- */
  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      showToast('Location permission was not granted. Please select a district manually.');
      return;
    }

    useLocationBtn.disabled = true;
    const originalLabel = useLocationBtn.innerHTML;
    useLocationBtn.innerHTML = '<span aria-hidden="true">⏳</span> Locating…';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        hospitals.forEach(h => {
          h.distance = calculateDistance(latitude, longitude, h.latitude, h.longitude);
        });

        renderHospitals(filterHospitals());
        showToast('Your location detected. Hospitals sorted by proximity.');
        document.getElementById('find-beds').scrollIntoView({ behavior: 'smooth' });

        useLocationBtn.disabled = false;
        useLocationBtn.innerHTML = originalLabel;
      },
      () => {
        showToast('Location permission was not granted. Please select a district manually.');
        useLocationBtn.disabled = false;
        useLocationBtn.innerHTML = originalLabel;
      },
      { timeout: 8000 }
    );
  }

  useLocationBtn.addEventListener('click', useMyLocation);

  /* -----------------------------------------------------
     16. LEAFLET MAP WITH DYNAMIC LIVE MARKERS
     ----------------------------------------------------- */
  function initMap() {
    const mapEl = document.getElementById('hospitalMap');
    const fallback = document.getElementById('mapFallback');
    if (!mapEl || typeof L === 'undefined') {
      if (fallback) fallback.hidden = false;
      if (mapEl) mapEl.style.display = 'none';
      return;
    }

    leafletMap = L.map(mapEl, { scrollWheelZoom: false }).setView([23.6, 87.8], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);

    markerLayerGroup = L.layerGroup().addTo(leafletMap);
    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!leafletMap || !markerLayerGroup) return;
    markerLayerGroup.clearLayers();

    const statusColor = { available: '#16A34A', limited: '#F59E0B', full: '#DC2626' };

    hospitals.forEach(h => {
      const marker = L.circleMarker([h.latitude, h.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: statusColor[h.status] || '#16A34A',
        fillOpacity: 0.95
      }).addTo(markerLayerGroup);

      const totalBeds = (h.generalBeds || 0) + (h.icuBeds || 0) + (h.oxygenBeds || 0);
      const targetId = h._id || h.id;
      const popupHtml = `
        <div class="map-popup-title">${escapeHtml(h.name)}</div>
        <div class="map-popup-line">${escapeHtml(h.district)} · ${totalBeds} live beds</div>
        <div class="map-popup-line">${STATUS_LABEL[h.status] || '🟢 AVAILABLE'}</div>
        <a href="#" class="map-popup-link" data-id="${targetId}">View Details →</a>
      `;
      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const link = document.querySelector(`.leaflet-popup-content a[data-id="${targetId}"]`);
        if (link && !link._hasClickListener) {
          link._hasClickListener = true;
          link.addEventListener('click', (e) => {
            e.preventDefault();
            showHospitalDetails(targetId);
          });
        }
      });
    });
  }

  /* -----------------------------------------------------
     17. SOCKET.IO REAL-TIME SYNCHRONIZATION
     ----------------------------------------------------- */
  function initSocket() {
    if (typeof io === 'undefined') return;
    try {
      const socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('⚡ Connected to real-time bed tracker network');
      });

      socket.on('bedAvailabilityUpdated', (data) => {
        const target = hospitals.find(x => x._id === data.hospitalId || x.id == data.hospitalId);
        if (target) {
          if (data.bedType === 'general') target.generalBeds = data.availableBeds;
          if (data.bedType === 'icu') target.icuBeds = data.availableBeds;
          if (data.bedType === 'oxygen') target.oxygenBeds = data.availableBeds;
          if (data.bedType === 'ventilator') target.ventilators = data.availableBeds;
          target.lastUpdated = 'Just now';

          renderHospitals(filterHospitals());
          updateStatistics();
          updateMapMarkers();

          // Update open hospital modal if viewing this hospital
          if (activeHospital && (activeHospital._id === data.hospitalId || activeHospital.id == data.hospitalId)) {
            showHospitalDetails(data.hospitalId);
          }

          showToast(`⚡ Live capacity update: ${target.name} bed inventory updated.`);
        }
      });
    } catch (err) {
      console.warn('Socket connection note:', err.message);
    }
  }

  /* -----------------------------------------------------
     18. INITIAL SETUP
     ----------------------------------------------------- */
  function init() {
    populateDistrictDropdown();
    populateCityDropdown('all');
    renderDistrictExplorer();
    updateStatistics();
    renderHospitals(hospitals.slice().sort((a, b) => (a.distance || 0) - (b.distance || 0)));

    observeCounters();
    initScrollReveal();

    try {
      initMap();
    } catch (err) {
      const mapEl = document.getElementById('hospitalMap');
      const fallback = document.getElementById('mapFallback');
      if (mapEl) mapEl.style.display = 'none';
      if (fallback) fallback.hidden = false;
      console.error('Map initialization failed:', err);
    }

    // Connect to backend APIs and Socket.IO
    fetchHospitalsFromBackend();
    fetchStatisticsFromBackend();
    initSocket();

    // Restore authenticated session via silent refresh if cookie exists
    silentRefresh().then(success => {
      if (success && authToken) {
        if (checkStaffSessionTimeout()) {
          authToken = '';
          csrfToken = '';
          currentUser = null;
          localStorage.removeItem('medbed_staff_last_active');
        } else {
          resetStaffInactivityTimer();
        }
      }
    }).catch(() => {});

    // Initialize Emergency Patient Intake feature
    initEmergencyIntake();
  }

  /* -----------------------------------------------------
     19. EMERGENCY PATIENT INTAKE & PRIORITIZATION
     ----------------------------------------------------- */
  function initEmergencyIntake() {
    const intakeForm = document.getElementById('patientIntakeForm');
    if (!intakeForm) return;

    const intakeDistrict = document.getElementById('intakeDistrict');
    const priorityIndicatorCard = document.getElementById('priorityIndicatorCard');
    const priorityPill = document.getElementById('priorityPill');
    const conditionRadios = document.querySelectorAll('input[name="patientCondition"]');
    const intakeSubmitBtn = document.getElementById('intakeSubmitBtn');
    const intakeResetBtn = document.getElementById('intakeResetBtn');
    const intakeLoadingBox = document.getElementById('intakeLoadingBox');
    const intakeAlertBox = document.getElementById('intakeAlertBox');
    const intakeResultsContainer = document.getElementById('intakeResultsContainer');
    const intakeHospitalGrid = document.getElementById('intakeHospitalGrid');
    const intakeEmptyState = document.getElementById('intakeEmptyState');
    const successPriorityText = document.getElementById('successPriorityText');

    // 1. Populate West Bengal Districts dropdown
    if (intakeDistrict && intakeDistrict.options.length <= 1) {
      DISTRICTS.forEach(district => {
        const opt = document.createElement('option');
        opt.value = district;
        opt.textContent = district;
        intakeDistrict.appendChild(opt);
      });
    }

    // 2. Dynamic Application Priority indicator mapping
    const CONDITION_PRIORITY_CONFIG = {
      'Very Serious / Critical': {
        label: '🚨 Immediate attention',
        pillClass: 'pill-immediate',
        cardClass: 'priority-immediate',
      },
      'Serious': {
        label: '⚠️ Urgent attention',
        pillClass: 'pill-urgent',
        cardClass: 'priority-urgent',
      },
      'Moderate': {
        label: '🟡 Prompt assessment',
        pillClass: 'pill-prompt',
        cardClass: 'priority-prompt',
      },
      'Stable': {
        label: '🟢 Emergency assessment',
        pillClass: 'pill-emergency',
        cardClass: 'priority-emergency',
      },
      'Unknown': {
        label: '⚪ Professional assessment required',
        pillClass: 'pill-unknown',
        cardClass: '',
      },
    };

    function updatePriorityIndicator(condition) {
      if (!priorityPill || !priorityIndicatorCard) return;
      const config = CONDITION_PRIORITY_CONFIG[condition] || {
        label: 'Select condition above',
        pillClass: '',
        cardClass: '',
      };

      priorityPill.textContent = config.label;
      priorityPill.className = `pic-priority-pill ${config.pillClass}`;
      priorityIndicatorCard.className = `priority-indicator-card form-col-span-2 ${config.cardClass}`;
    }

    conditionRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          updatePriorityIndicator(radio.value);
          const errEl = document.getElementById('errCondition');
          if (errEl) errEl.hidden = true;
        }
      });
    });

    // 3. Clear errors on input
    const inputIds = [
      { id: 'intakePatientName', err: 'errPatientName' },
      { id: 'intakeAge', err: 'errAge' },
      { id: 'intakeSex', err: 'errSex' },
      { id: 'intakeContact', err: 'errContact' },
      { id: 'intakeDistrict', err: 'errDistrict' },
      { id: 'intakeEmergencyType', err: 'errEmergencyType' },
      { id: 'intakeSymptoms', err: 'errSymptoms' },
    ];

    inputIds.forEach(({ id, err }) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          const errEl = document.getElementById(err);
          if (errEl) errEl.hidden = true;
          el.classList.remove('is-invalid');
          if (intakeAlertBox) intakeAlertBox.hidden = true;
        });
      }
    });

    // 4. Client-side Form Validation
    function validateForm(formData) {
      let isValid = true;
      let firstInvalidEl = null;

      function setError(errId, msg, inputEl) {
        const errEl = document.getElementById(errId);
        if (errEl) {
          errEl.textContent = msg;
          errEl.hidden = false;
        }
        if (inputEl) inputEl.classList.add('is-invalid');
        if (!firstInvalidEl && inputEl) firstInvalidEl = inputEl;
        isValid = false;
      }

      // Hide all previous error messages
      document.querySelectorAll('.field-error-msg').forEach(el => (el.hidden = true));

      if (!formData.patientName || formData.patientName.trim().length < 2) {
        setError('errPatientName', 'Please enter patient full name (minimum 2 characters)', document.getElementById('intakePatientName'));
      }

      const ageNum = parseInt(formData.age, 10);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
        setError('errAge', 'Please enter a valid age between 0 and 120', document.getElementById('intakeAge'));
      }

      if (!formData.sex) {
        setError('errSex', 'Please select the patient sex', document.getElementById('intakeSex'));
      }

      const phoneRegex = /^[6-9]\d{9}$/;
      if (!formData.contactNumber || !phoneRegex.test(formData.contactNumber.trim())) {
        setError('errContact', 'Please enter a valid 10-digit Indian mobile number (e.g. 9830123456)', document.getElementById('intakeContact'));
      }

      if (!formData.district) {
        setError('errDistrict', 'Please select the patient’s West Bengal district for matching', document.getElementById('intakeDistrict'));
      }

      if (!formData.emergencyType) {
        setError('errEmergencyType', 'Please select an emergency type', document.getElementById('intakeEmergencyType'));
      }

      if (!formData.condition) {
        setError('errCondition', 'Please select the patient’s condition', document.getElementById('cardConditionCritical'));
      }

      if (!formData.symptoms || formData.symptoms.trim().length < 5) {
        setError('errSymptoms', 'Please describe the emergency symptoms in detail (at least 5 characters)', document.getElementById('intakeSymptoms'));
      }

      if (firstInvalidEl) {
        firstInvalidEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof firstInvalidEl.focus === 'function') firstInvalidEl.focus();
      }

      return isValid;
    }

    // 5. Render Recommended Hospital Card with match badges
    function renderRecommendedCard(h) {
      const isFull = h.generalBeds === 0 && h.icuBeds === 0 && h.oxygenBeds === 0;
      const statusLabel = isFull ? "🔴 CURRENTLY FULL" : STATUS_LABEL[h.status] || "🟢 AVAILABLE";
      const totalBeds = (h.generalBeds || 0) + (h.icuBeds || 0) + (h.oxygenBeds || 0);
      const capacityPct = Math.min(100, Math.round((totalBeds / MAX_CAPACITY_REFERENCE) * 100));
      const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ', ' + (h.address || h.area))}`;
      const targetId = h._id || h.id;

      const matchChips = (h.matchReasons || [])
        .slice(0, 3)
        .map(reason => `<span class="hc-match-chip">✓ ${escapeHtml(reason)}</span>`)
        .join('');

      return `
        <article class="hospital-card" data-id="${targetId}" tabindex="0" aria-label="${escapeHtml(h.name)}">
          <div class="hc-top">
            <div class="hc-title-row">
              <span class="hc-icon" aria-hidden="true">🏥</span>
              <div>
                <h3 class="hc-name">${escapeHtml(h.name)}</h3>
                ${h.verified || h.isVerified
                  ? '<p class="hc-verified">✓ Verified emergency care</p>'
                  : '<p class="hc-demo-tag">⚠ Demo Hospital Record</p>'}
              </div>
            </div>
            <span class="status-badge ${h.status}">${statusLabel}</span>
          </div>

          ${matchChips ? `
            <div class="hc-match-badge" title="Clinical & location match criteria">
              <span>🎯 Prioritized Match:</span>
            </div>
            <div class="hc-match-reasons">${matchChips}</div>
          ` : ''}

          <div class="hc-meta" style="margin-top: 10px;">
            <span>📍 ${escapeHtml(h.district)}</span>
            <span>📍 ${escapeHtml(h.area)}</span>
            <span>${typeof h.distance === 'number' ? h.distance.toFixed(1) : '3.5'} km away</span>
          </div>

          <div class="hc-beds">
            <div class="hc-bed-stat">
              <span class="${bedNumClass(h.generalBeds || 0)}">${h.generalBeds || 0}</span>
              <span class="hc-bed-label">General</span>
            </div>
            <div class="hc-bed-stat">
              <span class="${bedNumClass(h.icuBeds || 0)}">${h.icuBeds || 0}</span>
              <span class="hc-bed-label">ICU</span>
            </div>
            <div class="hc-bed-stat">
              <span class="${bedNumClass(h.oxygenBeds || 0)}">${h.oxygenBeds || 0}</span>
              <span class="hc-bed-label">Oxygen</span>
            </div>
            <div class="hc-bed-stat">
              <span class="${bedNumClass(h.ventilators || 0)}">${h.ventilators || 0}</span>
              <span class="hc-bed-label">Vent.</span>
            </div>
          </div>

          <div class="hc-capacity">
            <span class="hc-capacity-label"><span>Emergency capacity (live)</span><span>${capacityPct}%</span></span>
            <div class="hc-capacity-track">
              <div class="${capacityFillClass(h.status)}" style="width:${capacityPct}%"></div>
            </div>
          </div>

          <p class="hc-updated">Last update: ${escapeHtml(h.lastUpdated || 'Recently')}</p>
          <p class="hc-demo-note">📞 Emergency Phone: ${escapeHtml(h.phone || 'Available in details')}</p>

          <div class="hc-actions">
            <button class="btn btn-primary btn-sm view-details-btn" data-id="${targetId}">VIEW DETAILS</button>
            <button class="btn btn-emergency btn-sm card-req-btn" data-id="${targetId}">🛏️ BOOK</button>
            <a href="${directionsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🗺️ DIRECTIONS</a>
          </div>
        </article>
      `;
    }

    // 6. Client-side matching fallback if backend is momentarily offline
    function clientSidePrioritizeHospitals(intakeData) {
      return hospitals.slice().map(h => {
        let score = 0;
        const reasons = [];

        // District match
        if (intakeData.district && h.district.toLowerCase() === intakeData.district.toLowerCase()) {
          score += 50;
          reasons.push(`Located in ${h.district}`);
        }
        if (intakeData.area && h.area.toLowerCase().includes(intakeData.area.toLowerCase())) {
          score += 25;
          reasons.push(`Near ${h.area}`);
        }

        // Emergency type scoring
        const facilities = h.facilities || [];
        if (facilities.includes('Emergency Department')) {
          score += 20;
          reasons.push('24/7 Emergency Department');
        }

        if (intakeData.emergencyType === 'Cardiac Emergency') {
          if (h.icuBeds > 0) { score += 40; reasons.push(`ICU Beds available (${h.icuBeds})`); }
          if (facilities.includes('Diagnostic Services')) score += 15;
        } else if (intakeData.emergencyType === 'Breathing Problem') {
          if (h.oxygenBeds > 0) { score += 35; reasons.push(`Oxygen Support available (${h.oxygenBeds})`); }
          if (h.ventilators > 0) { score += 30; reasons.push(`Ventilators available (${h.ventilators})`); }
        } else if (['Accident / Trauma', 'Severe Bleeding'].includes(intakeData.emergencyType)) {
          if (h.generalBeds > 0) score += 20;
          if (h.icuBeds > 0) { score += 25; reasons.push(`ICU backup (${h.icuBeds} beds)`); }
          if (facilities.includes('Ambulance Support')) { score += 20; reasons.push('Ambulance Support'); }
        } else {
          if (h.generalBeds > 0) score += 20;
        }

        // Condition severity
        if (intakeData.condition === 'Very Serious / Critical') {
          if (h.icuBeds > 0) score += 35;
          else score -= 20;
        }

        // Availability status
        if (h.status === 'available') { score += 30; reasons.push('Beds available'); }
        else if (h.status === 'limited') score += 15;
        else if (h.status === 'full') score -= 35;

        return {
          ...h,
          score,
          matchReasons: [...new Set(reasons)],
        };
      }).sort((a, b) => b.score - a.score).slice(0, 10);
    }

    // 7. Form submission handler
    intakeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const selectedConditionEl = document.querySelector('input[name="patientCondition"]:checked');
      const selectedAmbulanceEl = document.querySelector('input[name="intakeAmbulance"]:checked');

      const rawContact = document.getElementById('intakeContact').value.trim();
      const cleanContact = rawContact.replace(/[\s\-\(\)]/g, '').replace(/^(\+91|0)/, '');

      const formData = {
        patientName: document.getElementById('intakePatientName').value.trim(),
        age: document.getElementById('intakeAge').value.trim(),
        sex: document.getElementById('intakeSex').value,
        contactNumber: cleanContact,
        attendantName: document.getElementById('intakeAttendant').value.trim(),
        district: document.getElementById('intakeDistrict').value,
        area: document.getElementById('intakeArea').value.trim(),
        ambulanceRequired: selectedAmbulanceEl ? selectedAmbulanceEl.value : 'Not Sure',
        emergencyType: document.getElementById('intakeEmergencyType').value,
        condition: selectedConditionEl ? selectedConditionEl.value : '',
        symptoms: document.getElementById('intakeSymptoms').value.trim(),
        additionalInformation: document.getElementById('intakeAdditional').value.trim(),
      };

      if (!validateForm(formData)) {
        return;
      }

      // UI state during processing
      intakeSubmitBtn.disabled = true;
      intakeSubmitBtn.textContent = '⏳ Saving Patient Intake to Database...';
      if (intakeLoadingBox) intakeLoadingBox.hidden = false;
      if (intakeAlertBox) intakeAlertBox.hidden = true;

      try {
        // Send request to real backend and AWAIT real MongoDB save
        const result = await apiRequest('/emergency/intake', {
          method: 'POST',
          body: JSON.stringify(formData),
        });

        if (!result.success || !result.data) {
          throw new Error(result.message || 'Failed to save emergency patient intake');
        }

        const intakeId = result.data.intakeId;
        const recommendedHospitals = result.data.recommendedHospitals || [];
        const applicationPriority = result.data.applicationPriority || 'Emergency assessment';

        // Render recommended hospitals into the single unified hospital list
        if (recommendedHospitals && recommendedHospitals.length > 0) {
          renderHospitals(recommendedHospitals);

          // Update priority notification banner in the hospital results section
          const intakePriorityBanner = document.getElementById('intakePriorityBanner');
          const intakePriorityBannerText = document.getElementById('intakePriorityBannerText');
          const hospitalsEyebrow = document.getElementById('hospitalsEyebrow');
          const hospitalsHeading = document.getElementById('hospitals-heading');

          if (intakePriorityBanner && intakePriorityBannerText) {
            intakePriorityBanner.hidden = false;
            intakePriorityBannerText.innerHTML = `Prioritized for <strong>${escapeHtml(formData.emergencyType)}</strong> with Application Priority: <strong>${escapeHtml(applicationPriority)}</strong>. Hospitals are ranked based on emergency capability, bed availability, and district proximity.`;
          }
          if (hospitalsEyebrow) hospitalsEyebrow.textContent = 'RECOMMENDED EMERGENCY CARE';
          if (hospitalsHeading) hospitalsHeading.textContent = 'Nearby / Suitable Hospitals';

          // Sync search controls with patient's location
          if (formData.district && filterDistrict) {
            filterDistrict.value = formData.district;
            populateCityDropdown(formData.district);
            syncDistrictChips(formData.district);
          }

          // Smoothly scroll down to Hospital Results
          const hospitalsSection = document.getElementById('hospitals');
          if (hospitalsSection) {
            hospitalsSection.scrollIntoView({ behavior: 'smooth' });
          }

          showToast(`✅ Patient intake saved to MongoDB! (ID: ${intakeId ? String(intakeId).slice(-6) : 'Confirmed'})`);
        } else {
          renderHospitals([]);
          const hospitalsSection = document.getElementById('hospitals');
          if (hospitalsSection) {
            hospitalsSection.scrollIntoView({ behavior: 'smooth' });
          }
          showToast(`✅ Patient intake saved to MongoDB (ID: ${intakeId ? String(intakeId).slice(-6) : 'Confirmed'}). No hospitals currently match.`);
        }
      } catch (err) {
        console.error('Intake submission error:', err);
        const errorMsg = err.message || 'Unable to save emergency intake to database. Please check connection or call 112.';
        if (intakeAlertBox) {
          intakeAlertBox.textContent = `❌ Database save failed: ${errorMsg}`;
          intakeAlertBox.hidden = false;
        }
        showToast(`❌ Intake save failed: ${errorMsg}`);
      } finally {
        intakeSubmitBtn.disabled = false;
        intakeSubmitBtn.textContent = '🚨 FIND SUITABLE HOSPITALS';
        if (intakeLoadingBox) intakeLoadingBox.hidden = true;
      }
    });

    // 8. Form reset handler
    if (intakeResetBtn) {
      intakeResetBtn.addEventListener('click', () => {
        intakeForm.reset();
        updatePriorityIndicator('');
        document.querySelectorAll('.field-error-msg').forEach(el => (el.hidden = true));
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        if (intakeAlertBox) intakeAlertBox.hidden = true;

        const intakePriorityBanner = document.getElementById('intakePriorityBanner');
        if (intakePriorityBanner) intakePriorityBanner.hidden = true;

        const hospitalsEyebrow = document.getElementById('hospitalsEyebrow');
        if (hospitalsEyebrow) hospitalsEyebrow.textContent = 'Results';

        const hospitalsHeading = document.getElementById('hospitals-heading');
        if (hospitalsHeading) hospitalsHeading.textContent = 'Hospital Availability & Emergency Care';

        renderHospitals(hospitals.slice().sort((a, b) => (a.distance || 0) - (b.distance || 0)));
        showToast('Intake form cleared. All hospitals restored.');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  /* =====================================================
     14. HOSPITAL-TO-HOSPITAL EMERGENCY REFERRAL SYSTEM
     ===================================================== */
  let activeReferralsList = [];
  let currentDetailReferralId = null;
  let cachedStaffRequests = [];

  // Tab navigation elements
  const tabBtnRequests = document.getElementById('tabBtnRequests');
  const tabBtnIncomingRef = document.getElementById('tabBtnIncomingRef');
  const tabBtnOutgoingRef = document.getElementById('tabBtnOutgoingRef');
  const tabPaneRequests = document.getElementById('tabPaneRequests');
  const tabPaneIncomingRef = document.getElementById('tabPaneIncomingRef');
  const tabPaneOutgoingRef = document.getElementById('tabPaneOutgoingRef');
  const incomingReferralsContainer = document.getElementById('incomingReferralsContainer');
  const outgoingReferralsContainer = document.getElementById('outgoingReferralsContainer');

  // Referral creation modal elements
  const referralModalOverlay = document.getElementById('referralModalOverlay');
  const referralModalCloseBtn = document.getElementById('referralModalCloseBtn');
  const referralModalCancelBtn = document.getElementById('referralModalCancelBtn');
  const createReferralForm = document.getElementById('createReferralForm');
  const referralHospBadge = document.getElementById('referralHospBadge');

  const refBedRequestId = document.getElementById('refBedRequestId');
  const refIntakeId = document.getElementById('refIntakeId');
  const refPatientName = document.getElementById('refPatientName');
  const refPatientAge = document.getElementById('refPatientAge');
  const refPatientSex = document.getElementById('refPatientSex');
  const refEmergencyType = document.getElementById('refEmergencyType');
  const refContactPhone = document.getElementById('refContactPhone');

  const refCurrentProblem = document.getElementById('refCurrentProblem');
  const refSymptoms = document.getElementById('refSymptoms');
  const refDiagnosis = document.getElementById('refDiagnosis');
  const refTreatmentGiven = document.getElementById('refTreatmentGiven');
  const refMedicationsGiven = document.getElementById('refMedicationsGiven');
  const refProceduresPerformed = document.getElementById('refProceduresPerformed');
  const refCondition = document.getElementById('refCondition');
  const refVitals = document.getElementById('refVitals');
  const refReason = document.getElementById('refReason');
  const refNotes = document.getElementById('refNotes');

  const refDestHospitalSelect = document.getElementById('refDestHospitalSelect');
  const refDestDoctorSelect = document.getElementById('refDestDoctorSelect');
  const referralReadinessBox = document.getElementById('referralReadinessBox');
  const readinessStatusBadge = document.getElementById('readinessStatusBadge');
  const readinessCheckItems = document.getElementById('readinessCheckItems');
  const referralConfirmationBox = document.getElementById('referralConfirmationBox');
  const confirmationSummaryText = document.getElementById('confirmationSummaryText');
  const referralModalSubmitBtn = document.getElementById('referralModalSubmitBtn');

  // Referral detail & prompt modal elements
  const referralDetailModalOverlay = document.getElementById('referralDetailModalOverlay');
  const refDetailCloseBtn = document.getElementById('refDetailCloseBtn');
  const refDetailBody = document.getElementById('refDetailBody');
  const refDetailActions = document.getElementById('refDetailActions');
  const refDetailStatusBadge = document.getElementById('refDetailStatusBadge');

  const referralRejectModalOverlay = document.getElementById('referralRejectModalOverlay');
  const rejectReasonInput = document.getElementById('rejectReasonInput');
  const rejectCancelBtn = document.getElementById('rejectCancelBtn');
  const rejectConfirmBtn = document.getElementById('rejectConfirmBtn');

  const referralMoreInfoModalOverlay = document.getElementById('referralMoreInfoModalOverlay');
  const moreInfoInput = document.getElementById('moreInfoInput');
  const moreInfoCancelBtn = document.getElementById('moreInfoCancelBtn');
  const moreInfoConfirmBtn = document.getElementById('moreInfoConfirmBtn');

  // 1. Tab switching
  const tabBtnBloodRequests = document.getElementById('tabBtnBloodRequests');
  const tabBtnBloodInventory = document.getElementById('tabBtnBloodInventory');
  const tabPaneBloodRequests = document.getElementById('tabPaneBloodRequests');
  const tabPaneBloodInventory = document.getElementById('tabPaneBloodInventory');

  function switchStaffTab(tabName) {
    [tabBtnRequests, tabBtnBloodRequests, tabBtnBloodInventory, tabBtnIncomingRef, tabBtnOutgoingRef].forEach(b => {
      if (b) {
        b.classList.remove('active');
        b.style.color = 'var(--muted)';
        b.style.borderBottom = 'none';
        b.style.fontWeight = '600';
      }
    });

    if (tabPaneRequests) tabPaneRequests.hidden = true;
    if (tabPaneBloodRequests) tabPaneBloodRequests.hidden = true;
    if (tabPaneBloodInventory) tabPaneBloodInventory.hidden = true;
    if (tabPaneIncomingRef) tabPaneIncomingRef.hidden = true;
    if (tabPaneOutgoingRef) tabPaneOutgoingRef.hidden = true;

    if (tabName === 'requests') {
      if (tabBtnRequests) {
        tabBtnRequests.classList.add('active');
        tabBtnRequests.style.color = 'var(--primary)';
        tabBtnRequests.style.borderBottom = '3px solid var(--primary)';
        tabBtnRequests.style.fontWeight = '700';
      }
      if (tabPaneRequests) tabPaneRequests.hidden = false;
    } else if (tabName === 'blood-requests') {
      if (tabBtnBloodRequests) {
        tabBtnBloodRequests.classList.add('active');
        tabBtnBloodRequests.style.color = '#be123c';
        tabBtnBloodRequests.style.borderBottom = '3px solid #be123c';
        tabBtnBloodRequests.style.fontWeight = '700';
      }
      if (tabPaneBloodRequests) tabPaneBloodRequests.hidden = false;
      loadStaffBloodRequests();
    } else if (tabName === 'blood-inventory') {
      if (tabBtnBloodInventory) {
        tabBtnBloodInventory.classList.add('active');
        tabBtnBloodInventory.style.color = '#be123c';
        tabBtnBloodInventory.style.borderBottom = '3px solid #be123c';
        tabBtnBloodInventory.style.fontWeight = '700';
      }
      if (tabPaneBloodInventory) tabPaneBloodInventory.hidden = false;
      loadStaffBloodInventory();
    } else if (tabName === 'incoming') {
      if (tabBtnIncomingRef) {
        tabBtnIncomingRef.classList.add('active');
        tabBtnIncomingRef.style.color = 'var(--primary)';
        tabBtnIncomingRef.style.borderBottom = '3px solid var(--primary)';
        tabBtnIncomingRef.style.fontWeight = '700';
      }
      if (tabPaneIncomingRef) tabPaneIncomingRef.hidden = false;
      loadIncomingReferrals();
    } else if (tabName === 'outgoing') {
      if (tabBtnOutgoingRef) {
        tabBtnOutgoingRef.classList.add('active');
        tabBtnOutgoingRef.style.color = 'var(--primary)';
        tabBtnOutgoingRef.style.borderBottom = '3px solid var(--primary)';
        tabBtnOutgoingRef.style.fontWeight = '700';
      }
      if (tabPaneOutgoingRef) tabPaneOutgoingRef.hidden = false;
      loadOutgoingReferrals();
    }
  }

  if (tabBtnRequests) tabBtnRequests.addEventListener('click', () => switchStaffTab('requests'));
  if (tabBtnBloodRequests) tabBtnBloodRequests.addEventListener('click', () => switchStaffTab('blood-requests'));
  if (tabBtnBloodInventory) tabBtnBloodInventory.addEventListener('click', () => switchStaffTab('blood-inventory'));
  if (tabBtnIncomingRef) tabBtnIncomingRef.addEventListener('click', () => switchStaffTab('incoming'));
  if (tabBtnOutgoingRef) tabBtnOutgoingRef.addEventListener('click', () => switchStaffTab('outgoing'));

  // Filter chips for incoming referrals
  document.querySelectorAll('.ref-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ref-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadIncomingReferrals(chip.dataset.status);
    });
  });

  // 2. Open Referral Creation Modal
  function openReferralModal(request) {
    if (!referralModalOverlay) return;
    referralModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    // Populate user hospital badge
    const userHosp = currentUser?.hospital;
    const hospName = userHosp?.name || 'Authorized Referring Hospital';
    if (referralHospBadge) referralHospBadge.textContent = `🏥 ${hospName}`;

    // Pre-populate patient identity
    refBedRequestId.value = request?._id || '';
    refIntakeId.value = request?.emergencyIntake || '';
    refPatientName.value = request?.patientName || '';
    refPatientAge.value = request?.patientAge || 45;
    refPatientSex.value = request?.patientSex || 'Male';
    refEmergencyType.value = request?.emergencyType || (request?.bedType ? `${request.bedType.toUpperCase()} Emergency` : 'General Emergency');
    refContactPhone.value = request?.contactPhone || '';

    // Clear / set clinical handoff defaults
    refCurrentProblem.value = request?.notes || 'Acute emergency requiring immediate secondary/tertiary inter-hospital care.';
    refSymptoms.value = request?.notes || 'Acute symptoms requiring continuous medical oversight and advanced interventions.';
    refDiagnosis.value = request?.notes ? `Suspected ${request.emergencyType || 'Acute Emergency'} under evaluation` : (request?.emergencyType || 'Acute Emergency Condition under evaluation');
    refTreatmentGiven.value = 'Supplemental oxygen, IV access, and continuous vital monitoring initiated.';
    refMedicationsGiven.value = '';
    refProceduresPerformed.value = '';
    refCondition.value = 'Serious';
    refVitals.value = 'BP: 120/80 mmHg, Pulse: 84 bpm, SpO2: 96% on room air, Temp: 98.6°F, GCS: 15/15';
    refReason.value = 'Requires specialized destination facility capacity and tertiary intervention.';
    refNotes.value = '';

    // Clear special requirement checkboxes
    document.querySelectorAll('input[name="specialReq"]').forEach(cb => {
      cb.checked = (request?.bedType && cb.value.toLowerCase() === request.bedType.toLowerCase());
    });

    // Populate Destination Hospitals
    populateDestinationHospitals();

    // Reset confirmation box
    if (referralConfirmationBox) referralConfirmationBox.hidden = true;

    // Trigger initial readiness evaluation
    triggerReadinessCheck();
  }

  function closeReferralModal() {
    if (referralModalOverlay) referralModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  if (referralModalCloseBtn) referralModalCloseBtn.addEventListener('click', closeReferralModal);
  if (referralModalCancelBtn) referralModalCancelBtn.addEventListener('click', closeReferralModal);

  // Populate Destination Hospitals excluding user's hospital
  function populateDestinationHospitals() {
    if (!refDestHospitalSelect) return;
    const userHospId = currentUser?.hospital?._id || currentUser?.hospitalId || currentUser?.hospital;

    const eligibleHospitals = hospitals.filter(h => {
      const hId = h._id || h.id;
      return hId && String(hId) !== String(userHospId);
    });

    refDestHospitalSelect.innerHTML = '<option value="">Select Destination Hospital ▼</option>' +
      eligibleHospitals.map(h => `<option value="${h._id || h.id}">${escapeHtml(h.name)} (${escapeHtml(h.district)})` +
      `</option>`).join('');

    refDestDoctorSelect.innerHTML = '<option value="">Select Receiving Doctor ▼</option>';
  }

  // Destination hospital selection changed -> load doctors
  if (refDestHospitalSelect) {
    refDestHospitalSelect.addEventListener('change', async () => {
      const hospId = refDestHospitalSelect.value;
      refDestDoctorSelect.innerHTML = '<option value="">Loading receiving doctors...</option>';

      if (!hospId) {
        refDestDoctorSelect.innerHTML = '<option value="">Select Destination Hospital first</option>';
        triggerReadinessCheck();
        return;
      }

      try {
        const res = await apiRequest(`/referrals/doctors?hospitalId=${hospId}`);
        const doctors = res.data || [];

        if (!doctors.length) {
          refDestDoctorSelect.innerHTML = '<option value="">No doctors registered for this hospital</option>';
        } else {
          refDestDoctorSelect.innerHTML = '<option value="">Select Receiving Doctor ▼</option>' +
            doctors.map(d => `<option value="${d._id || d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialization || d.department || 'Emergency Care')})` +
            `</option>`).join('');
        }
      } catch (err) {
        refDestDoctorSelect.innerHTML = '<option value="">Error loading doctors</option>';
      }

      triggerReadinessCheck();
    });
  }

  if (refDestDoctorSelect) {
    refDestDoctorSelect.addEventListener('change', triggerReadinessCheck);
  }

  // Live readiness check triggers on inputs
  [
    refPatientName, refPatientAge, refPatientSex, refEmergencyType, refContactPhone,
    refCurrentProblem, refSymptoms, refDiagnosis, refTreatmentGiven, refMedicationsGiven,
    refProceduresPerformed, refCondition, refVitals, refReason, refNotes
  ].forEach(el => {
    if (el) {
      el.addEventListener('input', triggerReadinessCheck);
      el.addEventListener('change', triggerReadinessCheck);
    }
  });

  document.querySelectorAll('input[name="specialReq"]').forEach(cb => {
    cb.addEventListener('change', triggerReadinessCheck);
  });

  let currentReadinessResult = null;

  async function triggerReadinessCheck() {
    if (!readinessCheckItems) return;

    const specialReqs = Array.from(document.querySelectorAll('input[name="specialReq"]:checked')).map(cb => cb.value);

    const payload = {
      patientName: refPatientName?.value?.trim() || '',
      patientAge: parseInt(refPatientAge?.value, 10) || 0,
      patientSex: refPatientSex?.value || 'Male',
      currentProblem: refCurrentProblem?.value?.trim() || '',
      symptoms: refSymptoms?.value?.trim() || '',
      diagnosis: refDiagnosis?.value?.trim() || '',
      treatmentGiven: refTreatmentGiven?.value?.trim() || '',
      currentCondition: refCondition?.value || 'Serious',
      emergencyType: refEmergencyType?.value?.trim() || 'General Emergency',
      referralReason: refReason?.value?.trim() || '',
      vitalsObservations: refVitals?.value?.trim() || '',
      destinationHospitalId: refDestHospitalSelect?.value || '',
      receivingDoctorId: refDestDoctorSelect?.value || '',
      specialRequirements: specialReqs,
    };

    try {
      const res = await apiRequest('/referrals/readiness-check', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const r = res.data;
      currentReadinessResult = r;

      if (r.isReady) {
        readinessStatusBadge.textContent = '✅ READY TO SEND';
        readinessStatusBadge.className = 'status-badge available';
      } else {
        readinessStatusBadge.textContent = '⚠️ BLOCKS DETECTED';
        readinessStatusBadge.className = 'status-badge full';
      }

      let itemsHtml = '';
      // Patient completeness
      if (r.checkDetails.patientInfoComplete) {
        itemsHtml += '<div class="readiness-item pass">✅ Patient identity and clinical handoff complete</div>';
      } else {
        const patientBlocks = (r.blocks || [])
          .filter(b => {
            const f = typeof b === 'object' ? (b.field || '') : '';
            return f.startsWith('patientInfo') || f.startsWith('clinicalHandoff');
          })
          .map(b => formatErrorMessage(b));
        const extraInfo = patientBlocks.length ? ` (${patientBlocks.join('; ')})` : '';
        itemsHtml += `<div class="readiness-item block">❌ Mandatory patient or clinical handoff information missing${escapeHtml(extraInfo)}</div>`;
      }

      // Destination Hospital
      if (r.checkDetails.destinationHospitalVerified) {
        itemsHtml += `<div class="readiness-item pass">✅ Destination verified: ${escapeHtml(r.checkDetails.destinationHospitalName || '')}` +
          `${r.checkDetails.approxDistanceKm ? ` (~ ${r.checkDetails.approxDistanceKm} km away)` : ''}</div>`;
      } else {
        itemsHtml += '<div class="readiness-item block">❌ Valid destination hospital must be selected</div>';
      }

      // Receiving Doctor
      if (r.checkDetails.receivingDoctorVerified) {
        itemsHtml += `<div class="readiness-item pass">✅ Receiving doctor verified: ${escapeHtml(r.checkDetails.receivingDoctorName || '')}</div>`;
      } else {
        itemsHtml += '<div class="readiness-item block">❌ Authorized receiving doctor must be selected</div>';
      }

      // Resource capacity
      if (r.checkDetails.resourceCapacityStatus === 'suitable') {
        itemsHtml += '<div class="readiness-item pass">✅ Destination facility has capacity for requested bed types</div>';
      } else {
        itemsHtml += '<div class="readiness-item warn">⚠️ Destination shows limited/zero capacity for requested special requirements</div>';
      }

      // Warnings
      if (r.warnings && r.warnings.length > 0) {
        r.warnings.forEach(w => {
          const warningText = formatErrorMessage(w);
          itemsHtml += `<div class="readiness-item warn">⚠️ ${escapeHtml(warningText)}</div>`;
        });
      }

      readinessCheckItems.innerHTML = itemsHtml;

      // Update Confirmation Summary Box
      if (referralConfirmationBox && r.isReady) {
        referralConfirmationBox.hidden = false;
        confirmationSummaryText.innerHTML = `
          <strong>Patient:</strong> ${escapeHtml(payload.patientName)} (${payload.patientAge}y, ${payload.patientSex})<br>
          <strong>Destination:</strong> ${escapeHtml(r.checkDetails.destinationHospitalName || 'Selected Hospital')} ` +
          `(${r.checkDetails.approxDistanceKm ? `${r.checkDetails.approxDistanceKm} km` : 'Distance pending'})<br>
          <strong>Receiving Doctor:</strong> ${escapeHtml(r.checkDetails.receivingDoctorName || 'Assigned Clinician')}<br>
          <strong>Condition:</strong> ${escapeHtml(payload.currentCondition)} · <strong>Category:</strong> ${escapeHtml(payload.emergencyType)}<br>
          <strong>Reason:</strong> ${escapeHtml(payload.referralReason)}<br>
          <strong>Requirements:</strong> ${specialReqs.length ? specialReqs.join(', ') : 'None specified'}
        `;
      } else if (referralConfirmationBox) {
        referralConfirmationBox.hidden = true;
      }
    } catch (err) {
      console.warn('Readiness check note:', formatErrorMessage(err));
    }
  }

  // Form Submission
  if (createReferralForm) {
    createReferralForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (currentReadinessResult && !currentReadinessResult.isReady) {
        const rawFirstBlock = currentReadinessResult.blocks?.[0];
        const firstBlockMsg = formatErrorMessage(rawFirstBlock) || 'Please resolve all readiness blocks before sending.';
        showToast(`❌ Cannot send referral: ${firstBlockMsg}`);
        return;
      }

      referralModalSubmitBtn.disabled = true;
      referralModalSubmitBtn.textContent = '⏳ Dispatching Referral...';

      const specialReqs = Array.from(document.querySelectorAll('input[name="specialReq"]:checked')).map(cb => cb.value);

      const payload = {
        bedRequestId: refBedRequestId.value || undefined,
        emergencyIntakeId: refIntakeId.value || undefined,
        destinationHospitalId: refDestHospitalSelect.value,
        receivingDoctorId: refDestDoctorSelect.value,
        patientName: refPatientName.value.trim(),
        patientAge: parseInt(refPatientAge.value, 10),
        patientSex: refPatientSex.value,
        emergencyType: refEmergencyType.value.trim(),
        contactPhone: refContactPhone.value.trim(),
        currentProblem: refCurrentProblem.value.trim(),
        symptoms: refSymptoms.value.trim(),
        diagnosis: refDiagnosis.value.trim(),
        treatmentGiven: refTreatmentGiven.value.trim(),
        medicationsGiven: refMedicationsGiven.value.trim(),
        proceduresPerformed: refProceduresPerformed.value.trim(),
        currentCondition: refCondition.value,
        vitalsObservations: refVitals.value.trim(),
        referralReason: refReason.value.trim(),
        specialRequirements: specialReqs,
        additionalNotes: refNotes.value.trim(),
      };

      try {
        const res = await apiRequest('/referrals', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        showToast('🚀 Emergency referral created and dispatched successfully!');
        closeReferralModal();
        switchStaffTab('outgoing');
      } catch (err) {
        const errMsg = (err.body && (err.body.message || (err.body.errors && formatErrorMessage(err.body.errors[0])))) || err.message || formatErrorMessage(err);
        showToast(`❌ Referral failed: ${errMsg}`);
      } finally {
        referralModalSubmitBtn.disabled = false;
        referralModalSubmitBtn.textContent = 'CONFIRM & SEND REFERRAL';
      }
    });
  }

  // 3. Load Incoming Referrals
  async function loadIncomingReferrals(statusFilter = 'all') {
    if (!incomingReferralsContainer) return;
    try {
      const url = statusFilter && statusFilter !== 'all'
        ? `/referrals?type=incoming&status=${statusFilter}`
        : '/referrals?type=incoming';

      const res = await apiRequest(url);
      const refs = res.data || [];

      if (!refs.length) {
        incomingReferralsContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem; padding: 12px 0;">No incoming patient referrals matching criteria.</p>';
        return;
      }

      incomingReferralsContainer.innerHTML = refs.map(r => `
        <div class="referral-card">
          <div class="ref-info">
            <h4>
              ${escapeHtml(r.patientName)} (${r.patientAge}y, ${r.patientSex})
              <span class="status-badge ${r.status}">${escapeHtml(r.status.toUpperCase().replace(/_/g, ' '))}</span>
            </h4>
            <p>
              From: <strong>${escapeHtml(r.referringHospital?.name || 'Referring Facility')}</strong> ·
              Doctor: <strong>${escapeHtml(r.receivingDoctor?.name || 'Assigned Doctor')}</strong> ·
              Condition: <span style="font-weight: 600;">${escapeHtml(r.currentCondition)}</span>
            </p>
            <p style="margin-top: 3px; font-size: 0.78rem; color: var(--muted);">
              Reason: "${escapeHtml(r.referralReason)}" · Sent: ${new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div class="ref-actions">
            <button type="button" class="btn btn-primary btn-xs view-ref-btn" data-id="${r._id}">VIEW DETAILS</button>
          </div>
        </div>
      `).join('');

      incomingReferralsContainer.querySelectorAll('.view-ref-btn').forEach(btn => {
        btn.addEventListener('click', () => openReferralDetailModal(btn.dataset.id));
      });
    } catch (err) {
      incomingReferralsContainer.innerHTML = `<p style="color: var(--muted);">Error loading referrals: ${err.message}</p>`;
    }
  }

  // 4. Load Outgoing Referrals
  async function loadOutgoingReferrals() {
    if (!outgoingReferralsContainer) return;
    try {
      const res = await apiRequest('/referrals?type=outgoing');
      const refs = res.data || [];

      if (!refs.length) {
        outgoingReferralsContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem; padding: 12px 0;">No outgoing referrals dispatched from this facility.</p>';
        return;
      }

      outgoingReferralsContainer.innerHTML = refs.map(r => `
        <div class="referral-card">
          <div class="ref-info">
            <h4>
              ${escapeHtml(r.patientName)} (${r.patientAge}y, ${r.patientSex})
              <span class="status-badge ${r.status}">${escapeHtml(r.status.toUpperCase().replace(/_/g, ' '))}</span>
            </h4>
            <p>
              To: <strong>${escapeHtml(r.receivingHospital?.name || 'Destination Facility')}</strong> ·
              Assigned: <strong>${escapeHtml(r.receivingDoctor?.name || 'Receiving Doctor')}</strong> ·
              Condition: <span style="font-weight: 600;">${escapeHtml(r.currentCondition)}</span>
            </p>
            <p style="margin-top: 3px; font-size: 0.78rem; color: var(--muted);">
              Sent: ${new Date(r.createdAt).toLocaleDateString()} ${new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div class="ref-actions">
            <button type="button" class="btn btn-outline btn-xs view-ref-btn" data-id="${r._id}">VIEW DETAILS</button>
            ${r.status === 'accepted' ? `
              <button type="button" class="btn btn-primary btn-xs ref-transfer-btn" data-id="${r._id}">MARK TRANSFERRED</button>
            ` : ''}
          </div>
        </div>
      `).join('');

      outgoingReferralsContainer.querySelectorAll('.view-ref-btn').forEach(btn => {
        btn.addEventListener('click', () => openReferralDetailModal(btn.dataset.id));
      });

      outgoingReferralsContainer.querySelectorAll('.ref-transfer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/referrals/${btn.dataset.id}/transfer`, { method: 'PATCH' });
            showToast('Ambulance transfer initiated and recorded.');
            loadOutgoingReferrals();
          } catch (e) { showToast(`❌ ${formatErrorMessage(e)}`); }
        });
      });
    } catch (err) {
      outgoingReferralsContainer.innerHTML = `<p style="color: var(--muted);">Error loading outgoing referrals: ${err.message}</p>`;
    }
  }

  // 5. Open Referral Details Modal
  async function openReferralDetailModal(referralId) {
    if (!referralDetailModalOverlay) return;
    currentDetailReferralId = referralId;
    referralDetailModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    refDetailBody.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 20px;">Loading referral details...</p>';
    refDetailActions.innerHTML = '';

    try {
      const res = await apiRequest(`/referrals/${referralId}`);
      const ref = res.data;

      refDetailStatusBadge.textContent = ref.status.toUpperCase().replace(/_/g, ' ');
      refDetailStatusBadge.className = `status-badge ${ref.status}`;

      const userHospId = currentUser?.hospital?._id || currentUser?.hospitalId || currentUser?.hospital;
      const isReceiving = String(userHospId) === String(ref.receivingHospital?._id || ref.receivingHospital);
      const isReferring = String(userHospId) === String(ref.referringHospital?._id || ref.referringHospital);

      // Build Details HTML
      let html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-bottom: 16px;">
          <div class="admin-panel-card" style="margin: 0;">
            <h4 style="margin: 0 0 6px; font-size: 0.9rem;">Patient Information</h4>
            <p style="margin: 2px 0;"><strong>Name:</strong> ${escapeHtml(ref.patientName)}</p>
            <p style="margin: 2px 0;"><strong>Age / Sex:</strong> ${ref.patientAge} years · ${escapeHtml(ref.patientSex)}</p>
            <p style="margin: 2px 0;"><strong>Emergency Category:</strong> ${escapeHtml(ref.emergencyType)}</p>
            <p style="margin: 2px 0;"><strong>Contact Phone:</strong> ${escapeHtml(ref.contactPhone || 'N/A')}</p>
          </div>

          <div class="admin-panel-card" style="margin: 0;">
            <h4 style="margin: 0 0 6px; font-size: 0.9rem;">Transfer Route</h4>
            <p style="margin: 2px 0;"><strong>Referring Facility:</strong> ${escapeHtml(ref.referringHospital?.name || 'N/A')}</p>
            <p style="margin: 2px 0;"><strong>Referring Clinician:</strong> ${escapeHtml(ref.referringUser?.name || 'Staff Clinician')}</p>
            <p style="margin: 2px 0;"><strong>Destination Facility:</strong> ${escapeHtml(ref.receivingHospital?.name || 'N/A')}</p>
            <p style="margin: 2px 0;"><strong>Assigned Doctor:</strong> ${escapeHtml(ref.receivingDoctor?.name || 'Receiving Doctor')}</p>
          </div>
        </div>

        <div class="admin-panel-card" style="margin-bottom: 14px;">
          <h4 style="margin: 0 0 6px; font-size: 0.9rem;">Clinical Handoff &amp; Medical Observations</h4>
          <p style="margin: 4px 0;"><strong>Chief Complaint / Problem:</strong> ${escapeHtml(ref.currentProblem)}</p>
          <p style="margin: 4px 0;"><strong>Symptoms:</strong> ${escapeHtml(ref.symptoms)}</p>
          <p style="margin: 4px 0;"><strong>Diagnosis / Working Diagnosis:</strong> ${escapeHtml(ref.diagnosis)}</p>
          <p style="margin: 4px 0;"><strong>Treatments Administered:</strong> ${escapeHtml(ref.treatmentGiven)}</p>
          ${ref.medicationsGiven ? `<p style="margin: 4px 0;"><strong>Medications:</strong> ${escapeHtml(ref.medicationsGiven)}</p>` : ''}
          ${ref.proceduresPerformed ? `<p style="margin: 4px 0;"><strong>Procedures:</strong> ${escapeHtml(ref.proceduresPerformed)}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Clinical Condition:</strong> <span class="status-badge">${escapeHtml(ref.currentCondition)}</span></p>
          ${ref.vitalsObservations ? `<p style="margin: 4px 0;"><strong>Vitals &amp; Parameters:</strong> ${escapeHtml(ref.vitalsObservations)}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Reason for Referral:</strong> ${escapeHtml(ref.referralReason)}</p>
          ${ref.specialRequirements?.length ? `<p style="margin: 4px 0;"><strong>Special Requirements:</strong> ${ref.specialRequirements.map(s => `<span class="chip active">${escapeHtml(s)}</span>`).join(' ')}</p>` : ''}
          ${ref.additionalNotes ? `<p style="margin: 4px 0; font-style: italic;"><strong>Additional Notes:</strong> "${escapeHtml(ref.additionalNotes)}"</p>` : ''}
        </div>
      `;

      // If more info was requested or rejection reason exists
      if (ref.rejectionReason) {
        html += `
          <div class="admin-panel-card" style="background: #fef2f2; border-color: #fca5a5; margin-bottom: 14px;">
            <h4 style="color: #991b1b; margin: 0 0 4px; font-size: 0.88rem;">❌ Rejection Details</h4>
            <p style="color: #7f1d1d; margin: 0;">Reason: "${escapeHtml(ref.rejectionReason)}"</p>
          </div>
        `;
      }

      if (ref.informationRequest) {
        html += `
          <div class="admin-panel-card" style="background: #fffbeb; border-color: #fde68a; margin-bottom: 14px;">
            <h4 style="color: #92400e; margin: 0 0 4px; font-size: 0.88rem;">ℹ️ Information Requested by Destination Doctor</h4>
            <p style="color: #78350f; margin: 0;">"${escapeHtml(ref.informationRequest)}"</p>
          </div>
        `;
      }

      // Audit History Timeline
      if (ref.history && ref.history.length) {
        html += `
          <div class="admin-panel-card" style="margin-bottom: 14px;">
            <h4 style="margin: 0 0 10px; font-size: 0.9rem;">Audit Trail &amp; Referral Lifecycle History</h4>
            <div class="audit-timeline">
              ${ref.history.map(h => `
                <div class="timeline-item">
                  <div class="timeline-meta">${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${new Date(h.timestamp).toLocaleDateString()} by ${escapeHtml(h.userName || 'Clinician')}</div>
                  <div class="timeline-text"><strong>${escapeHtml(h.action)}</strong> ${h.notes ? `— "${escapeHtml(h.notes)}"` : ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      refDetailBody.innerHTML = html;

      // Build Action Buttons
      let actionsHtml = '<button type="button" class="btn btn-ghost" id="refDetailCloseBtn2">CLOSE</button>';

      if (isReceiving || currentUser.role === 'super_admin') {
        if (ref.status === 'pending' || ref.status === 'more_information_requested') {
          actionsHtml += `
            <button type="button" class="btn btn-primary" id="refActionAccept">ACCEPT REFERRAL</button>
            <button type="button" class="btn btn-outline" id="refActionMoreInfo">REQUEST MORE INFO</button>
            <button type="button" class="btn btn-danger" id="refActionReject">REJECT REFERRAL</button>
          `;
        } else if (ref.status === 'transferred') {
          actionsHtml += '<button type="button" class="btn btn-primary" id="refActionReceive">MARK PATIENT RECEIVED</button>';
        } else if (ref.status === 'received') {
          actionsHtml += '<button type="button" class="btn btn-primary" id="refActionComplete">COMPLETE REFERRAL</button>';
        }
      }

      if (isReferring || currentUser.role === 'super_admin') {
        if (ref.status === 'accepted') {
          actionsHtml += '<button type="button" class="btn btn-primary" id="refActionTransfer">MARK PATIENT TRANSFERRED</button>';
        }
      }

      refDetailActions.innerHTML = actionsHtml;

      // Attach button events
      const btnClose2 = document.getElementById('refDetailCloseBtn2');
      if (btnClose2) btnClose2.addEventListener('click', closeReferralDetailModal);

      const btnAccept = document.getElementById('refActionAccept');
      if (btnAccept) btnAccept.addEventListener('click', () => handleReferralStatusChange('accept'));

      const btnReject = document.getElementById('refActionReject');
      if (btnReject) btnReject.addEventListener('click', () => {
        if (referralRejectModalOverlay) referralRejectModalOverlay.hidden = false;
      });

      const btnMoreInfo = document.getElementById('refActionMoreInfo');
      if (btnMoreInfo) btnMoreInfo.addEventListener('click', () => {
        if (referralMoreInfoModalOverlay) referralMoreInfoModalOverlay.hidden = false;
      });

      const btnTransfer = document.getElementById('refActionTransfer');
      if (btnTransfer) btnTransfer.addEventListener('click', () => handleReferralStatusChange('transfer'));

      const btnReceive = document.getElementById('refActionReceive');
      if (btnReceive) btnReceive.addEventListener('click', () => handleReferralStatusChange('receive'));

      const btnComplete = document.getElementById('refActionComplete');
      if (btnComplete) btnComplete.addEventListener('click', () => handleReferralStatusChange('complete'));

    } catch (err) {
      refDetailBody.innerHTML = `<p style="color: var(--muted); text-align: center;">Error loading referral: ${err.message}</p>`;
    }
  }

  function closeReferralDetailModal() {
    if (referralDetailModalOverlay) referralDetailModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  if (refDetailCloseBtn) refDetailCloseBtn.addEventListener('click', closeReferralDetailModal);

  async function handleReferralStatusChange(endpoint, body = {}) {
    if (!currentDetailReferralId) return;
    try {
      await apiRequest(`/referrals/${currentDetailReferralId}/${endpoint}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      showToast('Referral status updated.');
      openReferralDetailModal(currentDetailReferralId);
      loadIncomingReferrals();
      loadOutgoingReferrals();
    } catch (err) {
      showToast(`❌ ${formatErrorMessage(err)}`);
    }
  }

  // Rejection Dialog Actions
  if (rejectCancelBtn) {
    rejectCancelBtn.addEventListener('click', () => {
      if (referralRejectModalOverlay) referralRejectModalOverlay.hidden = true;
    });
  }

  if (rejectConfirmBtn) {
    rejectConfirmBtn.addEventListener('click', async () => {
      const reason = rejectReasonInput?.value?.trim();
      if (!reason) {
        showToast('❌ Please specify a reason for rejection.');
        return;
      }
      if (referralRejectModalOverlay) referralRejectModalOverlay.hidden = true;
      await handleReferralStatusChange('reject', { rejectionReason: reason });
    });
  }

  // Request More Info Dialog Actions
  if (moreInfoCancelBtn) {
    moreInfoCancelBtn.addEventListener('click', () => {
      if (referralMoreInfoModalOverlay) referralMoreInfoModalOverlay.hidden = true;
    });
  }

  if (moreInfoConfirmBtn) {
    moreInfoConfirmBtn.addEventListener('click', async () => {
      const info = moreInfoInput?.value?.trim();
      if (!info) {
        showToast('❌ Please describe the information required.');
        return;
      }
      if (referralMoreInfoModalOverlay) referralMoreInfoModalOverlay.hidden = true;
      await handleReferralStatusChange('request-info', { informationRequest: info });
    });
  }

  // Hook into Bed Request "REFER PATIENT" button clicks
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('req-refer-btn')) {
      const reqId = e.target.dataset.id;
      const targetReq = (window._staffRequestsCache || []).find(r => r._id === reqId);
      openReferralModal(targetReq || { _id: reqId });
    }
  });

  // Socket.IO live notifications for referrals
  if (typeof io !== 'undefined') {
    try {
      const socket = io();
      socket.on('referral:created', (data) => {
        const userHospId = currentUser?.hospital?._id || currentUser?.hospitalId || currentUser?.hospital;
        if (String(userHospId) === String(data.receivingHospital)) {
          showToast('🔔 New emergency patient referral received!');
          loadIncomingReferrals();
        }
      });

      socket.on('referral:status_change', () => {
        loadIncomingReferrals();
        loadOutgoingReferrals();
      });
    } catch (e) {}
  }


  /* =====================================================
     15. BLOODCONNECT WEST BENGAL MODULE
     Integrated Real-Time Blood Availability, Cross-Matching,
     Multi-Hospital Requests, Donor Registry & Staff Management
     ===================================================== */
  
  // Blood compatibility rule matrix
  const BLOOD_COMPATIBILITY_RULES = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['AB-', 'A-', 'B-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-'],
  };

  const bloodBankPortal = document.getElementById('bloodBankPortal');
  const navBloodBankBtn = document.getElementById('navBloodBankBtn');
  const navBloodBankLink = document.getElementById('navBloodBankLink');
  const mobileBloodBankBtn = document.getElementById('mobileBloodBankBtn');
  const returnToBedTrackerBtn = document.getElementById('returnToBedTrackerBtn');

  const bloodSearchForm = document.getElementById('bloodSearchForm');
  const bloodSearchGroup = document.getElementById('bloodSearchGroup');
  const bloodSearchComponent = document.getElementById('bloodSearchComponent');
  const bloodSearchDistrict = document.getElementById('bloodSearchDistrict');
  const bloodSearchQuantity = document.getElementById('bloodSearchQuantity');
  const bloodCompatBanner = document.getElementById('bloodCompatBanner');
  const compatSummaryText = document.getElementById('compatSummaryText');
  const bloodResultsGrid = document.getElementById('bloodResultsGrid');
  const bloodEmptyState = document.getElementById('bloodEmptyState');
  const bloodResultsMeta = document.getElementById('bloodResultsMeta');
  const bloodNearMeBtn = document.getElementById('bloodNearMeBtn');
  const bloodResetSearchBtn = document.getElementById('bloodResetSearchBtn');
  const bloodEmptyResetBtn = document.getElementById('bloodEmptyResetBtn');

  // Blood Request Modal Elements
  const bloodRequestModalOverlay = document.getElementById('bloodRequestModalOverlay');
  const bloodReqModalCloseBtn = document.getElementById('bloodReqModalCloseBtn');
  const bloodReqCancelBtn = document.getElementById('bloodReqCancelBtn');
  const createBloodRequestForm = document.getElementById('createBloodRequestForm');
  const openEmergencyBloodRequestBtn = document.getElementById('openEmergencyBloodRequestBtn');
  const resultsEmergencyRequestBtn = document.getElementById('resultsEmergencyRequestBtn');
  const targetHospitalChecklist = document.getElementById('targetHospitalChecklist');
  const targetHospCountSummary = document.getElementById('targetHospCountSummary');
  const selectAllHospitalsInDistrictBtn = document.getElementById('selectAllHospitalsInDistrictBtn');
  const clearAllHospitalsBtn = document.getElementById('clearAllHospitalsBtn');

  const bloodPatientName = document.getElementById('bloodPatientName');
  const bloodPatientAge = document.getElementById('bloodPatientAge');
  const bloodPatientSex = document.getElementById('bloodPatientSex');
  const bloodContactPhone = document.getElementById('bloodContactPhone');
  const bloodAdmittedHospital = document.getElementById('bloodAdmittedHospital');
  const bloodReqGroup = document.getElementById('bloodReqGroup');
  const bloodReqComponent = document.getElementById('bloodReqComponent');
  const bloodReqQuantity = document.getElementById('bloodReqQuantity');
  const bloodReqUrgency = document.getElementById('bloodReqUrgency');
  const bloodReqNotes = document.getElementById('bloodReqNotes');
  const bloodReqSubmitBtn = document.getElementById('bloodReqSubmitBtn');

  // Clinical Detail Modal Elements
  const bloodRequestDetailModalOverlay = document.getElementById('bloodRequestDetailModalOverlay');
  const bloodDetailModalCloseBtn = document.getElementById('bloodDetailModalCloseBtn');
  const bloodDetailTitle = document.getElementById('bloodDetailTitle');
  const bloodDetailSubtitle = document.getElementById('bloodDetailSubtitle');
  const bloodDetailStatusBadge = document.getElementById('bloodDetailStatusBadge');
  const bloodDetailBody = document.getElementById('bloodDetailBody');
  const bloodDetailActions = document.getElementById('bloodDetailActions');

  // Prompts & Modals
  const bloodPartialAcceptModalOverlay = document.getElementById('bloodPartialAcceptModalOverlay');
  const partialUnitsInput = document.getElementById('partialUnitsInput');
  const partialNotesInput = document.getElementById('partialNotesInput');
  const partialCancelBtn = document.getElementById('partialCancelBtn');
  const partialConfirmBtn = document.getElementById('partialConfirmBtn');

  const bloodRejectModalOverlay = document.getElementById('bloodRejectModalOverlay');
  const bloodRejectReasonInput = document.getElementById('bloodRejectReasonInput');
  const bloodRejectCancelBtn = document.getElementById('bloodRejectCancelBtn');
  const bloodRejectConfirmBtn = document.getElementById('bloodRejectConfirmBtn');

  const bloodDonorBroadcastModalOverlay = document.getElementById('bloodDonorBroadcastModalOverlay');
  const donorBroadcastInfo = document.getElementById('donorBroadcastInfo');
  const broadcastContactDetails = document.getElementById('broadcastContactDetails');
  const donorBroadcastCancelBtn = document.getElementById('donorBroadcastCancelBtn');
  const donorBroadcastConfirmBtn = document.getElementById('donorBroadcastConfirmBtn');

  const updateStockModalOverlay = document.getElementById('updateStockModalOverlay');
  const updateStockCloseBtn = document.getElementById('updateStockCloseBtn');
  const updateStockCancelBtn = document.getElementById('updateStockCancelBtn');
  const updateStockForm = document.getElementById('updateStockForm');
  const openAddBloodStockBtn = document.getElementById('openAddBloodStockBtn');
  const invBloodGroup = document.getElementById('invBloodGroup');
  const invComponent = document.getElementById('invComponent');
  const invTotalUnits = document.getElementById('invTotalUnits');
  const invMinThreshold = document.getElementById('invMinThreshold');

  // Donor form
  const volunteerDonorForm = document.getElementById('volunteerDonorForm');
  const donorDistrict = document.getElementById('donorDistrict');
  const donorSubmitBtn = document.getElementById('donorSubmitBtn');

  let activeBloodRequestIdForAction = null;
  let cachedBloodRequests = [];
  let userGeoLocation = null;

  // --- 1. VIEW ROUTING & NAVIGATION (BLOOD BANK <-> MAIN HOMEPAGE) ---
  function showBloodBankPortal(updateHistory = true) {
    if (!bloodBankPortal) return;
    const medPortal = document.getElementById('medicalShopPortal');
    if (medPortal) medPortal.hidden = true;
    const ambPortal = document.getElementById('ambulancePortal');
    if (ambPortal) ambPortal.hidden = true;
    const mainSections = document.querySelectorAll('#main-content > section:not(#bloodBankPortal)');
    
    // Hide all main homepage sections
    mainSections.forEach(s => (s.hidden = true));
    bloodBankPortal.hidden = false;

    // Position at the very top of the portal
    window.scrollTo({ top: 0, left: 0 });

    if (mobileMenu && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
      if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
    }

    if (updateHistory && window.location.hash !== '#blood-bank') {
      history.pushState({ view: 'blood-bank' }, '', '#blood-bank');
    }

    // Load stats and initial search
    fetchBloodBankStatistics();
    executeBloodSearch();
  }

  function navigateToOriginalHome(updateHistory = true, targetSectionId = null) {
    const mainSections = document.querySelectorAll('#main-content > section:not(#bloodBankPortal):not(#medicalShopPortal):not(#ambulancePortal)');
    
    // 1. Unhide all original homepage sections
    mainSections.forEach(s => (s.hidden = false));

    // 2. Hide Blood Bank Portal, Medical Shop Portal, and Ambulance Portal completely
    if (bloodBankPortal) bloodBankPortal.hidden = true;
    const medPortal = document.getElementById('medicalShopPortal');
    if (medPortal) medPortal.hidden = true;
    const ambPortal = document.getElementById('ambulancePortal');
    if (ambPortal) ambPortal.hidden = true;

    // 3. Close mobile drawer menu if open
    if (mobileMenu && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
      if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
    }

    // 4. Handle specific target sections (Find Beds, Hospitals, Map, etc.)
    if (targetSectionId && targetSectionId !== '#main-content' && targetSectionId !== '#home' && targetSectionId !== '#') {
      const targetEl = document.querySelector(targetSectionId);
      if (targetEl) {
        if (updateHistory && window.location.hash !== targetSectionId) {
          history.pushState({ view: 'home', section: targetSectionId }, '', targetSectionId);
        }
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // 5. Navigate to original Emergency Bed Tracker homepage at the top
    if (updateHistory) {
      // Clean path without hash (compatible with local & GitHub Pages subpaths)
      const cleanUrl = window.location.pathname + window.location.search;
      history.pushState({ view: 'home' }, '', cleanUrl);
    }

    // 6. Ensure the page starts at the very top of the original homepage
    window.scrollTo({ top: 0, left: 0 });
  }

  // A) [ 🩸 Blood Bank ] button click handlers (Desktop, Mobile, Nav)
  const heroBloodBankBtn = document.getElementById('heroBloodBankBtn');
  [navBloodBankBtn, navBloodBankLink, mobileBloodBankBtn, heroBloodBankBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showBloodBankPortal(true);
      });
    }
  });

  // B) [ 🏥 Back to Bed Tracker ] button inside Blood Bank Portal
  if (returnToBedTrackerBtn) {
    returnToBedTrackerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToOriginalHome(true);
    });
  }

  // C) Emergency Bed Tracker Logo click handler (Returns to Homepage at top)
  document.querySelectorAll('.brand, #brandLogoLink').forEach(brand => {
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToOriginalHome(true);
    });
  });

  // C2) Header Emergency Action Buttons (Desktop Strip & Mobile Menu)
  const headerEmergencyActionBtn = document.getElementById('headerEmergencyActionBtn');
  const mobileEmergencyActionBtn = document.getElementById('mobileEmergencyActionBtn');
  [headerEmergencyActionBtn, mobileEmergencyActionBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const medPortal = document.getElementById('medicalShopPortal');
        const ambPortal = document.getElementById('ambulancePortal');
        const isBloodActive = bloodBankPortal && !bloodBankPortal.hidden;
        const isMedActive = medPortal && !medPortal.hidden;
        const isAmbActive = ambPortal && !ambPortal.hidden;
        if (isBloodActive || isMedActive || isAmbActive) {
          navigateToOriginalHome(true, '#emergency-patient-intake');
        } else {
          const intakeSec = document.getElementById('emergency-patient-intake');
          if (intakeSec) {
            intakeSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (mobileMenu && mobileMenu.classList.contains('open')) {
              mobileMenu.classList.remove('open');
              if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
          }
        }
      });
    }
  });

  // D) "Home" navigation links (Desktop, Mobile menu, Footer, and #main-content links)
  document.querySelectorAll('#navHomeLink, #mobileHomeBtn, #footerHomeLink, a[href="#main-content"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToOriginalHome(true);
    });
  });

  // E) Other Navbar links when inside Blood Bank Portal, Medical Shop Portal, or Ambulance Portal
  document.querySelectorAll('#navLinks a, #mobileMenu a, .footer-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href === '#blood-bank' || href === '#medical-shops' || href === '#ambulance' || href.startsWith('tel:') || href === '#staff-portal') return;

    link.addEventListener('click', (e) => {
      const medPortal = document.getElementById('medicalShopPortal');
      const ambPortal = document.getElementById('ambulancePortal');
      const isBloodActive = bloodBankPortal && !bloodBankPortal.hidden;
      const isMedActive = medPortal && !medPortal.hidden;
      const isAmbActive = ambPortal && !ambPortal.hidden;
      if (isBloodActive || isMedActive || isAmbActive) {
        e.preventDefault();
        if (href === '#main-content' || href === '#home') {
          navigateToOriginalHome(true);
        } else {
          navigateToOriginalHome(true, href);
        }
      }
    });
  });

  // F) Browser Back & Forward button handling (popstate & hashchange)
  function handleNavigationSync() {
    const hash = window.location.hash;
    const medPortal = document.getElementById('medicalShopPortal');
    const ambPortal = document.getElementById('ambulancePortal');
    if (hash === '#blood-bank') {
      if (medPortal) medPortal.hidden = true;
      if (ambPortal) ambPortal.hidden = true;
      if (bloodBankPortal && bloodBankPortal.hidden) {
        showBloodBankPortal(false); // don't push duplicate history entry
      }
    } else if (hash === '#medical-shops') {
      if (bloodBankPortal) bloodBankPortal.hidden = true;
      if (ambPortal) ambPortal.hidden = true;
      if (medPortal && medPortal.hidden && typeof showMedicalShopPortal === 'function') {
        showMedicalShopPortal(false);
      }
    } else if (hash === '#ambulance') {
      if (bloodBankPortal) bloodBankPortal.hidden = true;
      if (medPortal) medPortal.hidden = true;
      if (ambPortal && ambPortal.hidden && typeof showAmbulancePortal === 'function') {
        showAmbulancePortal(false);
      }
    } else {
      const isBloodActive = bloodBankPortal && !bloodBankPortal.hidden;
      const isMedActive = medPortal && !medPortal.hidden;
      const isAmbActive = ambPortal && !ambPortal.hidden;
      if (isBloodActive || isMedActive || isAmbActive) {
        navigateToOriginalHome(false, hash || null); // don't push duplicate history entry
      }
    }
  }

  window.addEventListener('popstate', handleNavigationSync);
  window.addEventListener('hashchange', handleNavigationSync);

  // G) Initial load route check
  if (window.location.hash === '#blood-bank') {
    showBloodBankPortal(false);
  } else if (window.location.hash === '#medical-shops') {
    if (typeof showMedicalShopPortal === 'function') {
      showMedicalShopPortal(false);
    }
  } else if (window.location.hash === '#ambulance') {
    if (typeof showAmbulancePortal === 'function') {
      showAmbulancePortal(false);
    }
  } else {
    if (bloodBankPortal) bloodBankPortal.hidden = true;
    const medPortal = document.getElementById('medicalShopPortal');
    if (medPortal) medPortal.hidden = true;
    const ambPortal = document.getElementById('ambulancePortal');
    if (ambPortal) ambPortal.hidden = true;
    const initialMainSections = document.querySelectorAll('#main-content > section:not(#bloodBankPortal):not(#medicalShopPortal):not(#ambulancePortal)');
    initialMainSections.forEach(s => (s.hidden = false));
  }

  // --- 2. POPULATE DROPDOWNS & COMPATIBILITY HELPERS ---
  if (bloodSearchDistrict && bloodSearchDistrict.options.length <= 1) {
    DISTRICTS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      bloodSearchDistrict.appendChild(opt);
    });
  }

  if (donorDistrict && donorDistrict.options.length <= 1) {
    DISTRICTS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      donorDistrict.appendChild(opt);
    });
  }

  if (bloodSearchGroup) {
    bloodSearchGroup.addEventListener('change', updateCompatibilityBanner);
  }

  function updateCompatibilityBanner() {
    const grp = bloodSearchGroup ? bloodSearchGroup.value : '';
    if (!grp) {
      if (bloodCompatBanner) bloodCompatBanner.hidden = true;
      return;
    }

    const comp = bloodSearchComponent ? bloodSearchComponent.value : 'Whole Blood';
    const compatible = BLOOD_COMPATIBILITY_RULES[grp] || [grp];
    
    if (bloodCompatBanner && compatSummaryText) {
      bloodCompatBanner.hidden = false;
      compatSummaryText.textContent = `A patient with blood group ${grp} can safely receive ${comp} from compatible donor groups: ${compatible.join(', ')}.`;
    }
  }

  // --- 3. FETCH BLOOD METRICS ---
  async function fetchBloodBankStatistics() {
    try {
      const res = await apiRequest('/blood-banks/statistics');
      if (res && res.data) {
        const d = res.data;
        const statTotal = document.getElementById('statTotalBloodUnits');
        const statActive = document.getElementById('statActiveBloodBanks');
        if (statTotal && d.totalBloodUnitsAvailable !== undefined) {
          statTotal.textContent = d.totalBloodUnitsAvailable.toLocaleString();
        }
        if (statActive && d.totalHospitalsInNetwork !== undefined) {
          statActive.textContent = `${d.totalHospitalsInNetwork} / 24`;
        }
      }
    } catch (e) {
      console.warn('Could not fetch live blood statistics:', e.message);
    }
  }

  // --- 4. PUBLIC BLOOD SEARCH ---
  async function executeBloodSearch() {
    if (!bloodResultsGrid) return;
    bloodResultsGrid.innerHTML = '<p style="color: var(--muted); grid-column: 1/-1; text-align: center; padding: 24px;">🔄 Querying West Bengal blood banks...</p>';

    const params = new URLSearchParams();
    if (bloodSearchGroup && bloodSearchGroup.value) params.append('bloodGroup', bloodSearchGroup.value);
    if (bloodSearchComponent && bloodSearchComponent.value && bloodSearchComponent.value !== 'all') {
      params.append('component', bloodSearchComponent.value);
    }
    if (bloodSearchDistrict && bloodSearchDistrict.value && bloodSearchDistrict.value !== 'all') {
      params.append('district', bloodSearchDistrict.value);
    }
    if (bloodSearchQuantity && bloodSearchQuantity.value) {
      params.append('quantity', bloodSearchQuantity.value);
    }
    if (userGeoLocation) {
      params.append('latitude', userGeoLocation.latitude);
      params.append('longitude', userGeoLocation.longitude);
    }

    try {
      const res = await apiRequest('/blood-banks/search?' + params.toString());
      const facilities = res.data || [];

      if (!facilities.length) {
        bloodResultsGrid.innerHTML = '';
        if (bloodEmptyState) bloodEmptyState.hidden = false;
        if (bloodResultsMeta) bloodResultsMeta.textContent = '0 blood banks found matching search criteria.';
        return;
      }

      if (bloodEmptyState) bloodEmptyState.hidden = true;
      if (bloodResultsMeta) {
        bloodResultsMeta.textContent = `Showing ${facilities.length} verified blood banks across West Bengal`;
      }

      bloodResultsGrid.innerHTML = facilities.map(f => {
        const exactUnits = f.exactMatchAvailable || 0;
        let statusBadge = '';
        if (exactUnits >= 5) {
          statusBadge = '<span class="status-badge available">🟢 AVAILABLE (${exactUnits} Units)</span>';
        } else if (exactUnits > 0) {
          statusBadge = '<span class="status-badge limited">🟡 LOW STOCK (${exactUnits} Units)</span>';
        } else {
          statusBadge = '<span class="status-badge full">🔴 UNAVAILABLE</span>';
        }

        const distanceText = f.distanceKm !== null && f.distanceKm !== undefined
          ? `<span style="font-size: 0.8rem; color: #0284c7; font-weight: 600;">📍 ~${f.distanceKm} km away</span>`
          : '';

        // Inventory summary pills
        const invPills = (f.inventory || []).slice(0, 8).map(inv => `
          <span class="blood-group-tag" title="${escapeHtml(inv.component)}: ${inv.availableUnits} units available">
            ${escapeHtml(inv.bloodGroup)}: ${inv.availableUnits}
          </span>
        `).join('');

        return `
          <div class="blood-card" data-hosp-id="${f.hospitalId}">
            <div>
              <div class="blood-card-header">
                <div>
                  <h4 class="blood-card-title">${escapeHtml(f.hospitalName || f.name)}</h4>
                  <div class="blood-card-loc">📌 ${escapeHtml(f.district || 'West Bengal')} ${f.area ? '· ' + escapeHtml(f.area) : ''}</div>
                </div>
                ${f.isVerified ? '<span class="status-badge available" style="font-size: 0.72rem;">✓ Verified</span>' : ''}
              </div>

              <div class="blood-stock-highlight">
                <div>
                  <div class="blood-units-label">Exact Match Stock</div>
                  <div class="blood-units-count">${exactUnits} <span style="font-size: 0.85rem; font-weight: 500;">units</span></div>
                </div>
                <div>${statusBadge}</div>
              </div>

              ${invPills ? `
                <div style="margin-top: 10px;">
                  <span style="font-size: 0.76rem; color: var(--muted); display: block; margin-bottom: 4px;">Compatible In-Stock Groups:</span>
                  <div class="blood-compat-list">${invPills}</div>
                </div>
              ` : ''}
            </div>

            <div class="blood-card-footer">
              <div>
                ${distanceText}
                <div style="font-size: 0.78rem; color: var(--muted); margin-top: 2px;">
                  📞 <a href="tel:${escapeHtml(f.phone || '112')}" style="color: var(--primary); font-weight: 600;">${escapeHtml(f.phone || '112')}</a>
                </div>
              </div>
              <button type="button" class="btn btn-blood btn-sm btn-blood-card-req" data-hosp-id="${f.hospitalId}" data-hosp-name="${escapeHtml(f.hospitalName || f.name)}">
                🩸 Request Blood
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Attach card request buttons
      bloodResultsGrid.querySelectorAll('.btn-blood-card-req').forEach(btn => {
        btn.addEventListener('click', () => {
          openBloodRequestModal(btn.dataset.hospId);
        });
      });

    } catch (err) {
      bloodResultsGrid.innerHTML = `<p style="color: var(--danger); text-align: center; grid-column: 1/-1;">❌ Error searching blood banks: ${err.message}</p>`;
    }
  }

  if (bloodSearchForm) {
    bloodSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeBloodSearch();
    });
  }

  if (bloodNearMeBtn) {
    bloodNearMeBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('❌ Geolocation is not supported by your browser.');
        return;
      }
      showToast('📍 Detecting current location...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userGeoLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          showToast('✅ Location detected! Sorting blood banks by proximity.');
          executeBloodSearch();
        },
        (err) => {
          showToast('⚠️ Could not obtain location: ' + err.message);
        },
        { timeout: 8000 }
      );
    });
  }

  if (bloodResetSearchBtn) {
    bloodResetSearchBtn.addEventListener('click', () => {
      if (bloodSearchForm) bloodSearchForm.reset();
      userGeoLocation = null;
      if (bloodCompatBanner) bloodCompatBanner.hidden = true;
      executeBloodSearch();
    });
  }

  if (bloodEmptyResetBtn) {
    bloodEmptyResetBtn.addEventListener('click', () => {
      if (bloodSearchForm) bloodSearchForm.reset();
      userGeoLocation = null;
      executeBloodSearch();
    });
  }

  // --- 5. MULTI-HOSPITAL BLOOD REQUEST MODAL (PATIENT VS REQUESTER) ---
  const bloodPatientIntakeSelectWrap = document.getElementById('bloodPatientIntakeSelectWrap');
  const bloodIntakePatientSelect = document.getElementById('bloodIntakePatientSelect');
  const bloodAttendingDoctor = document.getElementById('bloodAttendingDoctor');
  const bloodRequesterRelation = document.getElementById('bloodRequesterRelation');
  const bloodRequesterName = document.getElementById('bloodRequesterName');
  const bloodRequesterContact = document.getElementById('bloodRequesterContact');
  const bloodRequesterRole = document.getElementById('bloodRequesterRole');
  const bloodReqDateTime = document.getElementById('bloodReqDateTime');
  const bloodReqReason = document.getElementById('bloodReqReason');

  const bloodRequestSuccessModalOverlay = document.getElementById('bloodRequestSuccessModalOverlay');
  const successReqId = document.getElementById('successReqId');
  const successPatientName = document.getElementById('successPatientName');
  const successRequesterName = document.getElementById('successRequesterName');
  const successBloodReq = document.getElementById('successBloodReq');
  const successUnits = document.getElementById('successUnits');
  const successHospCount = document.getElementById('successHospCount');
  const bloodSuccessCloseBtn = document.getElementById('bloodSuccessCloseBtn');
  const bloodSuccessTrackBtn = document.getElementById('bloodSuccessTrackBtn');

  async function openBloodRequestModal(preselectedHospId = null, patientData = null) {
    if (!bloodRequestModalOverlay) return;
    bloodRequestModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    // 1. Auto-fill Requester Details if user is authenticated
    if (!currentUser && authToken) {
      try {
        const meRes = await apiRequest('/auth/me');
        if (meRes.data) currentUser = meRes.data;
      } catch (e) {}
    }

    if (currentUser) {
      if (bloodRequesterName) {
        bloodRequesterName.value = currentUser.name || '';
      }
      if (bloodRequesterContact) {
        bloodRequesterContact.value = currentUser.phone || currentUser.email || '';
      }
      if (bloodRequesterRole) {
        const r = (currentUser.role || 'USER').toUpperCase();
        bloodRequesterRole.value = ['DOCTOR', 'HOSPITAL_STAFF', 'BLOOD_BANK_STAFF', 'HOSPITAL_ADMIN', 'PATIENT'].includes(r) ? r : 'USER';
      }
      if (bloodRequesterRelation && currentUser.role === 'doctor') {
        bloodRequesterRelation.value = 'Attending Clinician';
      }
    }

    // 2. Pre-fill patient details if provided, else keep clear so user enters actual patient
    if (patientData) {
      if (bloodPatientName) bloodPatientName.value = patientData.patientName || '';
      if (bloodPatientAge) bloodPatientAge.value = patientData.patientAge || patientData.age || 28;
      if (bloodPatientSex) bloodPatientSex.value = patientData.patientSex || patientData.sex || 'Male';
      if (bloodContactPhone) bloodContactPhone.value = patientData.contactPhone || patientData.contactNumber || '';
      if (bloodReqReason) bloodReqReason.value = patientData.notes || patientData.symptoms || 'Acute medical emergency requiring blood transfusion.';
      if (bloodAdmittedHospital) bloodAdmittedHospital.value = patientData.district || 'West Bengal';
    } else {
      if (bloodPatientName) bloodPatientName.value = '';
    }

    // 3. Populate Emergency Intake Dropdown if logged in as staff/doctor
    if (currentUser && ['doctor', 'hospital_admin', 'blood_bank_staff'].includes(currentUser.role)) {
      if (bloodPatientIntakeSelectWrap) bloodPatientIntakeSelectWrap.hidden = false;
      loadEmergencyIntakesForDropdown();
    } else {
      if (bloodPatientIntakeSelectWrap) bloodPatientIntakeSelectWrap.hidden = true;
    }

    populateTargetHospitalsChecklist(preselectedHospId);
  }

  async function loadEmergencyIntakesForDropdown() {
    if (!bloodIntakePatientSelect) return;
    try {
      const res = await apiRequest('/emergency/intake');
      const intakes = res.data || [];
      if (!intakes.length) return;

      bloodIntakePatientSelect.innerHTML = '<option value="">-- Select Existing Patient from Emergency Intake --</option>' +
        intakes.map(p => `<option value="${p._id}" data-name="${escapeHtml(p.patientName)}" data-age="${p.age}" data-sex="${escapeHtml(p.sex)}" data-phone="${escapeHtml(p.contactNumber)}" data-reason="${escapeHtml(p.emergencyType + ': ' + p.symptoms)}">${escapeHtml(p.patientName)} (${p.age}y, ${p.sex}) - ${escapeHtml(p.emergencyType)}</option>`).join('');

      bloodIntakePatientSelect.onchange = () => {
        const opt = bloodIntakePatientSelect.selectedOptions[0];
        if (!opt || !opt.value) return;
        if (bloodPatientName) bloodPatientName.value = opt.dataset.name || '';
        if (bloodPatientAge) bloodPatientAge.value = opt.dataset.age || 30;
        if (bloodPatientSex) bloodPatientSex.value = opt.dataset.sex || 'Male';
        if (bloodContactPhone) bloodContactPhone.value = opt.dataset.phone || '';
        if (bloodReqReason) bloodReqReason.value = opt.dataset.reason || '';
        if (bloodRequesterRelation) bloodRequesterRelation.value = 'Attending Clinician';
      };
    } catch (e) {
      console.warn('Could not load intake patients:', e.message);
    }
  }

  function closeBloodRequestModal() {
    if (bloodRequestModalOverlay) bloodRequestModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function closeBloodSuccessModal() {
    if (bloodRequestSuccessModalOverlay) bloodRequestSuccessModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  if (bloodReqModalCloseBtn) bloodReqModalCloseBtn.addEventListener('click', closeBloodRequestModal);
  if (bloodReqCancelBtn) bloodReqCancelBtn.addEventListener('click', closeBloodRequestModal);
  if (bloodSuccessCloseBtn) bloodSuccessCloseBtn.addEventListener('click', closeBloodSuccessModal);

  // Dynamic relation toggle
  if (bloodRequesterRelation) {
    bloodRequesterRelation.addEventListener('change', () => {
      if (bloodRequesterRelation.value === 'Self') {
        if (bloodPatientName) {
          bloodPatientName.value = bloodRequesterName ? (bloodRequesterName.value || (currentUser ? currentUser.name : '')) : '';
        }
      } else {
        if (bloodPatientName && bloodRequesterName && bloodPatientName.value === bloodRequesterName.value) {
          bloodPatientName.value = '';
          bloodPatientName.focus();
        }
      }
    });
  }

  // --- MY BLOOD REQUESTS TRACKING MODAL ---
  const myBloodRequestsModalOverlay = document.getElementById('myBloodRequestsModalOverlay');
  const myBloodReqModalCloseBtn = document.getElementById('myBloodReqModalCloseBtn');
  const closeMyBloodReqFooterBtn = document.getElementById('closeMyBloodReqFooterBtn');
  const refreshMyBloodRequestsBtn = document.getElementById('refreshMyBloodRequestsBtn');
  const myBloodRequestsContainer = document.getElementById('myBloodRequestsContainer');
  const openMyBloodRequestsBtn = document.getElementById('openMyBloodRequestsBtn');
  const myBloodRequestsBtn = document.getElementById('myBloodRequestsBtn');

  function closeMyBloodRequestsModal() {
    if (myBloodRequestsModalOverlay) myBloodRequestsModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  async function openMyBloodRequestsModal() {
    if (!myBloodRequestsModalOverlay) return;
    myBloodRequestsModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    await loadMyBloodRequests();
  }

  async function loadMyBloodRequests() {
    if (!myBloodRequestsContainer) return;

    if (!authToken) {
      myBloodRequestsContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🔐</div>
          <h4 style="margin: 0 0 6px;">Login to Track Your Blood Requests</h4>
          <p style="color: var(--muted); font-size: 0.86rem; margin-bottom: 16px;">
            Please log in with your citizen account to track your submitted blood requests and see hospital fulfillment status.
          </p>
          <button type="button" class="btn btn-primary" id="loginToTrackBloodBtn">Log In / Register</button>
        </div>
      `;
      document.getElementById('loginToTrackBloodBtn')?.addEventListener('click', () => {
        closeMyBloodRequestsModal();
        openAuthModal('citizen');
      });
      return;
    }

    myBloodRequestsContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem; text-align: center; padding: 18px;">⏳ Loading your blood requests...</p>';

    try {
      const res = await apiRequest('/blood-requests/my-requests');
      const reqs = res.data || [];

      if (!reqs.length) {
        myBloodRequestsContainer.innerHTML = `
          <div style="text-align: center; padding: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid var(--border);">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🩸</div>
            <h4 style="margin: 0 0 6px;">No Blood Requests Found</h4>
            <p style="color: var(--muted); font-size: 0.86rem; margin-bottom: 14px;">
              You have not submitted any emergency blood requests yet.
            </p>
            <button type="button" class="btn btn-blood btn-sm" id="emptyDispatchBloodBtn">🚨 Dispatch Emergency Blood Request</button>
          </div>
        `;
        document.getElementById('emptyDispatchBloodBtn')?.addEventListener('click', () => {
          closeMyBloodRequestsModal();
          openBloodRequestModal();
        });
        return;
      }

      myBloodRequestsContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${reqs.map(r => {
            const displayId = r.requestId || ('BR-' + (r._id ? r._id.slice(-5).toUpperCase() : ''));
            const patName = r.patient?.name || r.patientName || 'Patient';
            const patAge = r.patient?.age || r.patientAge;
            const patSex = r.patient?.gender || r.patientSex;
            const bGroup = r.bloodRequirement?.bloodGroup || r.bloodGroup || '';
            const bComp = r.bloodRequirement?.component || r.bloodComponent || 'Whole Blood';
            const bQty = r.bloodRequirement?.quantity || r.quantity || 1;
            const urg = (r.bloodRequirement?.urgency || r.urgency || 'EMERGENCY').toUpperCase();
            const statusClass = (r.status || 'PENDING').toLowerCase();

            const recipientBadges = (r.recipients || []).map(rec => {
              const hName = rec.hospital?.name || 'Hospital';
              const s = rec.status || 'PENDING';
              const sc = s === 'ACCEPTED' || s === 'BLOOD_RESERVED' ? 'approved' : (s === 'REJECTED' ? 'rejected' : 'pending');
              return `<span class="status-badge ${sc}" style="font-size: 0.72rem;">${escapeHtml(hName)}: ${escapeHtml(s)}</span>`;
            }).join(' ');

            return `
              <div class="admin-panel-card" style="background: #ffffff; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                  <div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
                      <span style="font-family: monospace; font-weight: 700; color: #be123c; font-size: 0.9rem;">${escapeHtml(displayId)}</span>
                      <span class="blood-urgency-badge ${escapeHtml(urg)}" style="font-size: 0.72rem;">${escapeHtml(urg)}</span>
                      <span class="status-badge ${statusClass}" style="font-size: 0.75rem;">Status: ${escapeHtml(r.status)}</span>
                    </div>

                    <h4 style="margin: 4px 0 2px; font-size: 1.05rem; color: #0f172a;">
                      👤 Patient: <strong style="color: #be123c;">${escapeHtml(patName)}</strong>
                      <span style="font-size: 0.82rem; font-weight: normal; color: var(--muted);">(${patAge ? patAge + 'y' : ''}${patSex ? ', ' + escapeHtml(patSex) : ''})</span>
                    </h4>

                    <div style="font-size: 0.88rem; margin-top: 3px;">
                      🩸 Blood: <strong style="color: #be123c;">${escapeHtml(bGroup)} (${escapeHtml(bComp)})</strong> &nbsp;|&nbsp; 📦 Quantity: <strong>${bQty} Units</strong>
                    </div>

                    <div style="font-size: 0.82rem; color: #1e40af; margin-top: 3px;">
                      👤 Requested By: <strong>${escapeHtml(r.requester?.name || currentUser?.name || 'Citizen Requester')}</strong> (${escapeHtml(r.requester?.relationshipToPatient || 'Friend')})
                    </div>

                    <div style="font-size: 0.8rem; color: var(--muted); margin-top: 4px;">
                      Dispatched on ${new Date(r.createdAt).toLocaleString()} &middot; Target Blood Banks (${r.recipients?.length || 0})
                    </div>

                    <div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
                      ${recipientBadges}
                    </div>
                  </div>

                  <button type="button" class="btn btn-outline btn-xs view-my-blood-detail-btn" data-id="${r._id}">View Full Details</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      myBloodRequestsContainer.querySelectorAll('.view-my-blood-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          closeMyBloodRequestsModal();
          openBloodRequestDetailModal(btn.dataset.id);
        });
      });
    } catch (e) {
      myBloodRequestsContainer.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 14px;">❌ Error loading requests: ${escapeHtml(e.message)}</p>`;
    }
  }

  if (myBloodReqModalCloseBtn) myBloodReqModalCloseBtn.addEventListener('click', closeMyBloodRequestsModal);
  if (closeMyBloodReqFooterBtn) closeMyBloodReqFooterBtn.addEventListener('click', closeMyBloodRequestsModal);
  if (refreshMyBloodRequestsBtn) refreshMyBloodRequestsBtn.addEventListener('click', () => loadMyBloodRequests());

  if (openMyBloodRequestsBtn) openMyBloodRequestsBtn.addEventListener('click', openMyBloodRequestsModal);
  if (myBloodRequestsBtn) myBloodRequestsBtn.addEventListener('click', openMyBloodRequestsModal);

  if (bloodSuccessTrackBtn) {
    bloodSuccessTrackBtn.addEventListener('click', () => {
      closeBloodSuccessModal();
      openMyBloodRequestsModal();
    });
  }

  if (openEmergencyBloodRequestBtn) openEmergencyBloodRequestBtn.addEventListener('click', () => openBloodRequestModal());
  if (resultsEmergencyRequestBtn) resultsEmergencyRequestBtn.addEventListener('click', () => openBloodRequestModal());

  function populateTargetHospitalsChecklist(preselectedHospId = null) {
    if (!targetHospitalChecklist) return;

    targetHospitalChecklist.innerHTML = hospitals.map(h => {
      const hId = h._id || h.id;
      const isChecked = preselectedHospId && String(preselectedHospId) === String(hId);
      return `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; background: ${isChecked ? '#ffe4e6' : '#f8fafc'}; cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" name="targetHospital" value="${hId}" ${isChecked ? 'checked' : ''} class="target-hosp-checkbox" data-district="${escapeHtml(h.district)}">
            <span style="font-size: 0.86rem; font-weight: 600;">${escapeHtml(h.name)}</span>
          </div>
          <span style="font-size: 0.76rem; color: var(--muted); background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${escapeHtml(h.district)}</span>
        </label>
      `;
    }).join('');

    updateTargetHospSummary();

    targetHospitalChecklist.querySelectorAll('.target-hosp-checkbox').forEach(cb => {
      cb.addEventListener('change', updateTargetHospSummary);
    });
  }

  function updateTargetHospSummary() {
    if (!targetHospCountSummary) return;
    const checked = document.querySelectorAll('input[name="targetHospital"]:checked');
    targetHospCountSummary.textContent = `Selected: ${checked.length} blood bank(s) for simultaneous broadcast`;
  }

  if (selectAllHospitalsInDistrictBtn) {
    selectAllHospitalsInDistrictBtn.addEventListener('click', () => {
      const dist = (bloodSearchDistrict && bloodSearchDistrict.value !== 'all') ? bloodSearchDistrict.value : 'Kolkata';
      document.querySelectorAll('input[name="targetHospital"]').forEach(cb => {
        if (cb.dataset.district === dist) cb.checked = true;
      });
      updateTargetHospSummary();
    });
  }

  if (clearAllHospitalsBtn) {
    clearAllHospitalsBtn.addEventListener('click', () => {
      document.querySelectorAll('input[name="targetHospital"]').forEach(cb => (cb.checked = false));
      updateTargetHospSummary();
    });
  }

  // Submit Blood Request Form
  if (createBloodRequestForm) {
    createBloodRequestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const selectedHospitals = Array.from(document.querySelectorAll('input[name="targetHospital"]:checked')).map(cb => cb.value);
      if (!selectedHospitals.length) {
        showToast('❌ Please select at least one hospital blood bank.');
        return;
      }

      bloodReqSubmitBtn.disabled = true;
      bloodReqSubmitBtn.textContent = '⏳ Sending Blood Request to Network...';

      const payload = {
        // A. Separate Patient
        patient: {
          name: bloodPatientName.value.trim(),
          age: parseInt(bloodPatientAge.value, 10) || 28,
          gender: bloodPatientSex.value,
          contactPhone: bloodContactPhone.value.trim(),
          currentHospital: bloodAdmittedHospital ? bloodAdmittedHospital.value.trim() : undefined,
          attendingDoctor: bloodAttendingDoctor ? bloodAttendingDoctor.value.trim() : undefined,
        },
        // B. Separate Requester
        requester: {
          name: (bloodRequesterName?.value || '').trim() || (bloodRequesterRelation?.value === 'Self' ? bloodPatientName.value.trim() : (currentUser?.name || 'Citizen Requester')),
          contact: (bloodRequesterContact?.value || '').trim() || (currentUser?.phone || currentUser?.email || bloodContactPhone.value.trim()),
          role: bloodRequesterRole?.value || 'USER',
          relationshipToPatient: bloodRequesterRelation?.value || 'Friend',
        },
        // C. Clinical Requirement
        bloodRequirement: {
          bloodGroup: bloodReqGroup.value,
          component: bloodReqComponent.value,
          quantity: parseInt(bloodReqQuantity.value, 10) || 1,
          urgency: bloodReqUrgency.value,
          requiredAt: bloodReqDateTime && bloodReqDateTime.value ? new Date(bloodReqDateTime.value) : undefined,
        },
        reason: (bloodReqReason?.value || 'Emergency patient blood requirement').trim(),
        notes: (bloodReqNotes?.value || '').trim(),
        targetHospitals: selectedHospitals,
      };

      try {
        const res = await apiRequest('/blood-requests', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const reqData = res.data || {};
        const displayId = reqData.requestId || ('BR-' + (reqData._id ? reqData._id.slice(-5).toUpperCase() : '10025'));

        closeBloodRequestModal();
        createBloodRequestForm.reset();

        // Show rich confirmation modal
        if (bloodRequestSuccessModalOverlay) {
          if (successReqId) successReqId.textContent = displayId;
          if (successPatientName) successPatientName.textContent = payload.patient.name;
          if (successRequesterName) successRequesterName.textContent = `${payload.requester.name} (${payload.requester.relationshipToPatient})`;
          if (successBloodReq) successBloodReq.textContent = `${payload.bloodRequirement.bloodGroup} (${payload.bloodRequirement.component})`;
          if (successUnits) successUnits.textContent = `${payload.bloodRequirement.quantity} Units`;
          if (successHospCount) successHospCount.textContent = `${selectedHospitals.length} Blood Bank(s)`;
          bloodRequestSuccessModalOverlay.hidden = false;
        } else {
          showToast(`🚨 Blood request ${displayId} dispatched to ${selectedHospitals.length} hospital(s) successfully!`);
        }

        // Refresh staff portal if open
        loadStaffBloodRequests();
      } catch (err) {
        showToast(`❌ Request failed: ${formatErrorMessage(err)}`);
      } finally {
        bloodReqSubmitBtn.disabled = false;
        bloodReqSubmitBtn.textContent = '🚀 SEND BLOOD REQUEST';
      }
    });
  }

  // --- 6. VOLUNTEER DONOR REGISTRATION ---
  if (volunteerDonorForm) {
    volunteerDonorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const donorName = document.getElementById('donorName')?.value.trim();
      const donorBloodGroup = document.getElementById('donorBloodGroup')?.value;
      const donorAge = parseInt(document.getElementById('donorAge')?.value, 10);
      const donorGender = document.getElementById('donorGender')?.value;
      const donorDistrictVal = document.getElementById('donorDistrict')?.value;
      const donorCity = document.getElementById('donorCity')?.value.trim();
      const donorPhone = document.getElementById('donorPhone')?.value.trim();
      const donorEmail = document.getElementById('donorEmail')?.value.trim();

      if (!donorName || !donorBloodGroup || !donorAge || !donorPhone || !donorDistrictVal) {
        showToast('❌ Please fill in all required donor fields.');
        return;
      }

      donorSubmitBtn.disabled = true;
      donorSubmitBtn.textContent = '⏳ Registering...';

      try {
        const res = await apiRequest('/donors/register', {
          method: 'POST',
          body: JSON.stringify({
            name: donorName,
            bloodGroup: donorBloodGroup,
            age: donorAge,
            gender: donorGender,
            district: donorDistrictVal,
            city: donorCity,
            phone: donorPhone,
            email: donorEmail || undefined,
          }),
        });

        showToast('🎉 Thank you for volunteering! Your registration is complete and your privacy is protected.');
        volunteerDonorForm.reset();
      } catch (err) {
        showToast(`❌ ${formatErrorMessage(err)}`);
      } finally {
        donorSubmitBtn.disabled = false;
        donorSubmitBtn.textContent = '❤️ Register as Volunteer Donor';
      }
    });
  }

  // --- 7. STAFF PORTAL BLOOD REQUESTS & INVENTORY ---
  async function loadStaffBloodRequests(filterStatus = 'all') {
    const container = document.getElementById('staffBloodRequestsContainer');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem;">Loading blood requests...</p>';

    try {
      const url = filterStatus && filterStatus !== 'all'
        ? `/blood-requests?status=${filterStatus}`
        : '/blood-requests';

      const res = await apiRequest(url);
      const reqs = res.data || [];
      cachedBloodRequests = reqs;

      if (!reqs.length) {
        container.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem;">No blood requests recorded.</p>';
        return;
      }

      // Sort: Emergency priority on top, then newest
      reqs.sort((a, b) => {
        const uA = (a.bloodRequirement?.urgency || a.urgency || '').toUpperCase();
        const uB = (b.bloodRequirement?.urgency || b.urgency || '').toUpperCase();
        if (uA === 'EMERGENCY' && uB !== 'EMERGENCY') return -1;
        if (uB === 'EMERGENCY' && uA !== 'EMERGENCY') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const userHospId = currentUser?.hospital?._id || currentUser?.hospitalId || currentUser?.hospital;

      container.innerHTML = reqs.map(r => {
        const urgencyVal = (r.bloodRequirement?.urgency || r.urgency || 'EMERGENCY').toUpperCase();
        const isEmergency = urgencyVal === 'EMERGENCY';
        const displayId = r.requestId || ('BR-' + (r._id ? r._id.slice(-5).toUpperCase() : ''));
        const patName = r.patient?.name || r.patientName || 'Patient';
        const patAge = r.patient?.age || r.patientAge;
        const patSex = r.patient?.gender || r.patientSex;
        const patHosp = r.patient?.currentHospital || 'In-Transit / Clinic';
        const patPhone = r.patient?.contactPhone || r.contactPhone || 'Private';
        const bGroup = r.bloodRequirement?.bloodGroup || r.bloodGroup || '';
        const bComp = r.bloodRequirement?.component || r.bloodComponent || 'Whole Blood';
        const bQty = r.bloodRequirement?.quantity || r.quantity || 1;
        const reqName = r.requester?.name || 'Citizen Requester';
        const reqRelation = r.requester?.relationshipToPatient || 'Friend';
        const reqContact = r.requester?.contact || patPhone;

        const myRecipient = (r.recipients || []).find(rec => String(rec.hospital?._id || rec.hospital) === String(userHospId));
        const myStatus = myRecipient ? myRecipient.status : r.status;

        // Status badges for each recipient hospital
        const recipientPills = (r.recipients || []).map(rec => {
          const hName = rec.hospital?.name || 'Hospital';
          const recStatus = rec.status || 'PENDING';
          const badgeClass = recStatus === 'ACCEPTED' || recStatus === 'BLOOD_RESERVED' ? 'approved' : (recStatus === 'REJECTED' ? 'rejected' : 'pending');
          return `<span class="status-badge ${badgeClass}" style="font-size: 0.72rem;">${escapeHtml(hName)}: ${escapeHtml(recStatus)}${rec.reservedUnits ? ' (' + rec.reservedUnits + 'u)' : ''}</span>`;
        }).join(' ');

        return `
          <div class="staff-blood-req-card ${isEmergency ? 'is-emergency' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="flex: 1;">
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
                  <span class="blood-urgency-badge ${escapeHtml(urgencyVal)}">
                    ⚠️ Urgency: <strong>${escapeHtml(urgencyVal)}</strong>
                  </span>
                  <span style="font-family: monospace; font-weight: 700; color: #be123c; font-size: 0.85rem;">${escapeHtml(displayId)}</span>
                  <span class="status-badge" style="font-size: 0.75rem;">${escapeHtml(myStatus)}</span>
                </div>

                <h4 style="margin: 4px 0 2px; font-size: 1.12rem; color: #0f172a;">
                  👤 Patient: <strong style="color: #be123c;">${escapeHtml(patName)}</strong>
                  <span style="font-size: 0.82rem; font-weight: normal; color: var(--muted);">(${patAge ? patAge + 'y' : 'Age —'}${patSex ? ', ' + escapeHtml(patSex) : ''})</span>
                </h4>

                <div style="font-size: 0.9rem; margin-top: 2px;">
                  🩸 Blood: <strong style="color: #be123c;">${escapeHtml(bGroup)} (${escapeHtml(bComp)})</strong> &nbsp;|&nbsp; 📦 Quantity: <strong>${bQty} Units</strong>
                </div>

                <div style="font-size: 0.84rem; color: var(--secondary); margin-top: 2px;">
                  🏥 Hospital / Location: <strong>${escapeHtml(patHosp)}</strong>
                </div>

                <div style="font-size: 0.82rem; color: #1e40af; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border: 1px solid #dbeafe; display: inline-block; margin-top: 4px;">
                  👤 Requested By: <strong>${escapeHtml(reqName)}</strong> (${escapeHtml(reqRelation)}) &middot; Contact: <strong>${escapeHtml(reqContact)}</strong>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-xs view-blood-detail-btn" data-id="${r._id}">View Details</button>
            </div>

            ${(r.reason || r.notes) ? `<div style="font-size: 0.82rem; font-style: italic; color: var(--secondary); margin-top: 4px;">"${escapeHtml(r.reason || r.notes)}"</div>` : ''}

            <!-- Multi-hospital recipient status preview -->
            <div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
              <span style="font-size: 0.72rem; color: var(--muted); font-weight: 600;">Recipients (${r.recipients?.length || 0}):</span>
              ${recipientPills}
            </div>

            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
              ${(myStatus === 'PENDING') ? `
                <button type="button" class="btn btn-blood btn-xs action-accept-blood" data-id="${r._id}">✅ Accept &amp; Reserve</button>
                <button type="button" class="btn btn-outline btn-xs action-partial-blood" data-id="${r._id}">⚡ Partial Accept</button>
                <button type="button" class="btn btn-danger btn-xs action-reject-blood" data-id="${r._id}">❌ Reject</button>
              ` : ''}

              ${(myStatus === 'BLOOD_RESERVED' || myStatus === 'ACCEPTED' || myStatus === 'PARTIALLY_ACCEPTED') ? `
                <button type="button" class="btn btn-primary btn-xs action-complete-blood" data-id="${r._id}">✔️ Complete Collection</button>
                <button type="button" class="btn btn-ghost btn-xs action-cancel-blood" data-id="${r._id}">Cancel Reservation</button>
              ` : ''}

              <button type="button" class="btn btn-outline btn-xs action-broadcast-donor" data-id="${r._id}" data-group="${escapeHtml(bGroup)}" data-units="${bQty}">
                📢 Broadcast to Donors
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Attach event listeners
      container.querySelectorAll('.view-blood-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => openBloodRequestDetailModal(btn.dataset.id));
      });

      container.querySelectorAll('.action-accept-blood').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/blood-requests/${btn.dataset.id}/accept`, { method: 'POST' });
            showToast('✅ Blood request accepted. Units reserved atomically in inventory.');
            loadStaffBloodRequests();
          } catch (e) {
            showToast(`❌ ${formatErrorMessage(e)}`);
          }
        });
      });

      container.querySelectorAll('.action-partial-blood').forEach(btn => {
        btn.addEventListener('click', () => {
          activeBloodRequestIdForAction = btn.dataset.id;
          if (bloodPartialAcceptModalOverlay) bloodPartialAcceptModalOverlay.hidden = false;
        });
      });

      container.querySelectorAll('.action-reject-blood').forEach(btn => {
        btn.addEventListener('click', () => {
          activeBloodRequestIdForAction = btn.dataset.id;
          if (bloodRejectModalOverlay) bloodRejectModalOverlay.hidden = false;
        });
      });

      container.querySelectorAll('.action-complete-blood').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/blood-requests/${btn.dataset.id}/complete`, { method: 'POST' });
            showToast('✔️ Blood collection completed. Stock finalized as used.');
            loadStaffBloodRequests();
          } catch (e) {
            showToast(`❌ ${formatErrorMessage(e)}`);
          }
        });
      });

      container.querySelectorAll('.action-cancel-blood').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/blood-requests/${btn.dataset.id}/cancel`, { method: 'POST' });
            showToast('Blood request cancelled. Stock released back to available pool.');
            loadStaffBloodRequests();
          } catch (e) {
            showToast(`❌ ${formatErrorMessage(e)}`);
          }
        });
      });

      container.querySelectorAll('.action-broadcast-donor').forEach(btn => {
        btn.addEventListener('click', () => {
          activeBloodRequestIdForAction = btn.dataset.id;
          if (donorBroadcastInfo) {
            donorBroadcastInfo.innerHTML = `
              <strong>Broadcast Target:</strong> All volunteer donors with blood group <strong>${btn.dataset.group}</strong>.<br>
              <strong>Units Urgently Needed:</strong> ${btn.dataset.units} units.
            `;
          }
          if (bloodDonorBroadcastModalOverlay) bloodDonorBroadcastModalOverlay.hidden = false;
        });
      });

    } catch (err) {
      container.innerHTML = `<p style="color: var(--muted); font-size: 0.88rem;">Error loading blood requests: ${err.message}</p>`;
    }
  }

  // Filter chips for blood requests
  document.querySelectorAll('.blood-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.blood-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadStaffBloodRequests(chip.dataset.status);
    });
  });

  // Prompt handlers
  if (partialCancelBtn) {
    partialCancelBtn.addEventListener('click', () => {
      if (bloodPartialAcceptModalOverlay) bloodPartialAcceptModalOverlay.hidden = true;
    });
  }

  if (partialConfirmBtn) {
    partialConfirmBtn.addEventListener('click', async () => {
      const units = parseInt(partialUnitsInput.value, 10);
      if (!units || units <= 0) {
        showToast('❌ Enter valid units.');
        return;
      }
      try {
        await apiRequest(`/blood-requests/${activeBloodRequestIdForAction}/partial-accept`, {
          method: 'POST',
          body: JSON.stringify({ availableUnits: units, notes: partialNotesInput.value.trim() }),
        });
        showToast(`✅ Partially accepted and reserved ${units} units.`);
        if (bloodPartialAcceptModalOverlay) bloodPartialAcceptModalOverlay.hidden = true;
        loadStaffBloodRequests();
      } catch (e) {
        showToast(`❌ ${formatErrorMessage(e)}`);
      }
    });
  }

  if (bloodRejectCancelBtn) {
    bloodRejectCancelBtn.addEventListener('click', () => {
      if (bloodRejectModalOverlay) bloodRejectModalOverlay.hidden = true;
    });
  }

  if (bloodRejectConfirmBtn) {
    bloodRejectConfirmBtn.addEventListener('click', async () => {
      const reason = bloodRejectReasonInput.value.trim();
      if (!reason) {
        showToast('❌ Rejection reason is mandatory.');
        return;
      }
      try {
        await apiRequest(`/blood-requests/${activeBloodRequestIdForAction}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        showToast('Blood request rejected.');
        if (bloodRejectModalOverlay) bloodRejectModalOverlay.hidden = true;
        loadStaffBloodRequests();
      } catch (e) {
        showToast(`❌ ${formatErrorMessage(e)}`);
      }
    });
  }

  if (donorBroadcastCancelBtn) {
    donorBroadcastCancelBtn.addEventListener('click', () => {
      if (bloodDonorBroadcastModalOverlay) bloodDonorBroadcastModalOverlay.hidden = true;
    });
  }

  if (donorBroadcastConfirmBtn) {
    donorBroadcastConfirmBtn.addEventListener('click', async () => {
      const phone = broadcastContactDetails.value.trim();
      if (!phone) {
        showToast('❌ Please provide contact phone for donors.');
        return;
      }
      try {
        const reqItem = cachedBloodRequests.find(r => r._id === activeBloodRequestIdForAction);
        const reqGroup = reqItem?.bloodRequirement?.bloodGroup || reqItem?.bloodGroup || 'O-';
        const reqQty = reqItem?.bloodRequirement?.quantity || reqItem?.quantity || 2;
        await apiRequest('/donors/emergency-broadcast', {
          method: 'POST',
          body: JSON.stringify({
            bloodGroup: reqGroup,
            unitsRequired: reqQty,
            contactDetails: phone,
          }),
        });
        showToast('📢 Emergency broadcast alert sent to registered donors!');
        if (bloodDonorBroadcastModalOverlay) bloodDonorBroadcastModalOverlay.hidden = true;
      } catch (e) {
        showToast(`❌ ${formatErrorMessage(e)}`);
      }
    });
  }

  // Details Modal
  async function openBloodRequestDetailModal(reqId) {
    if (!bloodRequestDetailModalOverlay) return;
    bloodRequestDetailModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const res = await apiRequest(`/blood-requests/${reqId}`);
      const req = res.data;
      const displayId = req.requestId || ('BR-' + (req._id ? req._id.slice(-5).toUpperCase() : ''));
      if (bloodDetailSubtitle) bloodDetailSubtitle.textContent = `Request ${displayId}`;
      if (bloodDetailStatusBadge) {
        bloodDetailStatusBadge.textContent = req.status;
        bloodDetailStatusBadge.className = `status-badge ${(req.status || '').toLowerCase()}`;
      }

      let recipientsTable = '<p style="color: var(--muted);">No recipient hospitals recorded.</p>';
      if (req.recipients && req.recipients.length) {
        recipientsTable = `
          <table class="staff-table" style="margin-top: 8px;">
            <thead>
              <tr>
                <th>Blood Bank</th>
                <th>Status</th>
                <th>Reserved</th>
                <th>Response Details</th>
              </tr>
            </thead>
            <tbody>
              ${req.recipients.map(rec => `
                <tr>
                  <td><strong>${escapeHtml(rec.hospital?.name || rec.hospital || 'Hospital')}</strong></td>
                  <td><span class="status-badge ${(rec.status || '').toLowerCase()}">${escapeHtml(rec.status)}</span></td>
                  <td>${rec.reservedUnits || 0} units</td>
                  <td>${escapeHtml(rec.responseReason || rec.notes || (rec.respondedAt ? 'Responded: ' + new Date(rec.respondedAt).toLocaleTimeString() : 'Awaiting action'))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      const patName = req.patient?.name || req.patientName || '—';
      const patAge = req.patient?.age || req.patientAge || '—';
      const patSex = req.patient?.gender || req.patientSex || '—';
      const patContact = req.patient?.contactPhone || req.contactPhone || 'Private';
      const patHosp = req.patient?.currentHospital || 'In-Transit / Clinic';
      const patDoc = req.patient?.attendingDoctor || 'Not specified';

      const reqName = req.requester?.name || 'Public Requester';
      const reqContact = req.requester?.contact || 'Private';
      const reqRole = req.requester?.role || 'USER';
      const reqRel = req.requester?.relationshipToPatient || 'Friend';

      const bGroup = req.bloodRequirement?.bloodGroup || req.bloodGroup || '';
      const bComp = req.bloodRequirement?.component || req.bloodComponent || 'Whole Blood';
      const bQty = req.bloodRequirement?.quantity || req.quantity || 1;
      const bUrg = req.bloodRequirement?.urgency || req.urgency || 'EMERGENCY';

      bloodDetailBody.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="admin-panel-card" style="background: #f8fafc; border: 1px solid #cbd5e1;">
            <h4 style="margin: 0 0 8px; font-size: 0.92rem; color: #991b1b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
              SECTION 1: PATIENT DETAILS
            </h4>
            <p style="margin: 0 0 5px;"><strong>Patient Name:</strong> <span style="font-size: 1.05rem; font-weight: 700; color: #0f172a;">${escapeHtml(patName)}</span></p>
            <p style="margin: 0 0 5px;"><strong>Age / Gender:</strong> ${patAge || '—'} Years / ${escapeHtml(patSex || '—')}</p>
            <p style="margin: 0 0 5px;"><strong>Attending Doctor / Hospital:</strong> ${escapeHtml(patDoc)} &middot; ${escapeHtml(patHosp)}</p>
            <p style="margin: 0;"><strong>Patient Contact:</strong> ${escapeHtml(patContact)}</p>
          </div>

          <div class="admin-panel-card" style="background: #eff6ff; border: 1px solid #bfdbfe;">
            <h4 style="margin: 0 0 8px; font-size: 0.92rem; color: #1e40af; border-bottom: 1px solid #dbeafe; padding-bottom: 4px;">
              SECTION 2: REQUESTER DETAILS
            </h4>
            <p style="margin: 0 0 5px;"><strong>Requester Name:</strong> <span style="font-size: 1.05rem; font-weight: 700; color: #1e40af;">${escapeHtml(reqName)}</span></p>
            <p style="margin: 0 0 5px;"><strong>Relationship to Patient:</strong> <span class="status-badge" style="background: #dbeafe; color: #1e40af; font-size: 0.75rem;">${escapeHtml(reqRel)}</span></p>
            <p style="margin: 0 0 5px;"><strong>Contact:</strong> ${escapeHtml(reqContact)}</p>
            <p style="margin: 0;"><strong>Role:</strong> ${escapeHtml(reqRole)}</p>
          </div>
        </div>

        <div class="admin-panel-card" style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 6px; font-size: 0.92rem;">C. Clinical Blood Requirement</h4>
          <p style="margin: 0 0 4px;"><strong>Blood Group &amp; Component:</strong> <strong style="color: #be123c;">${escapeHtml(bGroup)} (${escapeHtml(bComp)})</strong></p>
          <p style="margin: 0 0 4px;"><strong>Units Needed:</strong> ${bQty} Units</p>
          <p style="margin: 0 0 4px;"><strong>Clinical Urgency:</strong> <span class="blood-urgency-badge ${escapeHtml(bUrg)}">${escapeHtml(bUrg)}</span></p>
          <p style="margin: 0 0 4px;"><strong>Medical Indication:</strong> "${escapeHtml(req.reason || 'Emergency requirement')}"</p>
          ${req.notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${escapeHtml(req.notes)}</p>` : ''}
        </div>

        <div class="admin-panel-card">
          <h4 style="margin: 0 0 6px; font-size: 0.92rem;">D. Multi-Hospital Broadcast Status (${req.recipients ? req.recipients.length : 0} Facilities)</h4>
          <div class="table-responsive">${recipientsTable}</div>
        </div>
      `;

      bloodDetailActions.innerHTML = '<button type="button" class="btn btn-ghost" id="bloodDetailCloseBtn2">CLOSE</button>';
      document.getElementById('bloodDetailCloseBtn2')?.addEventListener('click', closeBloodRequestDetailModal);

    } catch (e) {
      bloodDetailBody.innerHTML = `<p style="color: var(--danger);">Error loading details: ${e.message}</p>`;
    }
  }

  function closeBloodRequestDetailModal() {
    if (bloodRequestDetailModalOverlay) bloodRequestDetailModalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  if (bloodDetailModalCloseBtn) bloodDetailModalCloseBtn.addEventListener('click', closeBloodRequestDetailModal);

  // --- 8. STAFF BLOOD INVENTORY MANAGEMENT ---
  async function loadStaffBloodInventory() {
    const container = document.getElementById('staffBloodInventoryContainer');
    const badges = document.getElementById('bloodInvSummaryBadges');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem;">Loading inventory records...</p>';

    try {
      const res = await apiRequest('/blood-inventory/all');
      const inv = res.data || [];

      if (badges) {
        badges.innerHTML = `
          <span class="status-badge available">Total Types: ${inv.length}</span>
          <span class="status-badge limited">Low Stock Alerts: ${res.lowStockCount || 0}</span>
        `;
      }

      if (!inv.length) {
        container.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem;">No inventory records available.</p>';
        return;
      }

      container.innerHTML = `
        <table class="staff-table" style="font-size: 0.84rem;">
          <thead>
            <tr>
              <th>Blood Group</th>
              <th>Component</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Used</th>
              <th>Total</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${inv.map(item => {
              const stClass = item.status === 'Available' ? 'available' : (item.status === 'Low Stock' ? 'limited' : 'full');
              return `
                <tr>
                  <td><strong>${escapeHtml(item.bloodGroup)}</strong></td>
                  <td>${escapeHtml(item.component)}</td>
                  <td><strong style="color: #16a34a; font-size: 1rem;">${item.availableUnits}</strong></td>
                  <td>${item.reservedUnits}</td>
                  <td>${item.usedUnits}</td>
                  <td>${item.totalUnits}</td>
                  <td><span class="status-badge ${stClass}">${escapeHtml(item.status)}</span></td>
                  <td>
                    <button type="button" class="btn btn-outline btn-xs edit-stock-btn" data-group="${escapeHtml(item.bloodGroup)}" data-component="${escapeHtml(item.component)}" data-total="${item.totalUnits}" data-min="${item.minThreshold}">
                      Edit
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      container.querySelectorAll('.edit-stock-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (invBloodGroup) invBloodGroup.value = btn.dataset.group;
          if (invComponent) invComponent.value = btn.dataset.component;
          if (invTotalUnits) invTotalUnits.value = btn.dataset.total;
          if (invMinThreshold) invMinThreshold.value = btn.dataset.min;
          if (updateStockModalOverlay) updateStockModalOverlay.hidden = false;
        });
      });

    } catch (e) {
      container.innerHTML = `<p style="color: var(--danger);">Error loading inventory: ${e.message}</p>`;
    }
  }

  if (openAddBloodStockBtn) {
    openAddBloodStockBtn.addEventListener('click', () => {
      if (updateStockModalOverlay) updateStockModalOverlay.hidden = false;
    });
  }

  if (updateStockCloseBtn) {
    updateStockCloseBtn.addEventListener('click', () => {
      if (updateStockModalOverlay) updateStockModalOverlay.hidden = true;
    });
  }

  if (updateStockCancelBtn) {
    updateStockCancelBtn.addEventListener('click', () => {
      if (updateStockModalOverlay) updateStockModalOverlay.hidden = true;
    });
  }

  if (updateStockForm) {
    updateStockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userHospId = currentUser?.hospital?._id || currentUser?.hospitalId || currentUser?.hospital;
      if (!userHospId) {
        showToast('❌ No hospital linked to logged-in user.');
        return;
      }

      try {
        await apiRequest('/blood-inventory/update', {
          method: 'POST',
          body: JSON.stringify({
            hospitalId: String(userHospId),
            bloodGroup: invBloodGroup.value,
            component: invComponent.value,
            totalUnits: parseInt(invTotalUnits.value, 10),
            minThreshold: parseInt(invMinThreshold.value, 10) || 5,
          }),
        });
        showToast('✅ Blood inventory updated.');
        if (updateStockModalOverlay) updateStockModalOverlay.hidden = true;
        loadStaffBloodInventory();
      } catch (err) {
        showToast(`❌ ${formatErrorMessage(err)}`);
      }
    });
  }

  // --- 9. EMERGENCY PATIENT INTAKE INTEGRATION ---
  // Hook into Patient Intake to offer one-click emergency blood request
  const intakeFormEl = document.getElementById('patientIntakeForm');
  if (intakeFormEl) {
    const origSubmit = intakeFormEl.onsubmit;
    document.addEventListener('patientIntakeCompleted', (e) => {
      const data = e.detail;
      const alertBox = document.getElementById('intakeAlertBox');
      if (alertBox) {
        const bloodBtn = document.createElement('div');
        bloodBtn.style.marginTop = '10px';
        bloodBtn.innerHTML = `
          <button type="button" class="btn btn-blood btn-sm" id="intakeReqBloodBtn">
            🩸 Request Emergency Blood for this Patient
          </button>
        `;
        alertBox.appendChild(bloodBtn);

        document.getElementById('intakeReqBloodBtn')?.addEventListener('click', () => {
          showBloodBankPortal(true);
          openBloodRequestModal(null, {
            patientName: data.patientName,
            patientAge: data.age,
            patientSex: data.sex,
            contactPhone: data.contactNumber,
            notes: data.symptoms || data.condition,
            district: data.district,
          });
        });
      }
    });
  }

  // --- 10. REAL-TIME SOCKET.IO LISTENERS FOR BLOOD ---
  if (typeof io !== 'undefined') {
    try {
      const bSocket = io();
      bSocket.on('bloodRequestCreated', (data) => {
        showToast('🔔 New emergency blood request broadcasted across network!');
        const userHospId = currentUser?.hospital?._id || currentUser?.hospitalId || currentUser?.hospital;
        if (userHospId) loadStaffBloodRequests();
      });

      bSocket.on('bloodRequestUpdated', () => {
        loadStaffBloodRequests();
      });

      bSocket.on('bloodInventoryUpdated', () => {
        loadStaffBloodInventory();
        fetchBloodBankStatistics();
      });
    } catch (e) {}
  }


  /* =====================================================
     16. 24×7 MEDICAL SHOP MODULE
     State-Wide Verified 24×7 Pharmacies, Proximity Sorting,
     Live MongoDB Atlas Data, Dynamic Google Maps Directions
     ===================================================== */

  const medicalShopPortal = document.getElementById('medicalShopPortal');
  const navMedicalShopBtn = document.getElementById('navMedicalShopBtn');
  const navMedicalShopLink = document.getElementById('navMedicalShopLink');
  const mobileMedicalShopBtn = document.getElementById('mobileMedicalShopBtn');
  const heroMedicalShopBtn = document.getElementById('heroMedicalShopBtn');
  const pharmacyNearMeHeroBtn = document.getElementById('pharmacyNearMeHeroBtn');
  const returnToBedTrackerFromPharmacyBtn = document.getElementById('returnToBedTrackerFromPharmacyBtn');

  const pharmacySearchForm = document.getElementById('pharmacySearchForm');
  const pharmacySearchInput = document.getElementById('pharmacySearchInput');
  const pharmacyDistrictSelect = document.getElementById('pharmacyDistrictSelect');
  const pharmacyOnly24x7Check = document.getElementById('pharmacyOnly24x7Check');
  const pharmacyNearMeBtn = document.getElementById('pharmacyNearMeBtn');
  const pharmacyResetSearchBtn = document.getElementById('pharmacyResetSearchBtn');
  const pharmacyEmptyResetBtn = document.getElementById('pharmacyEmptyResetBtn');

  const pharmacyCardsGrid = document.getElementById('pharmacyCardsGrid');
  const pharmacyLoadingBox = document.getElementById('pharmacyLoadingBox');
  const pharmacyAlertBox = document.getElementById('pharmacyAlertBox');
  const pharmacyEmptyState = document.getElementById('pharmacyEmptyState');
  const pharmacyResultsMeta = document.getElementById('pharmacyResultsMeta');
  const statTotalPharmacies = document.getElementById('statTotalPharmacies');

  let cachedMedicalShops = [];
  let pharmacyUserLocation = null;
  let isFetchingPharmacies = false;

  // Populate District Dropdown for Medical Shops
  if (pharmacyDistrictSelect && pharmacyDistrictSelect.options.length <= 1 && typeof DISTRICTS !== 'undefined') {
    DISTRICTS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      pharmacyDistrictSelect.appendChild(opt);
    });
  }

  /**
   * Generates dynamic Google Maps direction or search URL
   */
  function buildDynamicMapsUrl(shop) {
    if (shop.directionsUrl && shop.directionsUrl.startsWith('http')) {
      return shop.directionsUrl;
    }
    if (shop.googleMapsUrl && shop.googleMapsUrl.startsWith('http')) {
      return shop.googleMapsUrl;
    }
    if (shop.latitude != null && shop.longitude != null && !isNaN(shop.latitude) && !isNaN(shop.longitude)) {
      return `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
    }
    const parts = [shop.name, shop.address, shop.area, shop.city, shop.district, 'West Bengal']
      .filter(Boolean)
      .join(', ');
    if (parts.trim()) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.trim())}`;
    }
    return null;
  }

  /**
   * Render pharmacy cards list
   */
  function renderMedicalShopCards(shops) {
    if (!pharmacyCardsGrid) return;
    pharmacyCardsGrid.innerHTML = '';

    if (!Array.isArray(shops) || shops.length === 0) {
      if (pharmacyEmptyState) pharmacyEmptyState.hidden = false;
      if (pharmacyResultsMeta) pharmacyResultsMeta.textContent = 'Showing 0 verified 24×7 pharmacies';
      return;
    }

    if (pharmacyEmptyState) pharmacyEmptyState.hidden = true;
    if (pharmacyResultsMeta) {
      pharmacyResultsMeta.textContent = `Showing ${shops.length} verified 24×7 ${shops.length === 1 ? 'pharmacy' : 'pharmacies'} in West Bengal`;
    }

    shops.forEach(shop => {
      const card = document.createElement('div');
      card.className = 'pharmacy-card';
      card.setAttribute('data-shop-id', shop._id || '');

      const mapsUrl = buildDynamicMapsUrl(shop);
      const is24x7 = shop.is24x7 !== false;
      const distanceBadge = (shop.distance != null && !isNaN(shop.distance))
        ? `<div class="pharmacy-dist-badge">📍 ~${shop.distance} km away</div>`
        : '';

      const phoneLink = shop.phone
        ? `<a href="tel:${escapeHtml(shop.phone)}" class="pharmacy-phone-link">${escapeHtml(shop.phone)}</a>`
        : 'Contact unavailable';

      const altPhone = shop.alternatePhone
        ? ` <span style="color: var(--muted); font-size: 0.8rem;">/ <a href="tel:${escapeHtml(shop.alternatePhone)}" class="pharmacy-phone-link">${escapeHtml(shop.alternatePhone)}</a></span>`
        : '';

      const mapsBtnHtml = mapsUrl
        ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-maps" aria-label="Get directions to ${escapeHtml(shop.name)} on Google Maps">
             <span>🗺️</span> Open in Google Maps
           </a>`
        : `<button type="button" class="btn-maps btn-disabled" disabled aria-disabled="true">
             <span>📍</span> Location unavailable
           </button>`;

      card.innerHTML = `
        <div>
          <div class="pharmacy-card-head">
            <h3 class="pharmacy-card-title">${escapeHtml(shop.name)}</h3>
            ${is24x7 ? `<span class="pharmacy-24x7-badge"><span>🕐</span> Open 24×7</span>` : ''}
          </div>
          <div class="pharmacy-card-body">
            <div class="pharmacy-info-row">
              <span class="row-icon">📍</span>
              <div>
                <strong>${escapeHtml(shop.area || shop.city || '')}</strong> · ${escapeHtml(shop.district || 'West Bengal')}
                <div style="font-size: 0.82rem; color: var(--muted); margin-top: 2px;">${escapeHtml(shop.address || '')}${shop.landmark ? ` (Near ${escapeHtml(shop.landmark)})` : ''}</div>
                ${distanceBadge}
              </div>
            </div>
            <div class="pharmacy-info-row" style="margin-top: 10px;">
              <span class="row-icon">📞</span>
              <div>
                ${phoneLink}${altPhone}
              </div>
            </div>
          </div>
        </div>
        <div class="pharmacy-card-footer">
          ${mapsBtnHtml}
        </div>
      `;

      pharmacyCardsGrid.appendChild(card);
    });
  }

  /**
   * Fetch medical shops from backend API
   */
  async function fetchMedicalShops(customFilters = {}) {
    if (isFetchingPharmacies) return;
    isFetchingPharmacies = true;

    if (pharmacyLoadingBox) pharmacyLoadingBox.hidden = false;
    if (pharmacyAlertBox) pharmacyAlertBox.hidden = true;
    if (pharmacyEmptyState) pharmacyEmptyState.hidden = true;
    if (pharmacyCardsGrid) pharmacyCardsGrid.innerHTML = '';

    try {
      const params = new URLSearchParams();

      const searchVal = customFilters.search !== undefined
        ? customFilters.search
        : (pharmacySearchInput ? pharmacySearchInput.value.trim() : '');
      if (searchVal) params.append('search', searchVal);

      const districtVal = customFilters.district !== undefined
        ? customFilters.district
        : (pharmacyDistrictSelect ? pharmacyDistrictSelect.value : 'all');
      if (districtVal && districtVal !== 'all') params.append('district', districtVal);

      const is24x7Val = customFilters.is24x7 !== undefined
        ? customFilters.is24x7
        : (pharmacyOnly24x7Check ? pharmacyOnly24x7Check.checked : true);
      if (is24x7Val) params.append('is24x7', 'true');

      // Geolocation
      const userLoc = customFilters.coords || pharmacyUserLocation || userGeoLocation;
      if (userLoc && userLoc.latitude != null && userLoc.longitude != null) {
        params.append('latitude', String(userLoc.latitude));
        params.append('longitude', String(userLoc.longitude));
      }

      params.append('limit', '60');

      const url = `/medical-shops?${params.toString()}`;
      const res = await apiRequest(url);

      if (res && res.success && Array.isArray(res.medicalShops)) {
        cachedMedicalShops = res.medicalShops;
        renderMedicalShopCards(cachedMedicalShops);
        if (statTotalPharmacies && res.count) {
          statTotalPharmacies.textContent = `${res.count}+`;
        }
      } else {
        cachedMedicalShops = [];
        renderMedicalShopCards([]);
      }
    } catch (err) {
      console.error('Error fetching medical shops:', err);
      if (pharmacyAlertBox) {
        pharmacyAlertBox.hidden = false;
        pharmacyAlertBox.textContent = `⚠️ ${formatErrorMessage(err) || 'Unable to load 24×7 medical shops right now. Please try again.'}`;
      }
      if (pharmacyCardsGrid) pharmacyCardsGrid.innerHTML = '';
      if (pharmacyEmptyState) pharmacyEmptyState.hidden = true;
    } finally {
      if (pharmacyLoadingBox) pharmacyLoadingBox.hidden = true;
      isFetchingPharmacies = false;
    }
  }

  /**
   * Show Medical Shop Portal (hiding homepage and Blood Bank Portal)
   */
  function showMedicalShopPortal(updateHistory = true) {
    if (!medicalShopPortal) return;
    if (bloodBankPortal) bloodBankPortal.hidden = true;
    const ambPortal = document.getElementById('ambulancePortal');
    if (ambPortal) ambPortal.hidden = true;

    const mainSections = document.querySelectorAll('#main-content > section:not(#medicalShopPortal)');
    mainSections.forEach(s => (s.hidden = true));
    medicalShopPortal.hidden = false;

    window.scrollTo({ top: 0, left: 0 });

    if (mobileMenu && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
      if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
    }

    if (updateHistory && window.location.hash !== '#medical-shops') {
      history.pushState({ view: 'medical-shops' }, '', '#medical-shops');
    }

    fetchMedicalShops();
  }

  // Make available globally for hash navigation sync
  window.showMedicalShopPortal = showMedicalShopPortal;

  // Wire up Medical Shop Portal buttons
  [navMedicalShopBtn, navMedicalShopLink, mobileMedicalShopBtn, heroMedicalShopBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showMedicalShopPortal(true);
      });
    }
  });

  if (returnToBedTrackerFromPharmacyBtn) {
    returnToBedTrackerFromPharmacyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToOriginalHome(true);
    });
  }

  // Search form submission
  if (pharmacySearchForm) {
    pharmacySearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      fetchMedicalShops();
    });
  }

  // Filter dropdown change
  if (pharmacyDistrictSelect) {
    pharmacyDistrictSelect.addEventListener('change', () => {
      fetchMedicalShops();
    });
  }

  // 24x7 Checkbox toggle
  if (pharmacyOnly24x7Check) {
    pharmacyOnly24x7Check.addEventListener('change', () => {
      fetchMedicalShops();
    });
  }

  // Reset filters
  function resetPharmacyFilters() {
    if (pharmacySearchInput) pharmacySearchInput.value = '';
    if (pharmacyDistrictSelect) pharmacyDistrictSelect.value = 'all';
    if (pharmacyOnly24x7Check) pharmacyOnly24x7Check.checked = true;
    pharmacyUserLocation = null;
    fetchMedicalShops();
  }

  if (pharmacyResetSearchBtn) {
    pharmacyResetSearchBtn.addEventListener('click', resetPharmacyFilters);
  }
  if (pharmacyEmptyResetBtn) {
    pharmacyEmptyResetBtn.addEventListener('click', resetPharmacyFilters);
  }

  // Near Me / Geolocation Proximity button
  function requestPharmacyNearMe() {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser');
      return;
    }

    showToast('📍 Getting your current location for nearest pharmacies...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pharmacyUserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        userGeoLocation = pharmacyUserLocation;
        showToast('📍 Location detected! Sorting 24×7 pharmacies by proximity.');
        fetchMedicalShops({ coords: pharmacyUserLocation });
      },
      (err) => {
        console.warn('Geolocation error:', err);
        showToast('⚠️ Location access was denied or unavailable. Showing all statewide 24×7 pharmacies.');
        fetchMedicalShops();
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  if (pharmacyNearMeBtn) {
    pharmacyNearMeBtn.addEventListener('click', requestPharmacyNearMe);
  }
  if (pharmacyNearMeHeroBtn) {
    pharmacyNearMeHeroBtn.addEventListener('click', () => {
      showMedicalShopPortal(true);
      requestPharmacyNearMe();
    });
  }

  // Check initial hash on load for #medical-shops
  if (window.location.hash === '#medical-shops') {
    showMedicalShopPortal(false);
  }

  /* =====================================================
     16.5. LIVE AMBULANCE FINDER MODULE
     Frontend-Only Mock Demonstration for Emergency Ambulance
     Discovery, Triage Priority, Interactive Map, Modals, & Requests
     ===================================================== */

  // --- MOCK AMBULANCE DATA (16 Units Statewide & Cross-Border) ---
  const MOCK_AMBULANCES = [
    {
      id: 'AMB-101',
      unitCode: 'WB-01-AL-2045',
      type: 'ALS',
      typeName: 'Advanced Life Support (ALS)',
      provider: 'Apollo Emergency Fleet',
      baseArea: 'Kolkata Central (Park Street)',
      district: 'Kolkata',
      latitude: 22.5520,
      longitude: 88.3530,
      distance: 2.1,
      eta: '6–9 min',
      status: 'AVAILABLE',
      equipment: [
        'Multiparameter Cardiac Monitor',
        'Portable Oxygen Cylinder (Type D)',
        'Transport Ventilator (Adult/Pediatric)',
        'Biphasic Defibrillator (AED)',
        'Motorized Suction Unit',
        'Spine Board & Cervical Collar Set',
        'Emergency Drug Kit & IV Infusion',
        'Pulse Oximeter & BP Monitor'
      ],
      crew: 'Paramedic EMT-P + Emergency Driver (Demo)',
      vehicleReg: 'WB 01 AL 2045',
      phone: '033-2280-9999 (Demo)',
      notes: 'Fully sanitized, on-board telemetry ready.'
    },
    {
      id: 'AMB-102',
      unitCode: 'WB-02-IC-3108',
      type: 'ICU',
      typeName: 'ICU / Critical Care Transport',
      provider: 'SSKM Critical Care Transit',
      baseArea: 'Bhowanipore / SSKM',
      district: 'Kolkata',
      latitude: 22.5398,
      longitude: 88.3426,
      distance: 3.4,
      eta: '9–13 min',
      status: 'AVAILABLE',
      equipment: [
        'ICU Grade Transport Ventilator',
        'Advanced Cardiac Life Support Monitor',
        'Dual Syringe & Infusion Pumps',
        'Central Medical Gas System & Dual O2',
        'Arterial Blood Gas (ABG) Kit',
        'Emergency Resuscitation Medications',
        'Intubation Set & Video Laryngoscope',
        'Vacuum Mattress & Stretcher'
      ],
      crew: 'Critical Care Medical Officer + EMT-A (Demo)',
      vehicleReg: 'WB 02 IC 3108',
      phone: '033-2223-1122 (Demo)',
      notes: 'Doctor-on-board critical transport certified.'
    },
    {
      id: 'AMB-103',
      unitCode: 'WB-04-BL-1892',
      type: 'BLS',
      typeName: 'Basic Life Support (BLS)',
      provider: 'St. John Ambulance WB',
      baseArea: 'Kankurgachi / Phoolbagan',
      district: 'Kolkata',
      latitude: 22.5780,
      longitude: 88.3890,
      distance: 2.8,
      eta: '7–11 min',
      status: 'AVAILABLE',
      equipment: [
        'High Flow Oxygen Delivery System',
        'Foldable Stretcher & Scoop Stretcher',
        'First Aid & Trauma Bandaging Kit',
        'Manual Resuscitator (Ambu Bag)',
        'Automated External Defibrillator (AED)',
        'Blood Glucose Monitor & Pulse Oximeter'
      ],
      crew: 'First Responder EMT-B + Certified Driver (Demo)',
      vehicleReg: 'WB 04 BL 1892',
      phone: '033-2334-4500 (Demo)',
      notes: 'Standard basic emergency transfer.'
    },
    {
      id: 'AMB-104',
      unitCode: 'WB-06-PT-4512',
      type: 'PT',
      typeName: 'Patient Transport Vehicle (PTV)',
      provider: 'Lifeline Medi-Van Services',
      baseArea: 'Salt Lake Sector II',
      district: 'North 24 Parganas',
      latitude: 22.5855,
      longitude: 88.4120,
      distance: 4.6,
      eta: '12–16 min',
      status: 'AVAILABLE',
      equipment: [
        'Wheelchair Ramp & Securing Harness',
        'Hydraulic Stretcher System',
        'Basic First Aid & Cold Packs',
        'Low Flow Oxygen Support (Optional)',
        'Companion Seating'
      ],
      crew: 'Driver Attendant + Patient Care Assistant (Demo)',
      vehicleReg: 'WB 06 PT 4512',
      phone: '033-2358-8877 (Demo)',
      notes: 'Ideal for non-critical transfers, dialysis trips, and hospital discharges.'
    },
    {
      id: 'AMB-105',
      unitCode: 'WB-01-NI-5501',
      type: 'NICU',
      typeName: 'Neonatal / Pediatric ICU (NICU)',
      provider: 'Chittaranjan Seva Sadan Specialized Unit',
      baseArea: 'Kalighat / Hazra',
      district: 'Kolkata',
      latitude: 22.5230,
      longitude: 88.3490,
      distance: 4.8,
      eta: '14–18 min',
      status: 'AVAILABLE',
      equipment: [
        'Neonatal Transport Incubator',
        'Neonatal Ventilator (High-Frequency capable)',
        'Infant Resuscitation Warmer Unit',
        'Micro-Infusion Syringe Pumps',
        'Pediatric Pulse Oximeter & Monitor',
        'Medical Grade Air & Oxygen Blender'
      ],
      crew: 'Neonatal Intensive Care Nurse + Pediatric EMT (Demo)',
      vehicleReg: 'WB 01 NI 5501',
      phone: '033-2475-6677 (Demo)',
      notes: 'Customized suspension for infant vibration dampening.'
    },
    {
      id: 'AMB-106',
      unitCode: 'WB-03-AL-9014',
      type: 'ALS',
      typeName: 'Advanced Life Support (ALS)',
      provider: 'Howrah General Emergency Response',
      baseArea: 'Howrah Station / Mandirtala',
      district: 'Howrah',
      latitude: 22.5840,
      longitude: 88.3180,
      distance: 5.2,
      eta: '15–20 min',
      status: 'BUSY',
      equipment: [
        'Cardiac Monitor & Defibrillator',
        'Adult Transport Ventilator',
        'Dual Oxygen Cylinders',
        'Cervical Immobilization Gear',
        'IV Cannulation & Drug Kit'
      ],
      crew: 'Paramedic EMT-P + Driver (Demo)',
      vehicleReg: 'WB 03 AL 9014',
      phone: '033-2641-2300 (Demo)',
      notes: 'Currently on emergency call near Nabanna. ETA updates upon dispatch clearance.'
    },
    {
      id: 'AMB-107',
      unitCode: 'WB-05-MO-6623',
      type: 'MORTUARY',
      typeName: 'Mortuary Freezer Van',
      provider: 'Peaceful Transit WB Support',
      baseArea: 'Sealdah / Entally',
      district: 'Kolkata',
      latitude: 22.5640,
      longitude: 88.3710,
      distance: 1.8,
      eta: '8–12 min',
      status: 'AVAILABLE',
      equipment: [
        'Sub-Zero Temperature Storage Cabinet',
        'Stainless Steel Roll-in Body Tray',
        'Formalin / Hygiene Containment Seal',
        'Hydraulic Loading Platform',
        'Deodorizing Air Filtration System'
      ],
      crew: 'Sanitation Care Assistant + Driver (Demo)',
      vehicleReg: 'WB 05 MO 6623',
      phone: '033-2265-1100 (Demo)',
      notes: 'Dignified transfer for post-mortem, inter-city, or funeral arrangements.'
    },
    {
      id: 'AMB-108',
      unitCode: 'WB-01-BL-7719',
      type: 'BLS',
      typeName: 'Basic Life Support (BLS)',
      provider: 'Red Cross Society Bengal',
      baseArea: 'College Street / Bowbazar',
      district: 'Kolkata',
      latitude: 22.5710,
      longitude: 88.3610,
      distance: 1.2,
      eta: '5–8 min',
      status: 'AVAILABLE',
      equipment: [
        'Oxygen Cylinder & Mask Kit',
        'Multi-Position Stretcher',
        'Standard Trauma Kit',
        'Manual Suction Apparatus',
        'Ambu Bag & Oropharyngeal Airways'
      ],
      crew: 'Certified Red Cross Volunteer + EMT (Demo)',
      vehicleReg: 'WB 01 BL 7719',
      phone: '033-2241-7890 (Demo)',
      notes: 'Rapid local responder for Central Kolkata.'
    },
    {
      id: 'AMB-109',
      unitCode: 'WB-02-IC-8840',
      type: 'ICU',
      typeName: 'ICU / Critical Care Transport',
      provider: 'Ruby Emergency & Critical Care',
      baseArea: 'Ruby Golpark / Kasba',
      district: 'Kolkata',
      latitude: 22.5130,
      longitude: 88.3990,
      distance: 6.5,
      eta: '16–22 min',
      status: 'AVAILABLE',
      equipment: [
        'Transport Ventilator (Invasive/Non-Invasive)',
        'ECG / Defibrillator with Pacing',
        'Multiparameter Vital Signs Monitor',
        'Infusion Pumps (3 channels)',
        'Direct Laryngoscope & Suction',
        'Emergency Resuscitation Tray'
      ],
      crew: 'Emergency Physician + EMT-P (Demo)',
      vehicleReg: 'WB 02 IC 8840',
      phone: '033-2442-9900 (Demo)',
      notes: 'Equipped for critical inter-hospital ECMO and ventilator transfers.'
    },
    {
      id: 'AMB-110',
      unitCode: 'WB-04-AL-1288',
      type: 'ALS',
      typeName: 'Advanced Life Support (ALS)',
      provider: 'Medica Superspecialty Mobile Unit',
      baseArea: 'Mukundapur / EM Bypass',
      district: 'Kolkata',
      latitude: 22.4980,
      longitude: 88.4010,
      distance: 7.8,
      eta: '18–24 min',
      status: 'AVAILABLE',
      equipment: [
        'Advanced Defibrillator & Cardiac Pacer',
        'Hamilton T1 Transport Ventilator',
        'Dual Oxygen Cylinders',
        'Point-of-Care Ultrasound (POCUS Demo)',
        'Emergency Drug Supply'
      ],
      crew: 'Emergency Medical Technician + Driver (Demo)',
      vehicleReg: 'WB 04 AL 1288',
      phone: '033-6652-0000 (Demo)',
      notes: 'High-speed highway corridor responder.'
    },
    {
      id: 'AMB-111',
      unitCode: 'WB-07-BL-3344',
      type: 'BLS',
      typeName: 'Basic Life Support (BLS)',
      provider: 'Barasat Sub-Divisional Fleet',
      baseArea: 'Barasat / Jessore Road',
      district: 'North 24 Parganas',
      latitude: 22.7210,
      longitude: 88.4820,
      distance: 18.5,
      eta: '25–35 min',
      status: 'AVAILABLE',
      equipment: [
        'Oxygen Cylinder & Regulator',
        'Folding Stretcher',
        'Basic Dressing & Burn Sheets',
        'AED Defibrillator'
      ],
      crew: 'District EMT + Driver (Demo)',
      vehicleReg: 'WB 07 BL 3344',
      phone: '033-2584-1100 (Demo)',
      notes: 'Suburban coverage for North 24 Parganas.'
    },
    {
      id: 'AMB-112',
      unitCode: 'WB-19-AL-4455',
      type: 'ALS',
      typeName: 'Advanced Life Support (ALS)',
      provider: 'Durgapur Steel Plant Emergency Care',
      baseArea: 'City Centre, Durgapur',
      district: 'Paschim Bardhaman',
      latitude: 23.5350,
      longitude: 87.2980,
      distance: 165.0,
      eta: '10–15 min (Local)',
      status: 'AVAILABLE',
      equipment: [
        'Cardiac Monitor & Defibrillator',
        'Transport Ventilator',
        'Trauma Immobilization Gear',
        'Emergency Resuscitation Drugs'
      ],
      crew: 'Industrial Paramedic + Driver (Demo)',
      vehicleReg: 'WB 19 AL 4455',
      phone: '0343-254-5500 (Demo)',
      notes: 'Serving Paschim Bardhaman and industrial corridor.'
    },
    {
      id: 'AMB-113',
      unitCode: 'WB-73-IC-9912',
      type: 'ICU',
      typeName: 'ICU / Critical Care Transport',
      provider: 'North Bengal Medical College Transit',
      baseArea: 'Siliguri / Sushrutanagar',
      district: 'Darjeeling',
      latitude: 26.6950,
      longitude: 88.3720,
      distance: 480.0,
      eta: '12–18 min (Local)',
      status: 'AVAILABLE',
      equipment: [
        'ICU Ventilator with PEEP',
        'Cardiac Defibrillator & Monitor',
        'Infusion Pumps',
        'Air-Oxygen Mixer Unit'
      ],
      crew: 'Medical Officer + EMT-A (Demo)',
      vehicleReg: 'WB 73 IC 9912',
      phone: '0353-257-2200 (Demo)',
      notes: 'Serving North Bengal foothills, Siliguri, and Darjeeling region.'
    },
    {
      id: 'AMB-114',
      unitCode: 'JH-05-AL-6677',
      type: 'ALS',
      typeName: 'Advanced Life Support (ALS)',
      provider: 'Tata Main Hospital Emergency Fleet',
      baseArea: 'Bistupur, Jamshedpur',
      district: 'Jamshedpur Border',
      latitude: 22.8020,
      longitude: 86.1850,
      distance: 240.0,
      eta: '10–15 min (Local)',
      status: 'AVAILABLE',
      equipment: [
        'Advanced Cardiac Monitor',
        'Oxygen Generator Unit',
        'Portable Ventilator',
        'Emergency Medication Kit'
      ],
      crew: 'Certified EMT + Driver (Demo)',
      vehicleReg: 'JH 05 AL 6677',
      phone: '0657-222-4455 (Demo)',
      notes: 'Cross-border emergency liaison unit for West Bengal / Jharkhand corridor.'
    },
    {
      id: 'AMB-115',
      unitCode: 'WB-01-PT-9800',
      type: 'PT',
      typeName: 'Patient Transport Vehicle (PTV)',
      provider: 'Kolkata Municipal Health Fleet',
      baseArea: 'Tollygunge / Kudghat',
      district: 'Kolkata',
      latitude: 22.4850,
      longitude: 88.3470,
      distance: 8.2,
      eta: '20–25 min',
      status: 'OFFLINE',
      equipment: [
        'Basic Stretcher & Wheelchair Ramp',
        'Standard First Aid Box'
      ],
      crew: 'Driver Attendant (Demo)',
      vehicleReg: 'WB 01 PT 9800',
      phone: '033-2411-9988 (Demo)',
      notes: 'Currently undergoing scheduled vehicle maintenance.'
    },
    {
      id: 'AMB-116',
      unitCode: 'WB-02-AL-5521',
      type: 'ALS',
      typeName: 'Advanced Life Support (ALS)',
      provider: 'Fortis Hospital Anandapur Rapid Unit',
      baseArea: 'Anandapur / EM Bypass',
      district: 'Kolkata',
      latitude: 22.5100,
      longitude: 88.4010,
      distance: 6.9,
      eta: '14–19 min',
      status: 'AVAILABLE',
      equipment: [
        'Cardiac Monitor & 12-lead ECG',
        'Transport Ventilator',
        'Defibrillator / Pacer',
        'IV Syringe Pump',
        'Suction System'
      ],
      crew: 'Paramedic + Driver (Demo)',
      vehicleReg: 'WB 02 AL 5521',
      phone: '033-6628-4444 (Demo)',
      notes: 'Rapid deployment unit covering South-East Kolkata bypass.'
    }
  ];

  // --- MOCK RECENT REQUESTS ---
  let MOCK_RECENT_REQUESTS = [
    {
      requestId: 'DEMO-AMB-8831',
      unitCode: 'WB-01-AL-2045',
      type: 'Advanced Life Support (ALS)',
      patientName: 'Anirban Sen (Demo)',
      pickup: 'Salt Lake Sector V, Kolkata',
      destination: 'Apollo Multispeciality Hospitals',
      priority: 'Urgent',
      status: 'Dispatched (Demo)',
      eta: '~9 min',
      timeAgo: '12 mins ago'
    },
    {
      requestId: 'DEMO-AMB-7740',
      unitCode: 'WB-02-IC-3108',
      type: 'ICU / Critical Care Transport',
      patientName: 'Devika Mukherjee (Demo)',
      pickup: 'Elgin Road, Kolkata',
      destination: 'SSKM Trauma Centre',
      priority: 'Critical',
      status: 'En Route (Demo)',
      eta: '~6 min',
      timeAgo: '28 mins ago'
    },
    {
      requestId: 'DEMO-AMB-6502',
      unitCode: 'WB-04-BL-1892',
      type: 'Basic Life Support (BLS)',
      patientName: 'Kajal Roy (Demo)',
      pickup: 'Phoolbagan, Kolkata',
      destination: 'Calcutta National Medical College',
      priority: 'Non-Critical',
      status: 'Completed (Demo)',
      eta: 'Arrived',
      timeAgo: '1 hour ago'
    }
  ];

  // --- LOCATION COORDINATES REFERENCE ---
  const LOCATION_COORDS = {
    'kolkata': [22.5726, 88.3639],
    'kolkata central': [22.5697, 88.3697],
    'park street': [22.5520, 88.3530],
    'salt lake': [22.5855, 88.4120],
    'howrah': [22.5958, 88.2636],
    'jadavpur': [22.4990, 88.3710],
    'alipore': [22.5330, 88.3300],
    'bhowanipore': [22.5398, 88.3426],
    'sskm': [22.5398, 88.3426],
    'shyambazar': [22.6030, 88.3760],
    'kankurgachi': [22.5820, 88.3960],
    'kasba': [22.5140, 88.3850],
    'new alipore': [22.5090, 88.3320],
    'anandapur': [22.5100, 88.3980],
    'durgapur': [23.5204, 87.3119],
    'asansol': [23.6739, 86.9524],
    'siliguri': [26.7271, 88.3953],
    'darjeeling': [27.0360, 88.2627],
    'malda': [25.0088, 88.1414],
    'murshidabad': [24.0965, 88.2517],
    'berhampore': [24.0965, 88.2517],
    'nadia': [22.9750, 88.4340],
    'kalyani': [22.9750, 88.4340],
    'kharagpur': [22.3460, 87.2320],
    'medinipur': [22.4200, 87.3200],
    'haldia': [22.0667, 88.0698],
    'bankura': [23.2324, 87.0740],
    'purulia': [23.3320, 86.3650],
    'jalpaiguri': [26.5433, 88.7293],
    'cooch behar': [26.3260, 89.4470],
    'alipurduar': [26.4919, 89.5271],
    'birbhum': [23.9200, 87.5340],
    'suri': [23.9200, 87.5340],
    'jamshedpur': [22.8020, 86.1850]
  };

  // --- AMBULANCE DOM ELEMENTS ---
  const ambulancePortal = document.getElementById('ambulancePortal');
  const navAmbulanceBtn = document.getElementById('navAmbulanceBtn');
  const navAmbulanceLink = document.getElementById('navAmbulanceLink');
  const mobileAmbulanceBtn = document.getElementById('mobileAmbulanceBtn');
  const ambulanceLauncherBtn = document.getElementById('ambulanceLauncherBtn');
  const ambulanceBackHomeBtn = document.getElementById('ambulanceBackHomeBtn');

  // Search Form Elements
  const ambulanceSearchForm = document.getElementById('ambulanceSearchForm');
  const ambulanceLocationInput = document.getElementById('ambulanceLocationInput');
  const ambulanceUseLocationBtn = document.getElementById('ambulanceUseLocationBtn');
  const ambulanceLocationHint = document.getElementById('ambulanceLocationHint');
  const ambulanceRadiusSelect = document.getElementById('ambulanceRadiusSelect');
  const ambTypeCards = document.querySelectorAll('.amb-type-card');
  const ambPriorityInputs = document.querySelectorAll('input[name="ambPriority"]');
  const ambulanceSearchBtn = document.getElementById('ambulanceSearchBtn');
  const ambulanceResetSearchBtn = document.getElementById('ambulanceResetSearchBtn');

  // Results & Layout Elements
  const ambulanceResultsCountText = document.getElementById('ambulanceResultsCountText');
  const ambulanceCountNum = document.getElementById('ambulanceCountNum');
  const ambulanceRadiusLabel = document.getElementById('ambulanceRadiusLabel');
  const ambulanceAvailableOnlyCheck = document.getElementById('ambulanceAvailableOnlyCheck');
  const ambulanceSortSelect = document.getElementById('ambulanceSortSelect');
  const ambulanceLoadingCard = document.getElementById('ambulanceLoadingCard');
  const ambulanceEmptyCard = document.getElementById('ambulanceEmptyCard');
  const ambulanceEmptyReasonText = document.getElementById('ambulanceEmptyReasonText');
  const ambulanceExpandRadiusBtn = document.getElementById('ambulanceExpandRadiusBtn');
  const ambulanceResetFiltersBtn = document.getElementById('ambulanceResetFiltersBtn');
  const ambulanceCardsList = document.getElementById('ambulanceCardsList');
  const ambulanceRecentList = document.getElementById('ambulanceRecentList');

  // Details Modal Elements
  const ambulanceDetailsModal = document.getElementById('ambulanceDetailsModal');
  const ambDetailsCloseBtn = document.getElementById('ambDetailsCloseBtn');
  const ambDetailsCancelBtn = document.getElementById('ambDetailsCancelBtn');
  const ambDetailsRequestActionBtn = document.getElementById('ambDetailsRequestActionBtn');
  const ambDetailsTitle = document.getElementById('ambDetailsTitle');
  const ambDetailsTypeBadge = document.getElementById('ambDetailsTypeBadge');
  const ambDetailsStatus = document.getElementById('ambDetailsStatus');
  const ambDetailsEta = document.getElementById('ambDetailsEta');
  const ambDetailsReg = document.getElementById('ambDetailsReg');
  const ambDetailsDistance = document.getElementById('ambDetailsDistance');
  const ambDetailsProvider = document.getElementById('ambDetailsProvider');
  const ambDetailsArea = document.getElementById('ambDetailsArea');
  const ambDetailsEquipmentList = document.getElementById('ambDetailsEquipmentList');
  const ambDetailsCrew = document.getElementById('ambDetailsCrew');

  // Request Modal Elements
  const ambulanceRequestModal = document.getElementById('ambulanceRequestModal');
  const ambRequestCloseBtn = document.getElementById('ambRequestCloseBtn');
  const ambRequestCancelBtn = document.getElementById('ambRequestCancelBtn');
  const ambRequestUnitId = document.getElementById('ambRequestUnitId');
  const ambRequestUnitType = document.getElementById('ambRequestUnitType');
  const ambRequestUnitDist = document.getElementById('ambRequestUnitDist');
  const ambRequestUnitEta = document.getElementById('ambRequestUnitEta');
  const ambulanceConfirmForm = document.getElementById('ambulanceConfirmForm');
  const ambReqPatientName = document.getElementById('ambReqPatientName');
  const ambReqPhone = document.getElementById('ambReqPhone');
  const ambReqPickup = document.getElementById('ambReqPickup');
  const ambReqDestination = document.getElementById('ambReqDestination');
  const ambReqPrioritySelect = document.getElementById('ambReqPrioritySelect');
  const ambReqNotes = document.getElementById('ambReqNotes');
  const ambRequestSubmitBtn = document.getElementById('ambRequestSubmitBtn');

  // Success Modal Elements
  const ambulanceSuccessModal = document.getElementById('ambulanceSuccessModal');
  const ambSuccessCloseBtn = document.getElementById('ambSuccessCloseBtn');
  const ambSuccessId = document.getElementById('ambSuccessId');
  const ambSuccessUnit = document.getElementById('ambSuccessUnit');
  const ambSuccessType = document.getElementById('ambSuccessType');
  const ambSuccessStatus = document.getElementById('ambSuccessStatus');
  const ambSuccessEta = document.getElementById('ambSuccessEta');
  const ambSuccessPickup = document.getElementById('ambSuccessPickup');
  const ambSuccessDest = document.getElementById('ambSuccessDest');

  // --- AMBULANCE MODULE STATE ---
  let activeAmbulanceType = 'all';
  let activeAmbulancePriority = 'Urgent';
  let activeAmbulanceForModal = null;
  let currentSearchCenter = [22.5697, 88.3697]; // Kolkata Central default
  let ambulanceLeafletMap = null;
  let ambulanceMarkersLayer = null;

  // --- 1. SHOW / HIDE AMBULANCE PORTAL ---
  function showAmbulancePortal(updateHistory = true) {
    if (!ambulancePortal) return;

    if (bloodBankPortal) bloodBankPortal.hidden = true;
    const medPortal = document.getElementById('medicalShopPortal');
    if (medPortal) medPortal.hidden = true;

    const mainSections = document.querySelectorAll('#main-content > section:not(#ambulancePortal)');
    mainSections.forEach(s => (s.hidden = true));
    ambulancePortal.hidden = false;

    window.scrollTo({ top: 0, left: 0 });

    if (mobileMenu && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
      if (hamburgerBtn) hamburgerBtn.setAttribute('aria-expanded', 'false');
    }

    if (updateHistory && window.location.hash !== '#ambulance') {
      history.pushState({ view: 'ambulance' }, '', '#ambulance');
    }

    initAmbulanceMap();
    if (ambulanceLeafletMap) {
      setTimeout(() => {
        try {
          ambulanceLeafletMap.invalidateSize();
        } catch (e) {
          console.warn('Map resize error:', e);
        }
      }, 250);
    }

    executeAmbulanceSearch();
    renderRecentAmbulanceRequests();
  }

  window.showAmbulancePortal = showAmbulancePortal;

  // --- 2. LEAFLET MAP INTEGRATION ---
  function initAmbulanceMap() {
    const mapEl = document.getElementById('ambulanceMap');
    if (!mapEl || typeof L === 'undefined') return;
    if (ambulanceLeafletMap) return;

    try {
      ambulanceLeafletMap = L.map('ambulanceMap', {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView(currentSearchCenter, 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(ambulanceLeafletMap);

      ambulanceMarkersLayer = L.layerGroup().addTo(ambulanceLeafletMap);
    } catch (err) {
      console.warn('Ambulance map init error:', err);
    }
  }

  function renderAmbulanceMapMarkers(units, centerCoords) {
    if (!ambulanceLeafletMap || !ambulanceMarkersLayer || typeof L === 'undefined') return;

    ambulanceMarkersLayer.clearLayers();

    const centerLat = centerCoords ? centerCoords[0] : 22.5697;
    const centerLng = centerCoords ? centerCoords[1] : 88.3697;

    // Search Center Pin
    const userIcon = L.divIcon({
      className: 'amb-custom-user-icon',
      html: '<div class="amb-leaflet-pin amb-pin-user" title="Search Center / Pickup Area"><span style="font-size: 14px;">📍</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const userMarker = L.marker([centerLat, centerLng], { icon: userIcon })
      .bindPopup(`<strong>📍 Search Area</strong><br>${escapeHtml(ambulanceLocationInput ? ambulanceLocationInput.value : 'Search Location')}`)
      .addTo(ambulanceMarkersLayer);

    const bounds = L.latLngBounds([[centerLat, centerLng]]);

    units.forEach(amb => {
      if (typeof amb.latitude !== 'number' || typeof amb.longitude !== 'number') return;

      const pinClass = amb.status === 'AVAILABLE' ? 'amb-pin-available' : (amb.status === 'BUSY' ? 'amb-pin-busy' : 'amb-pin-offline');
      const pinIcon = L.divIcon({
        className: 'amb-custom-marker',
        html: `<div class="amb-leaflet-pin ${pinClass}" title="${escapeHtml(amb.unitCode)} (${amb.status})"><span style="font-size: 14px;">🚑</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -14]
      });

      const popupHtml = `
        <div class="amb-leaflet-popup" style="min-width: 190px;">
          <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;" class="${pinClass}">${escapeHtml(amb.status)}</div>
          <h4 style="margin: 0 0 2px; font-size: 0.95rem; color: #0f172a;">${escapeHtml(amb.unitCode)}</h4>
          <p style="margin: 0 0 4px; font-size: 0.78rem; color: #64748b;">${escapeHtml(amb.typeName)}</p>
          <div style="font-size: 0.8rem; margin-bottom: 8px;">
            <span>📍 ${amb.distance.toFixed(1)} km</span> &middot; <span>⏱ ${escapeHtml(amb.eta)}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.viewAmbulanceDetails('${escapeHtml(amb.id)}')">Details</button>
            ${amb.status === 'AVAILABLE' ? `<button type="button" class="btn btn-emergency btn-sm" onclick="window.requestAmbulanceUnit('${escapeHtml(amb.id)}')">Request</button>` : ''}
          </div>
        </div>
      `;

      L.marker([amb.latitude, amb.longitude], { icon: pinIcon })
        .bindPopup(popupHtml)
        .addTo(ambulanceMarkersLayer);

      bounds.extend([amb.latitude, amb.longitude]);
    });

    if (units.length > 0) {
      ambulanceLeafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      ambulanceLeafletMap.setView([centerLat, centerLng], 12);
    }
  }

  // --- 3. LOCATION & DISTANCE RESOLUTION ---
  function resolveLocationCoordinates(query) {
    if (!query) return [22.5697, 88.3697];
    const q = query.trim().toLowerCase();

    for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
      if (q.includes(key) || key.includes(q)) {
        return coords;
      }
    }
    return [22.5697, 88.3697];
  }

  function calculateAmbulanceETA(distKm) {
    if (distKm <= 1.5) return '~4–7 min';
    if (distKm <= 3.0) return '~6–9 min';
    if (distKm <= 6.0) return '~9–14 min';
    if (distKm <= 12.0) return '~14–22 min';
    if (distKm <= 25.0) return '~25–40 min';
    return `~${Math.round(distKm * 1.5)}–${Math.round(distKm * 2)} min`;
  }

  // --- 4. EXECUTE SEARCH & FILTERING ---
  function executeAmbulanceSearch() {
    if (!ambulanceCardsList) return;

    const queryLocation = ambulanceLocationInput ? ambulanceLocationInput.value.trim() : 'Kolkata Central';
    currentSearchCenter = resolveLocationCoordinates(queryLocation);

    const radius = ambulanceRadiusSelect ? parseFloat(ambulanceRadiusSelect.value) || 5 : 5;
    const availableOnly = ambulanceAvailableOnlyCheck ? ambulanceAvailableOnlyCheck.checked : true;
    const sortVal = ambulanceSortSelect ? ambulanceSortSelect.value : 'distance_asc';

    // Show loading skeleton briefly for feedback
    if (ambulanceLoadingCard) ambulanceLoadingCard.hidden = false;
    if (ambulanceEmptyCard) ambulanceEmptyCard.hidden = true;
    ambulanceCardsList.hidden = true;

    setTimeout(() => {
      // Recalculate distance and ETA for all units
      MOCK_AMBULANCES.forEach(amb => {
        amb.distance = calculateDistance(currentSearchCenter[0], currentSearchCenter[1], amb.latitude, amb.longitude);
        amb.eta = calculateAmbulanceETA(amb.distance);
      });

      // Filter
      let filtered = MOCK_AMBULANCES.filter(amb => {
        // Radius filter
        if (amb.distance > radius) return false;

        // Type filter
        if (activeAmbulanceType !== 'all' && amb.type !== activeAmbulanceType) {
          return false;
        }

        // Available only filter
        if (availableOnly && amb.status !== 'AVAILABLE') {
          return false;
        }

        return true;
      });

      // Sort
      filtered.sort((a, b) => {
        if (sortVal === 'distance_asc') {
          return a.distance - b.distance;
        }
        if (sortVal === 'status_avail') {
          const rank = { AVAILABLE: 0, BUSY: 1, OFFLINE: 2 };
          return (rank[a.status] || 0) - (rank[b.status] || 0) || (a.distance - b.distance);
        }
        if (sortVal === 'eta_asc') {
          return a.distance - b.distance;
        }
        if (sortVal === 'type_asc') {
          return a.typeName.localeCompare(b.typeName);
        }
        return a.distance - b.distance;
      });

      // Update UI counts
      if (ambulanceCountNum) ambulanceCountNum.textContent = filtered.length;
      if (ambulanceRadiusLabel) ambulanceRadiusLabel.textContent = radius + ' km';

      // Hide loading skeleton
      if (ambulanceLoadingCard) ambulanceLoadingCard.hidden = true;

      // Handle empty state vs results
      if (filtered.length === 0) {
        if (ambulanceEmptyCard) ambulanceEmptyCard.hidden = false;
        ambulanceCardsList.hidden = true;
        ambulanceCardsList.innerHTML = '';
        if (ambulanceEmptyReasonText) {
          ambulanceEmptyReasonText.textContent = `No ambulances found within ${radius} km for type "${activeAmbulanceType.toUpperCase()}". Expand search radius or toggle available units.`;
        }
      } else {
        if (ambulanceEmptyCard) ambulanceEmptyCard.hidden = true;
        ambulanceCardsList.hidden = false;
        renderAmbulanceCards(filtered);
      }

      // Update map markers
      renderAmbulanceMapMarkers(filtered, currentSearchCenter);
    }, 220);
  }

  // --- 5. RENDER AMBULANCE CARDS ---
  function renderAmbulanceCards(units) {
    if (!ambulanceCardsList) return;

    ambulanceCardsList.innerHTML = units.map(amb => {
      const statusLabel = amb.status === 'AVAILABLE' ? '🟢 Available' : (amb.status === 'BUSY' ? '🟠 On Call' : '⚪ Offline');
      const topEquip = amb.equipment.slice(0, 3);
      const remainingCount = amb.equipment.length - 3;

      return `
        <article class="ambulance-card" data-id="${escapeHtml(amb.id)}">
          <div class="amb-card-top">
            <div class="amb-card-unit">
              <span class="amb-type-pill pill-${escapeHtml(amb.type.toLowerCase())}">${escapeHtml(amb.type)}</span>
              <div>
                <h4 class="amb-unit-code">${escapeHtml(amb.unitCode)}</h4>
                <span class="amb-provider-name">${escapeHtml(amb.provider)}</span>
              </div>
            </div>
            <span class="amb-status-tag tag-${escapeHtml(amb.status.toLowerCase())}">${statusLabel}</span>
          </div>

          <div class="amb-card-metrics">
            <div class="amb-metric-item">
              <span class="amb-metric-icon">📍</span>
              <div>
                <strong class="amb-metric-val">${amb.distance.toFixed(1)} km</strong>
                <span class="amb-metric-sub">${escapeHtml(amb.baseArea)}</span>
              </div>
            </div>
            <div class="amb-metric-item">
              <span class="amb-metric-icon">⏱️</span>
              <div>
                <strong class="amb-metric-val">${escapeHtml(amb.eta)}</strong>
                <span class="amb-metric-sub">Est. Arrival (Demo)</span>
              </div>
            </div>
          </div>

          <div class="amb-card-equip">
            <span class="amb-equip-label">Key Equipment:</span>
            <div class="amb-equip-pills">
              ${topEquip.map(eq => `<span class="amb-equip-pill">${escapeHtml(eq)}</span>`).join('')}
              ${remainingCount > 0 ? `<span class="amb-equip-pill amb-equip-more">+${remainingCount} more</span>` : ''}
            </div>
          </div>

          <div class="amb-card-actions">
            <button type="button" class="btn btn-outline btn-sm amb-view-details-btn" data-id="${escapeHtml(amb.id)}">
              📋 Details
            </button>
            ${amb.status === 'AVAILABLE' ? `
              <button type="button" class="btn btn-emergency btn-sm amb-book-btn" data-id="${escapeHtml(amb.id)}">
                🚑 Request Unit
              </button>
            ` : `
              <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity: 0.65; cursor: not-allowed;">
                ${amb.status === 'BUSY' ? '🟠 On Active Call' : '⚪ Unit Offline'}
              </button>
            `}
            <a href="tel:112" class="btn btn-outline btn-sm amb-call-112-link" title="Call 112 Hotline">
              📞 112
            </a>
          </div>
        </article>
      `;
    }).join('');
  }

  // --- 6. RENDER RECENT REQUESTS ---
  function renderRecentAmbulanceRequests() {
    if (!ambulanceRecentList) return;

    if (MOCK_RECENT_REQUESTS.length === 0) {
      ambulanceRecentList.innerHTML = '<p style="color: var(--muted); font-size: 0.9rem;">No recent demo requests recorded yet.</p>';
      return;
    }

    ambulanceRecentList.innerHTML = MOCK_RECENT_REQUESTS.map(req => {
      return `
        <div class="amb-recent-card">
          <div class="amb-recent-head">
            <span class="amb-recent-id">${escapeHtml(req.requestId)}</span>
            <span class="amb-recent-status">${escapeHtml(req.status)}</span>
          </div>
          <div class="amb-recent-unit-row">
            <strong>${escapeHtml(req.unitCode)}</strong> &middot; <span>${escapeHtml(req.type)}</span>
          </div>
          <div class="amb-recent-route">
            <div class="amb-route-point">
              <span class="amb-route-dot dot-from"></span>
              <span>${escapeHtml(req.pickup)}</span>
            </div>
            <div class="amb-route-point">
              <span class="amb-route-dot dot-to"></span>
              <span>${escapeHtml(req.destination || 'Nearest Emergency Facility')}</span>
            </div>
          </div>
          <div class="amb-recent-footer">
            <span>👤 ${escapeHtml(req.patientName)}</span>
            <span>⏱ ${escapeHtml(req.timeAgo || 'Just now')}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- 7. MODALS LOGIC ---
  function openAmbulanceDetailsModal(ambId) {
    const amb = MOCK_AMBULANCES.find(a => a.id === ambId);
    if (!amb || !ambulanceDetailsModal) return;

    activeAmbulanceForModal = amb;

    if (ambDetailsTitle) ambDetailsTitle.textContent = amb.unitCode;
    if (ambDetailsTypeBadge) ambDetailsTypeBadge.textContent = amb.typeName;
    if (ambDetailsStatus) {
      ambDetailsStatus.textContent = amb.status === 'AVAILABLE' ? '🟢 AVAILABLE' : (amb.status === 'BUSY' ? '🟠 ON ACTIVE CALL' : '⚪ OFFLINE');
    }
    if (ambDetailsEta) ambDetailsEta.textContent = `⏱ Estimated Arrival: ${amb.eta} (Demo)`;
    if (ambDetailsReg) ambDetailsReg.textContent = amb.vehicleReg;
    if (ambDetailsDistance) ambDetailsDistance.textContent = `${amb.distance.toFixed(1)} km away`;
    if (ambDetailsProvider) ambDetailsProvider.textContent = amb.provider;
    if (ambDetailsArea) ambDetailsArea.textContent = `${amb.baseArea}, ${amb.district}`;
    if (ambDetailsCrew) ambDetailsCrew.textContent = amb.crew;

    if (ambDetailsEquipmentList) {
      ambDetailsEquipmentList.innerHTML = amb.equipment.map(eq => `<span class="amb-equip-pill">${escapeHtml(eq)}</span>`).join('');
    }

    if (ambDetailsRequestActionBtn) {
      if (amb.status === 'AVAILABLE') {
        ambDetailsRequestActionBtn.disabled = false;
        ambDetailsRequestActionBtn.style.display = '';
      } else {
        ambDetailsRequestActionBtn.disabled = true;
        ambDetailsRequestActionBtn.style.display = 'none';
      }
    }

    ambulanceDetailsModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAmbulanceDetailsModal() {
    if (ambulanceDetailsModal) ambulanceDetailsModal.hidden = true;
    document.body.style.overflow = '';
  }

  function openAmbulanceRequestModal(ambId) {
    const amb = MOCK_AMBULANCES.find(a => a.id === ambId) || activeAmbulanceForModal;
    if (!amb || !ambulanceRequestModal) return;

    activeAmbulanceForModal = amb;

    if (ambRequestUnitId) ambRequestUnitId.textContent = amb.unitCode;
    if (ambRequestUnitType) ambRequestUnitType.textContent = amb.typeName;
    if (ambRequestUnitDist) ambRequestUnitDist.textContent = `📍 ${amb.distance.toFixed(1)} km away`;
    if (ambRequestUnitEta) ambRequestUnitEta.textContent = `⏱ ${amb.eta} (Demo)`;

    // Pre-fill location
    if (ambReqPickup && ambulanceLocationInput) {
      ambReqPickup.value = ambulanceLocationInput.value.trim() || 'Kolkata';
    }

    // Set triage priority select
    if (ambReqPrioritySelect) {
      ambReqPrioritySelect.value = activeAmbulancePriority || 'Urgent';
    }

    ambulanceRequestModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAmbulanceRequestModal() {
    if (ambulanceRequestModal) ambulanceRequestModal.hidden = true;
    document.body.style.overflow = '';
  }

  function openAmbulanceSuccessModal(reqRecord) {
    if (!ambulanceSuccessModal) return;

    if (ambSuccessId) ambSuccessId.textContent = reqRecord.requestId;
    if (ambSuccessUnit) ambSuccessUnit.textContent = reqRecord.unitCode;
    if (ambSuccessType) ambSuccessType.textContent = reqRecord.type;
    if (ambSuccessStatus) ambSuccessStatus.textContent = reqRecord.status;
    if (ambSuccessEta) ambSuccessEta.textContent = reqRecord.eta;
    if (ambSuccessPickup) ambSuccessPickup.textContent = reqRecord.pickup;
    if (ambSuccessDest) ambSuccessDest.textContent = reqRecord.destination || 'Nearest Emergency Department';

    ambulanceSuccessModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAmbulanceSuccessModal() {
    if (ambulanceSuccessModal) ambulanceSuccessModal.hidden = true;
    document.body.style.overflow = '';
  }

  // Make globally available for onclick handlers in markers and cards
  window.viewAmbulanceDetails = openAmbulanceDetailsModal;
  window.requestAmbulanceUnit = openAmbulanceRequestModal;

  // --- 8. EVENT LISTENERS WIRING ---

  // Navigation and launcher buttons
  [navAmbulanceBtn, navAmbulanceLink, mobileAmbulanceBtn, ambulanceLauncherBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showAmbulancePortal(true);
      });
    }
  });

  if (ambulanceBackHomeBtn) {
    ambulanceBackHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToOriginalHome(true);
    });
  }

  // Type selection cards toggle
  ambTypeCards.forEach(card => {
    card.addEventListener('click', () => {
      ambTypeCards.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('active');
      card.setAttribute('aria-checked', 'true');
      activeAmbulanceType = card.getAttribute('data-type') || 'all';
      executeAmbulanceSearch();
    });
  });

  // Priority radio pills
  ambPriorityInputs.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.amb-priority-pill').forEach(pill => pill.classList.remove('active'));
      const parentPill = radio.closest('.amb-priority-pill');
      if (parentPill) parentPill.classList.add('active');
      activeAmbulancePriority = radio.value;
    });
  });

  // Search form submit
  if (ambulanceSearchForm) {
    ambulanceSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeAmbulanceSearch();
    });
  }
  if (ambulanceSearchBtn) {
    ambulanceSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      executeAmbulanceSearch();
    });
  }

  // Location input enter key
  if (ambulanceLocationInput) {
    ambulanceLocationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeAmbulanceSearch();
      }
    });
  }

  // "Use My Location" simulation
  if (ambulanceUseLocationBtn) {
    ambulanceUseLocationBtn.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        showToast('📍 Using standard Kolkata Central demo location.');
        if (ambulanceLocationInput) ambulanceLocationInput.value = 'Kolkata Central';
        if (ambulanceLocationHint) ambulanceLocationHint.textContent = 'Demo location set to Kolkata Central.';
        executeAmbulanceSearch();
        return;
      }

      ambulanceUseLocationBtn.disabled = true;
      const originalText = ambulanceUseLocationBtn.innerHTML;
      ambulanceUseLocationBtn.innerHTML = '⏳ Locating...';

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          ambulanceUseLocationBtn.disabled = false;
          ambulanceUseLocationBtn.innerHTML = originalText;
          currentSearchCenter = [pos.coords.latitude, pos.coords.longitude];
          if (ambulanceLocationInput) ambulanceLocationInput.value = 'My Current Location';
          if (ambulanceLocationHint) ambulanceLocationHint.textContent = `📍 Geolocation detected (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`;
          showToast('📍 Current location detected. Updating nearby ambulances.');
          executeAmbulanceSearch();
        },
        (err) => {
          console.warn('Geolocation error:', err);
          ambulanceUseLocationBtn.disabled = false;
          ambulanceUseLocationBtn.innerHTML = originalText;
          if (ambulanceLocationInput) ambulanceLocationInput.value = 'Kolkata Central';
          if (ambulanceLocationHint) ambulanceLocationHint.textContent = 'Simulated near Kolkata Central / Park Street.';
          showToast('📍 Location access simulated near Kolkata Central.');
          executeAmbulanceSearch();
        },
        { timeout: 7000 }
      );
    });
  }

  // Radius, Available check, and Sort change
  if (ambulanceRadiusSelect) {
    ambulanceRadiusSelect.addEventListener('change', executeAmbulanceSearch);
  }
  if (ambulanceAvailableOnlyCheck) {
    ambulanceAvailableOnlyCheck.addEventListener('change', executeAmbulanceSearch);
  }
  if (ambulanceSortSelect) {
    ambulanceSortSelect.addEventListener('change', executeAmbulanceSearch);
  }

  // Reset filters
  function resetAmbulanceFilters() {
    if (ambulanceLocationInput) ambulanceLocationInput.value = 'Kolkata Central';
    if (ambulanceRadiusSelect) ambulanceRadiusSelect.value = '5';
    if (ambulanceAvailableOnlyCheck) ambulanceAvailableOnlyCheck.checked = true;
    if (ambulanceSortSelect) ambulanceSortSelect.value = 'distance_asc';

    ambTypeCards.forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    const defaultType = document.querySelector('.amb-type-card[data-type="all"]');
    if (defaultType) {
      defaultType.classList.add('active');
      defaultType.setAttribute('aria-checked', 'true');
    }
    activeAmbulanceType = 'all';

    if (ambulanceLocationHint) ambulanceLocationHint.textContent = 'Sample location prefilled for demonstration.';
    executeAmbulanceSearch();
  }

  if (ambulanceResetSearchBtn) ambulanceResetSearchBtn.addEventListener('click', resetAmbulanceFilters);
  if (ambulanceResetFiltersBtn) ambulanceResetFiltersBtn.addEventListener('click', resetAmbulanceFilters);

  if (ambulanceExpandRadiusBtn) {
    ambulanceExpandRadiusBtn.addEventListener('click', () => {
      if (ambulanceRadiusSelect) ambulanceRadiusSelect.value = '25';
      executeAmbulanceSearch();
    });
  }

  // Card delegation for Details and Request buttons
  if (ambulanceCardsList) {
    ambulanceCardsList.addEventListener('click', (e) => {
      const detailsBtn = e.target.closest('.amb-view-details-btn');
      if (detailsBtn) {
        const id = detailsBtn.getAttribute('data-id');
        openAmbulanceDetailsModal(id);
        return;
      }

      const bookBtn = e.target.closest('.amb-book-btn');
      if (bookBtn) {
        const id = bookBtn.getAttribute('data-id');
        openAmbulanceRequestModal(id);
        return;
      }
    });
  }

  // Details Modal close and action buttons
  if (ambDetailsCloseBtn) ambDetailsCloseBtn.addEventListener('click', closeAmbulanceDetailsModal);
  if (ambDetailsCancelBtn) ambDetailsCancelBtn.addEventListener('click', closeAmbulanceDetailsModal);
  if (ambulanceDetailsModal) {
    ambulanceDetailsModal.addEventListener('click', (e) => {
      if (e.target === ambulanceDetailsModal) closeAmbulanceDetailsModal();
    });
  }
  if (ambDetailsRequestActionBtn) {
    ambDetailsRequestActionBtn.addEventListener('click', () => {
      closeAmbulanceDetailsModal();
      if (activeAmbulanceForModal) {
        openAmbulanceRequestModal(activeAmbulanceForModal.id);
      }
    });
  }

  // Request Modal close and cancel buttons
  if (ambRequestCloseBtn) ambRequestCloseBtn.addEventListener('click', closeAmbulanceRequestModal);
  if (ambRequestCancelBtn) ambRequestCancelBtn.addEventListener('click', closeAmbulanceRequestModal);
  if (ambulanceRequestModal) {
    ambulanceRequestModal.addEventListener('click', (e) => {
      if (e.target === ambulanceRequestModal) closeAmbulanceRequestModal();
    });
  }

  // Request Form submission
  if (ambulanceConfirmForm) {
    ambulanceConfirmForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const patientName = ambReqPatientName ? ambReqPatientName.value.trim() : '';
      const phone = ambReqPhone ? ambReqPhone.value.trim() : '';
      const pickup = ambReqPickup ? ambReqPickup.value.trim() : '';
      const dest = ambReqDestination ? ambReqDestination.value.trim() : '';
      const priority = ambReqPrioritySelect ? ambReqPrioritySelect.value : 'Urgent';

      if (!patientName || !phone || !pickup) {
        showToast('⚠️ Please complete all required patient and pickup fields.');
        return;
      }

      if (ambRequestSubmitBtn) {
        ambRequestSubmitBtn.disabled = true;
        ambRequestSubmitBtn.textContent = 'Recording Request...';
      }

      setTimeout(() => {
        const newRequestId = `DEMO-AMB-${Math.floor(10000 + Math.random() * 90000)}`;
        const selectedAmb = activeAmbulanceForModal || MOCK_AMBULANCES[0];

        const newRecord = {
          requestId: newRequestId,
          unitCode: selectedAmb.unitCode,
          type: selectedAmb.typeName,
          patientName: patientName,
          pickup: pickup,
          destination: dest || 'Nearest Emergency Center',
          priority: priority,
          status: 'Dispatched (Demo)',
          eta: selectedAmb.eta,
          timeAgo: 'Just now'
        };

        MOCK_RECENT_REQUESTS.unshift(newRecord);
        renderRecentAmbulanceRequests();

        if (ambRequestSubmitBtn) {
          ambRequestSubmitBtn.disabled = false;
          ambRequestSubmitBtn.textContent = '🚑 CONFIRM DEMO REQUEST';
        }

        closeAmbulanceRequestModal();
        openAmbulanceSuccessModal(newRecord);
        showToast(`🚑 Demo request ${newRequestId} submitted successfully!`);
      }, 350);
    });
  }

  // Success Modal close
  if (ambSuccessCloseBtn) ambSuccessCloseBtn.addEventListener('click', closeAmbulanceSuccessModal);
  if (ambulanceSuccessModal) {
    ambulanceSuccessModal.addEventListener('click', (e) => {
      if (e.target === ambulanceSuccessModal) closeAmbulanceSuccessModal();
    });
  }

  // Global Escape key for ambulance modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ambulanceDetailsModal && !ambulanceDetailsModal.hidden) closeAmbulanceDetailsModal();
      if (ambulanceRequestModal && !ambulanceRequestModal.hidden) closeAmbulanceRequestModal();
      if (ambulanceSuccessModal && !ambulanceSuccessModal.hidden) closeAmbulanceSuccessModal();
    }
  });

  // Check initial hash on load for #ambulance
  if (window.location.hash === '#ambulance') {
    showAmbulancePortal(false);
  }

  /* -----------------------------------------------------
     16. DR. RAKSHAK — AI HEALTH ASSISTANT (FEATURES #1–#15)
     ----------------------------------------------------- */

  // Chat State & Conversation Management
  let chatMessages = [];
  let chatState = 'IDLE'; // 'IDLE' | 'PROCESSING' | 'TYPING' | 'COMPLETED' | 'ERROR'
  let currentConversationGeneration = 1;
  let activeTypingTimer = null;
  let activeTypingMessageId = null;
  let activeTypingFullText = '';

  // DOM Elements
  const rakshakLauncherBtn = document.getElementById('rakshakLauncherBtn');
  const rakshakChatWidget = document.getElementById('rakshakChatWidget');
  const rakshakCloseBtn = document.getElementById('rakshakCloseBtn');
  const rakshakNewChatBtn = document.getElementById('rakshakNewChatBtn');
  const rakshakChatBody = document.getElementById('rakshakChatBody');
  const rakshakWelcomeView = document.getElementById('rakshakWelcomeView');
  const rakshakMessagesList = document.getElementById('rakshakMessagesList');
  const rakshakInputForm = document.getElementById('rakshakInputForm');
  const rakshakChatInput = document.getElementById('rakshakChatInput');
  const rakshakStopBtn = document.getElementById('rakshakStopBtn');
  const rakshakSendBtn = document.getElementById('rakshakSendBtn');
  const rakshakOfflineBanner = document.getElementById('rakshakOfflineBanner');
  const rakshakResetModalOverlay = document.getElementById('rakshakResetModalOverlay');
  const rakshakResetCancelBtn = document.getElementById('rakshakResetCancelBtn');
  const rakshakResetConfirmBtn = document.getElementById('rakshakResetConfirmBtn');
  const rakshakQuickActions = document.getElementById('rakshakQuickActions');
  const rakshakSuggestedQuestions = document.getElementById('rakshakSuggestedQuestions');

  // Helper: Format message timestamp (Feature #14)
  function getFormattedTimestamp() {
    try {
      return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      const d = new Date();
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }

  // Helper: Safe Lightweight Markdown to HTML Renderer
  function renderMarkdownToHtml(markdown) {
    if (!markdown) return '';
    let text = String(markdown);

    // Escape HTML entities to prevent XSS
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced Code Blocks (```lang ... ```)
    text = text.replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline Code (`code`)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings (###, ##, #)
    text = text.replace(/^### (.*$)/gim, '<h4 style="margin:6px 0 4px;font-size:0.95rem;font-weight:700;">$1</h4>');
    text = text.replace(/^## (.*$)/gim, '<h3 style="margin:8px 0 4px;font-size:1rem;font-weight:700;">$1</h3>');
    text = text.replace(/^# (.*$)/gim, '<h3 style="margin:10px 0 4px;font-size:1.05rem;font-weight:800;">$1</h3>');

    // Blockquotes (> quote)
    text = text.replace(/^>\s?(.*$)/gim, '<blockquote>$1</blockquote>');

    // Tables (| col | col |)
    if (text.includes('|')) {
      const lines = text.split('\n');
      let inTable = false;
      let tableHtml = '';
      const newLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          const cells = line.split('|').map(c => c.trim()).slice(1, -1);
          if (cells.every(c => /^[-:]+$/.test(c))) {
            // separator line
            continue;
          }
          if (!inTable) {
            inTable = true;
            tableHtml = '<table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
          } else {
            tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
          }
        } else {
          if (inTable) {
            tableHtml += '</tbody></table>';
            newLines.push(tableHtml);
            inTable = false;
            tableHtml = '';
          }
          newLines.push(lines[i]);
        }
      }
      if (inTable) {
        tableHtml += '</tbody></table>';
        newLines.push(tableHtml);
      }
      text = newLines.join('\n');
    }

    // Bold (**text** or __text__)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Links ([text](url))
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Lists (unordered - or *, ordered 1.)
    const paragraphs = text.split(/\n\n+/);
    const renderedParagraphs = paragraphs.map(para => {
      const lines = para.split('\n');
      if (lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
        return '<ul>' + lines.map(l => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('') + '</ul>';
      }
      if (lines.every(l => /^\d+\.\s+/.test(l.trim()))) {
        return '<ol>' + lines.map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('') + '</ol>';
      }
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    });

    return renderedParagraphs.join('');
  }

  // Helper: Extract clean text for clipboard (Feature #7)
  function getCleanMessageText(content) {
    if (!content) return '';
    return String(content).trim();
  }

  // Online / Offline State Listener (Feature #13)
  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    if (rakshakOfflineBanner) {
      rakshakOfflineBanner.hidden = isOnline;
      rakshakOfflineBanner.style.display = isOnline ? 'none' : 'flex';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Scroll Chat to Bottom
  function scrollChatToBottom(smooth = true) {
    if (!rakshakChatBody) return;
    requestAnimationFrame(() => {
      rakshakChatBody.scrollTo({
        top: rakshakChatBody.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    });
  }

  // Toggle Chatbot Open/Close
  function toggleRakshakChat(forceOpen = null) {
    if (!rakshakChatWidget) return;
    const isCurrentlyHidden = rakshakChatWidget.hidden || rakshakChatWidget.style.display === 'none';
    const shouldOpen = forceOpen !== null ? forceOpen : isCurrentlyHidden;

    if (shouldOpen) {
      rakshakChatWidget.hidden = false;
      rakshakChatWidget.style.display = 'flex';
    } else {
      rakshakChatWidget.hidden = true;
      rakshakChatWidget.style.display = 'none';
    }

    if (rakshakLauncherBtn) {
      rakshakLauncherBtn.setAttribute('aria-expanded', String(shouldOpen));
    }
    if (shouldOpen) {
      updateOnlineStatus();
      scrollChatToBottom(false);
      setTimeout(() => {
        if (rakshakChatInput) rakshakChatInput.focus();
      }, 100);
    }
  }

  if (rakshakLauncherBtn) {
    rakshakLauncherBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleRakshakChat();
    });
  }
  if (rakshakCloseBtn) {
    rakshakCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleRakshakChat(false);
    });
  }

  // Auto-resize input textarea
  if (rakshakChatInput) {
    rakshakChatInput.addEventListener('input', () => {
      rakshakChatInput.style.height = 'auto';
      const newHeight = Math.min(rakshakChatInput.scrollHeight, 90);
      rakshakChatInput.style.height = `${newHeight}px`;
    });

    rakshakChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        rakshakInputForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  }

  // Render Full Messages List into DOM
  function renderChatMessages() {
    if (!rakshakMessagesList || !rakshakWelcomeView) return;

    if (chatMessages.length === 0) {
      rakshakWelcomeView.hidden = false;
      rakshakMessagesList.innerHTML = '';
      return;
    }

    rakshakWelcomeView.hidden = true;
    rakshakMessagesList.innerHTML = '';

    chatMessages.forEach((msg) => {
      const row = document.createElement('div');
      row.className = `chat-msg-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`;
      row.id = `chat-msg-row-${msg.id}`;

      if (msg.role === 'user') {
        const bubble = document.createElement('div');
        bubble.className = 'chat-msg-user';
        bubble.textContent = msg.content;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = msg.timestamp;

        row.appendChild(bubble);
        row.appendChild(timeSpan);
      } else {
        const bubble = document.createElement('div');
        bubble.className = 'chat-msg-assistant';
        bubble.id = `chat-bubble-${msg.id}`;

        if (msg.isNew) {
          bubble.classList.add('animate-entrance');
          msg.isNew = false;
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'ai-msg-content';
        contentDiv.id = `chat-content-${msg.id}`;

        if (msg.status === 'processing') {
          // Feature #1 & #2: Blinking eye placeholder during processing
          contentDiv.innerHTML = `
            <div class="ai-processing-placeholder" role="status" aria-label="Dr. Rakshak is generating a response">
              <span class="ai-blinking-eye" aria-hidden="true">👁️</span>
              <span class="ai-processing-text">Dr. Rakshak is analyzing...</span>
            </div>
          `;
        } else if (msg.status === 'typing') {
          // Feature #3: Typing state with live caret cursor
          contentDiv.innerHTML = renderMarkdownToHtml(msg.visibleContent || '') + '<span class="ai-typing-cursor" aria-hidden="true">|</span>';
        } else if (msg.status === 'error') {
          // Feature #13: Safe error and retry state
          contentDiv.innerHTML = `
            <div class="chat-error-card" role="alert">
              <div class="chat-error-row">
                <span class="chat-error-icon" aria-hidden="true">⚠️</span>
                <span class="chat-error-text">${escapeHtml(msg.errorMessage || 'Unable to connect to the AI service. Please try again.')}</span>
              </div>
              <button type="button" class="chat-retry-btn" data-action="retry" data-id="${msg.id}" aria-label="Retry sending request">
                <span>🔄</span> Retry
              </button>
            </div>
          `;
        } else {
          // Completed State: Render full markdown
          contentDiv.innerHTML = renderMarkdownToHtml(msg.content);
        }

        bubble.appendChild(contentDiv);

        // Actions toolbar on completed assistant messages (Features #7, #8, #9)
        if (msg.status === 'completed') {
          const actionsBar = document.createElement('div');
          actionsBar.className = 'chat-msg-actions';

          // Copy Button (Feature #7)
          const copyBtn = document.createElement('button');
          copyBtn.type = 'button';
          copyBtn.className = 'chat-action-btn';
          copyBtn.setAttribute('data-action', 'copy');
          copyBtn.setAttribute('data-id', msg.id);
          copyBtn.setAttribute('aria-label', 'Copy AI response');
          copyBtn.innerHTML = msg.copied ? '<span>✓</span> Copied' : '<span>📋</span> Copy';
          if (msg.copied) copyBtn.classList.add('copied-success');

          // Regenerate Button (Feature #8)
          const regenBtn = document.createElement('button');
          regenBtn.type = 'button';
          regenBtn.className = 'chat-action-btn';
          regenBtn.setAttribute('data-action', 'regenerate');
          regenBtn.setAttribute('data-id', msg.id);
          regenBtn.setAttribute('aria-label', 'Regenerate AI response');
          regenBtn.innerHTML = '<span>🔄</span> Regenerate';

          // Helpful 👍 Feedback (Feature #9)
          const helpfulBtn = document.createElement('button');
          helpfulBtn.type = 'button';
          helpfulBtn.className = `chat-action-btn ${msg.feedback === 'helpful' ? 'active-helpful' : ''}`;
          helpfulBtn.setAttribute('data-action', 'feedback-helpful');
          helpfulBtn.setAttribute('data-id', msg.id);
          helpfulBtn.setAttribute('aria-label', 'Mark response as helpful');
          helpfulBtn.innerHTML = '👍 Helpful';

          // Not Helpful 👎 Feedback (Feature #9)
          const notHelpfulBtn = document.createElement('button');
          notHelpfulBtn.type = 'button';
          notHelpfulBtn.className = `chat-action-btn ${msg.feedback === 'not_helpful' ? 'active-not-helpful' : ''}`;
          notHelpfulBtn.setAttribute('data-action', 'feedback-not-helpful');
          notHelpfulBtn.setAttribute('data-id', msg.id);
          notHelpfulBtn.setAttribute('aria-label', 'Mark response as not helpful');
          notHelpfulBtn.innerHTML = '👎 Not helpful';

          actionsBar.appendChild(copyBtn);
          actionsBar.appendChild(regenBtn);
          actionsBar.appendChild(helpfulBtn);
          actionsBar.appendChild(notHelpfulBtn);
          bubble.appendChild(actionsBar);
        }

        const timeSpan = document.createElement('span');
        timeSpan.className = 'chat-msg-time';
        timeSpan.textContent = msg.timestamp;

        row.appendChild(bubble);
        row.appendChild(timeSpan);
      }

      rakshakMessagesList.appendChild(row);
    });

    scrollChatToBottom();
  }

  // Feature #4: Natural AI Response Typing Reveal & Caret Animation
  function startNaturalTyping(messageId, fullText, generation) {
    if (currentConversationGeneration !== generation) return;

    const msg = chatMessages.find(m => m.id === messageId);
    if (!msg) return;

    msg.status = 'typing';
    msg.visibleContent = '';
    chatState = 'TYPING';
    activeTypingMessageId = messageId;
    activeTypingFullText = fullText;

    if (rakshakStopBtn) rakshakStopBtn.hidden = false;
    if (rakshakSendBtn) rakshakSendBtn.disabled = true;

    // Determine character reveal speed based on length to keep UX fast and responsive
    const totalLength = fullText.length;
    const isLong = totalLength > 350;
    const chunkSize = isLong ? Math.max(3, Math.floor(totalLength / 90)) : 1;

    let currentIndex = 0;

    function stepTyping() {
      if (currentConversationGeneration !== generation || chatState !== 'TYPING' || activeTypingMessageId !== messageId) {
        return;
      }

      currentIndex = Math.min(currentIndex + chunkSize, totalLength);
      const visibleChunk = fullText.slice(0, currentIndex);
      msg.visibleContent = visibleChunk;

      const contentEl = document.getElementById(`chat-content-${messageId}`);
      if (contentEl) {
        contentEl.innerHTML = renderMarkdownToHtml(visibleChunk) + '<span class="ai-typing-cursor" aria-hidden="true">|</span>';
        scrollChatToBottom();
      }

      if (currentIndex >= totalLength) {
        completeTyping(messageId, fullText);
      } else {
        const nextChar = fullText[currentIndex - 1] || '';
        let delay = 18;
        if (['.', '!', '?', '\n'].includes(nextChar)) {
          delay = 90;
        } else if ([',', ';', ':'].includes(nextChar)) {
          delay = 50;
        }
        activeTypingTimer = setTimeout(stepTyping, delay);
      }
    }

    stepTyping();
  }

  // Feature #6: Complete or Stop Typing immediately
  function completeTyping(messageId, fullText) {
    if (activeTypingTimer) {
      clearTimeout(activeTypingTimer);
      activeTypingTimer = null;
    }

    const msg = chatMessages.find(m => m.id === messageId);
    if (msg) {
      msg.content = fullText;
      msg.visibleContent = fullText;
      msg.status = 'completed';
    }

    chatState = 'COMPLETED';
    activeTypingMessageId = null;
    activeTypingFullText = '';

    if (rakshakStopBtn) rakshakStopBtn.hidden = true;
    if (rakshakSendBtn) rakshakSendBtn.disabled = false;
    if (rakshakChatInput) rakshakChatInput.disabled = false;

    renderChatMessages();
  }

  // Feature #6: Stop / Skip AI response typing handler
  if (rakshakStopBtn) {
    rakshakStopBtn.addEventListener('click', () => {
      if (activeTypingMessageId && activeTypingFullText) {
        completeTyping(activeTypingMessageId, activeTypingFullText);
      }
    });
  }

  // Safe Mock Response Generator (Development Fallback before backend /api/chat is added)
  function generateSafeMockResponse(query) {
    const q = (query || '').toLowerCase();

    if (q.includes('icu') || q.includes('ventilator')) {
      const availHospitals = hospitals.filter(h => (h.icuBeds || 0) > 0);
      let listStr = availHospitals.slice(0, 4).map((h, i) =>
        `${i + 1}. **${h.name}** (${h.district})\n   - Available ICU Beds: **${h.icuBeds}**\n   - Ventilators: **${h.ventilators || 0}**\n   - Contact: ${h.phone || '033-2320-3040'}`
      ).join('\n\n');

      return `I found verified hospitals in West Bengal with available **ICU Beds**:\n\n${listStr}\n\n*Please confirm real-time admission directly with the hospital emergency desk.*`;
    }

    if (q.includes('blood') || q.includes('donor') || q.includes('platelet')) {
      return `### 🩸 Emergency Blood Services — West Bengal\n\nYou can access verified blood banks and statewide emergency blood services:\n\n1. **BloodConnect Portal**: Search active inventory across all 23 districts.\n2. **Emergency Broadcast**: Dispatch requests to multiple hospital blood banks simultaneously.\n3. **Volunteer Donor Network**: Alert registered matching ABO/Rh donors.\n\nClick the **Blood Bank** tab in the navigation or use the quick action chip below to view current stock.`;
    }

    if (q.includes('medical') || q.includes('shop') || q.includes('pharmacy') || q.includes('medicine')) {
      return `### 💊 24×7 Emergency Medical Shops\n\nWest Bengal provides verified all-night pharmacies equipped with emergency medications, injectables, and oxygen cylinders:\n\n- **Kolkata & Suburbs**: 24/7 hospital pharmacies and verified private dispensaries.\n- **Districts**: Sub-divisional medical shops with emergency supplies.\n\nUse the **24×7 Medical Shop** section to search by district or find the nearest pharmacy via GPS proximity.`;
    }

    if (q.includes('intake') || q.includes('referral') || q.includes('transfer') || q.includes('admission')) {
      return `### 📋 Emergency Patient Intake & Triage\n\nFor acute admissions and emergency triage:\n\n1. Use the **Patient Intake Form** on this platform to initiate emergency pre-registration.\n2. Clinicians can create verified **Inter-Hospital Referrals** with complete clinical handoff parameters (vitals, diagnosis, blood/ICU requirements).\n3. Hospital staff can track real-time transfer readiness across West Bengal facilities.`;
    }

    if (q.includes('ambulance') || q.includes('112') || q.includes('emergency')) {
      return `### 🚨 Immediate Emergency Protocol\n\n- **National Emergency Hotline**: Call **112** or **102** immediately for ambulance dispatch.\n- **Statewide Triage**: Locate the nearest emergency-ready facility with available general and ICU beds.\n\n*Dr. Rakshak is an AI health assistant. For life-threatening acute conditions, contact emergency services without delay.*`;
    }

    // Default safe assistance response
    return `Hello! I can assist you with:\n\n- 🛏️ **Hospital Bed Tracking**: General, ICU, and Oxygen bed availability across 23 districts.\n- 🩸 **Blood Services**: Real-time blood bank inventory and emergency broadcast.\n- 💊 **24×7 Medical Shops**: Night pharmacies and emergency medical supplies.\n- 📋 **Patient Intake & Referrals**: Structured emergency handoffs.\n\nHow can I assist you with your healthcare inquiry today?`;
  }

  // Fetch AI Response (Handles backend API with graceful safe mock fallback)
  async function fetchAIResponse(query, conversationHistory, generation) {
    try {
      const res = await apiRequest('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          history: conversationHistory
        })
      });

      if (currentConversationGeneration !== generation) return null;

      if (res && res.data && (res.data.reply || res.data.message)) {
        return res.data.reply || res.data.message;
      }
      if (res && res.message) {
        return res.message;
      }
      return generateSafeMockResponse(query);
    } catch (err) {
      if (currentConversationGeneration !== generation) return null;

      // If backend /api/chat is not yet implemented (e.g. 404/405/500), use safe dev mock
      if (err.status === 404 || err.status === 502 || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        await new Promise(r => setTimeout(r, 600)); // Natural processing simulation
        if (currentConversationGeneration !== generation) return null;
        return generateSafeMockResponse(query);
      }

      // Propagate genuine error
      throw err;
    }
  }

  const SAFE_HISTORY_CONTENT_LIMIT = 1800;

  /**
   * Helper: Prepare sanitized, safe conversation history for /api/chat
   * Enforces 1800-character safe limit per history item.
   * Full message text remains untouched in chatMessages for user UI.
   */
  function prepareSafeHistoryPayload(messages) {
    if (!Array.isArray(messages)) return [];

    return messages
      .filter(m => m && m.status === 'completed' && typeof m.content === 'string' && m.content.trim())
      .slice(-6)
      .map(m => {
        let content = m.content.trim();
        if (content.length > SAFE_HISTORY_CONTENT_LIMIT) {
          // Truncate cleanly at a sentence, paragraph, or word boundary
          let candidate = content.slice(0, SAFE_HISTORY_CONTENT_LIMIT);
          const lastBoundary = Math.max(
            candidate.lastIndexOf('\n\n'),
            candidate.lastIndexOf('\n'),
            candidate.lastIndexOf('. '),
            candidate.lastIndexOf('? '),
            candidate.lastIndexOf('! ')
          );

          if (lastBoundary > 1200) {
            candidate = candidate.slice(0, lastBoundary + 1).trim();
          } else {
            const lastSpace = candidate.lastIndexOf(' ');
            if (lastSpace > 1400) {
              candidate = candidate.slice(0, lastSpace).trim();
            }
          }

          content = (candidate || content.slice(0, SAFE_HISTORY_CONTENT_LIMIT)).trim();
        }

        // Hard clamp to guarantee <= 1800 under all conditions
        if (content.length > SAFE_HISTORY_CONTENT_LIMIT) {
          content = content.slice(0, SAFE_HISTORY_CONTENT_LIMIT).trim();
        }

        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: content
        };
      })
      .filter(m => Boolean(m.content));
  }

  // Send Chat Message Controller (Features #1, #2, #4, #13, #14)
  async function sendChatMessage(rawText, options = {}) {
    const text = (rawText || '').trim();
    if (!text) return;

    // Prevent concurrent duplicate execution (Feature #1, #2)
    if ((chatState === 'PROCESSING' || chatState === 'TYPING') && !options.isRegenerate) {
      return;
    }

    const generation = currentConversationGeneration;

    // Check offline status (Feature #13)
    if (!navigator.onLine) {
      const userMsgId = 'usr_' + Date.now();
      const assistantMsgId = 'ai_' + (Date.now() + 1);

      if (!options.isRegenerate) {
        chatMessages.push({
          id: userMsgId,
          role: 'user',
          content: text,
          timestamp: getFormattedTimestamp()
        });
      }

      chatMessages.push({
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: getFormattedTimestamp(),
        status: 'error',
        errorMessage: "You're offline. Check your internet connection and try again.",
        originalQuery: text,
        errorStatus: 0
      });

      chatState = 'ERROR';
      renderChatMessages();
      return;
    }

    let assistantMsgId;
    let userMsgId;

    if (options.isRegenerate && options.targetMessageId) {
      // Feature #8: Replace existing assistant message with processing state
      const targetMsg = chatMessages.find(m => m.id === options.targetMessageId);
      if (targetMsg) {
        assistantMsgId = targetMsg.id;
        targetMsg.status = 'processing';
        targetMsg.content = '';
        targetMsg.feedback = null;
        targetMsg.timestamp = getFormattedTimestamp();
      } else {
        assistantMsgId = 'ai_' + Date.now();
        chatMessages.push({
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp: getFormattedTimestamp(),
          status: 'processing',
          feedback: null,
          originalQuery: text,
          isNew: true
        });
      }
    } else {
      userMsgId = 'usr_' + Date.now();
      assistantMsgId = 'ai_' + (Date.now() + 1);

      chatMessages.push({
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: getFormattedTimestamp()
      });

      chatMessages.push({
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: getFormattedTimestamp(),
        status: 'processing',
        feedback: null,
        originalQuery: text,
        isNew: true
      });
    }

    chatState = 'PROCESSING';
    if (rakshakChatInput) {
      rakshakChatInput.value = '';
      rakshakChatInput.style.height = 'auto';
    }
    if (rakshakSendBtn) rakshakSendBtn.disabled = true;

    renderChatMessages();

    // Prepare conversation context (Safely bounded to <= 1800 chars per message)
    const historyPayload = prepareSafeHistoryPayload(chatMessages);

    try {
      const responseText = await fetchAIResponse(text, historyPayload, generation);

      if (currentConversationGeneration !== generation) {
        // Stale response protection (Section 25 / Feature #12)
        return;
      }

      if (!responseText || typeof responseText !== 'string' || !responseText.trim()) {
        const msg = chatMessages.find(m => m.id === assistantMsgId);
        if (msg) {
          msg.status = 'error';
          msg.errorMessage = 'The AI service returned an empty response. Please retry.';
        }
        chatState = 'ERROR';
        if (rakshakSendBtn) rakshakSendBtn.disabled = false;
        renderChatMessages();
        return;
      }

      const msg = chatMessages.find(m => m.id === assistantMsgId);
      if (msg) {
        msg.content = responseText;
      }

      // Feature #4: Transition from processing eye to natural typing
      startNaturalTyping(assistantMsgId, responseText, generation);

    } catch (err) {
      if (currentConversationGeneration !== generation) return;

      const msg = chatMessages.find(m => m.id === assistantMsgId);
      if (msg) {
        msg.status = 'error';
        msg.errorMessage = err.status === 429
          ? 'Too many requests right now. Please wait a moment and try again.'
          : (err.status === 503 || err.status === 502
              ? 'The AI service is temporarily unavailable. Please try again.'
              : (err.message || 'Unable to connect to the AI service. Please try again.'));
        msg.errorStatus = err.status || 500;
      }

      chatState = 'ERROR';
      if (rakshakSendBtn) rakshakSendBtn.disabled = false;
      if (rakshakStopBtn) rakshakStopBtn.hidden = true;
      renderChatMessages();
    }
  }

  // Handle Form Submission
  if (rakshakInputForm) {
    rakshakInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (chatState === 'PROCESSING' || chatState === 'TYPING') return;
      const val = (rakshakChatInput?.value || '').trim();
      if (val) {
        sendChatMessage(val);
      }
    });
  }

  // Feature #11: Suggested Questions click listener
  if (rakshakSuggestedQuestions) {
    rakshakSuggestedQuestions.addEventListener('click', (e) => {
      if (chatState === 'PROCESSING' || chatState === 'TYPING') return;
      const chip = e.target.closest('.rakshak-prompt-chip');
      if (!chip) return;
      const promptText = chip.getAttribute('data-prompt');
      if (promptText) {
        sendChatMessage(promptText);
      }
    });
  }

  // Feature #10: Emergency Quick Actions click listener
  if (rakshakQuickActions) {
    rakshakQuickActions.addEventListener('click', (e) => {
      const chip = e.target.closest('.rakshak-chip-btn');
      if (!chip) return;
      const action = chip.getAttribute('data-action');

      if (action === 'find_hospitals') {
        toggleRakshakChat(false);
        const findBedsSec = document.getElementById('find-beds');
        if (findBedsSec) findBedsSec.scrollIntoView({ behavior: 'smooth' });
      } else if (action === 'find_icu') {
        toggleRakshakChat(false);
        if (filterBedType) filterBedType.value = 'icu';
        searchHospitals();
        const findBedsSec = document.getElementById('find-beds');
        if (findBedsSec) findBedsSec.scrollIntoView({ behavior: 'smooth' });
      } else if (action === 'find_blood') {
        toggleRakshakChat(false);
        showBloodBankPortal(false);
      } else if (action === 'medical_shops') {
        toggleRakshakChat(false);
        showMedicalShopPortal(false);
      } else if (action === 'ambulance' || action === 'find_ambulance') {
        toggleRakshakChat(false);
        showAmbulancePortal(true);
      } else if (action === 'patient_intake') {
        toggleRakshakChat(false);
        const intakeSec = document.getElementById('emergency-patient-intake');
        if (intakeSec) intakeSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Message Actions Event Delegation (Copy, Regenerate, Feedback, Retry)
  if (rakshakMessagesList) {
    rakshakMessagesList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const msgId = btn.getAttribute('data-id');
      const msg = chatMessages.find(m => m.id === msgId);
      if (!msg) return;

      // Feature #7: Copy AI Response
      if (action === 'copy') {
        const textToCopy = getCleanMessageText(msg.content);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              msg.copied = true;
              renderChatMessages();
              setTimeout(() => {
                msg.copied = false;
                renderChatMessages();
              }, 2000);
            })
            .catch(() => {
              showToast('Copy failed. Please select and copy manually.');
            });
        } else {
          try {
            const tempTa = document.createElement('textarea');
            tempTa.value = textToCopy;
            document.body.appendChild(tempTa);
            tempTa.select();
            document.execCommand('copy');
            document.body.removeChild(tempTa);
            msg.copied = true;
            renderChatMessages();
            setTimeout(() => {
              msg.copied = false;
              renderChatMessages();
            }, 2000);
          } catch (err) {
            showToast('Copy failed. Please select and copy manually.');
          }
        }
      }

      // Feature #8: Regenerate AI Response
      else if (action === 'regenerate') {
        if (chatState === 'PROCESSING' || chatState === 'TYPING') return;
        sendChatMessage(msg.originalQuery, { isRegenerate: true, targetMessageId: msg.id });
      }

      // Feature #9: Feedback 👍 Helpful
      else if (action === 'feedback-helpful') {
        msg.feedback = msg.feedback === 'helpful' ? null : 'helpful';
        renderChatMessages();
      }

      // Feature #9: Feedback 👎 Not Helpful
      else if (action === 'feedback-not-helpful') {
        msg.feedback = msg.feedback === 'not_helpful' ? null : 'not_helpful';
        renderChatMessages();
      }

      // Feature #13: Retry failed request
      else if (action === 'retry') {
        if (chatState === 'PROCESSING' || chatState === 'TYPING') return;
        // Remove the failed assistant message and resend query
        chatMessages = chatMessages.filter(m => m.id !== msgId);
        sendChatMessage(msg.originalQuery, { isRegenerate: true, targetMessageId: msg.id });
      }
    });
  }

  // Feature #12: New Chat / Reset Conversation
  function triggerNewChat() {
    if (chatMessages.length === 0) {
      resetChatState();
      return;
    }
    // Show confirmation modal
    if (rakshakResetModalOverlay) {
      rakshakResetModalOverlay.hidden = false;
    }
  }

  function resetChatState() {
    if (activeTypingTimer) {
      clearTimeout(activeTypingTimer);
      activeTypingTimer = null;
    }

    currentConversationGeneration++;
    chatMessages = [];
    chatState = 'IDLE';
    activeTypingMessageId = null;
    activeTypingFullText = '';

    if (rakshakChatInput) {
      rakshakChatInput.value = '';
      rakshakChatInput.style.height = 'auto';
      rakshakChatInput.disabled = false;
    }
    if (rakshakStopBtn) rakshakStopBtn.hidden = true;
    if (rakshakSendBtn) rakshakSendBtn.disabled = false;
    if (rakshakResetModalOverlay) rakshakResetModalOverlay.hidden = true;

    renderChatMessages();
  }

  if (rakshakNewChatBtn) {
    rakshakNewChatBtn.addEventListener('click', triggerNewChat);
  }
  if (rakshakResetCancelBtn) {
    rakshakResetCancelBtn.addEventListener('click', () => {
      if (rakshakResetModalOverlay) rakshakResetModalOverlay.hidden = true;
    });
  }
  if (rakshakResetConfirmBtn) {
    rakshakResetConfirmBtn.addEventListener('click', resetChatState);
  }

  // Initialize Welcome State
  renderChatMessages();

})();


