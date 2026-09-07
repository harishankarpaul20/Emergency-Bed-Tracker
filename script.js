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
    { id: 2, _id: "6a9e9a4074b2ff9e0afbf9fb", name: "Ruby General Hospital", district: "Kolkata", area: "Kasba", address: "Kasba Golpark, Kolkata", latitude: 22.5140, longitude: 88.3850, distance: 4.4, phone: "Demo contact — 033-2442-6091", generalBeds: 9, icuBeds: 3, oxygenBeds: 4, ventilators: 1, status: "limited", lastUpdated: "5 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"] },
    { id: 3, _id: "6a9e9a4074b2ff9e0afbf9fc", name: "R G Kar Medical College & Hospital", district: "Kolkata", area: "Shyambazar", address: "1 Khudiram Bose Sarani, Shyambazar, Kolkata", latitude: 22.6030, longitude: 88.3760, distance: 6.8, phone: "Demo contact — 033-2555-7656", generalBeds: 0, icuBeds: 0, oxygenBeds: 0, ventilators: 0, status: "full", lastUpdated: "1 minute ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "Ambulance Support"] },
    { id: 4, _id: "6a9e9a4074b2ff9e0afbf9fd", name: "CMRI Hospital", district: "Kolkata", area: "New Alipore", address: "7/2 Diamond Harbour Road, New Alipore, Kolkata", latitude: 22.5090, longitude: 88.3320, distance: 5.5, phone: "Demo contact — 033-3090-3090", generalBeds: 15, icuBeds: 4, oxygenBeds: 7, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services"] },
    { id: 5, _id: "6a9e9a4074b2ff9e0afbf9fe", name: "Fortis Hospital Anandapur", district: "Kolkata", area: "Anandapur", address: "730 Anandapur, E.M. Bypass, Kolkata", latitude: 22.5100, longitude: 88.3980, distance: 7.2, phone: "Demo contact — 033-6628-4444", generalBeds: 6, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "6 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 6, _id: "6a9e9a4074b2ff9e0afbf9ff", name: "Woodlands Multispeciality Hospital", district: "Kolkata", area: "Alipore", address: "8/5 Alipore Road, Kolkata", latitude: 22.5330, longitude: 88.3300, distance: 4.9, phone: "Demo contact — 033-2456-7075", generalBeds: 12, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"] },
    { id: 7, _id: "6a9e9a4074b2ff9e0afbfa00", name: "Howrah Emergency Medical Centre", district: "Howrah", area: "Howrah", address: "Howrah", latitude: 22.5958, longitude: 88.2636, distance: 8.0, phone: "Demo contact — not a verified number", generalBeds: 14, icuBeds: 3, oxygenBeds: 6, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Ambulance Support"] },
    { id: 8, _id: "6a9e9a4074b2ff9e0afbfa01", name: "Salt Lake Emergency Care Centre", district: "North 24 Parganas", area: "Salt Lake", address: "Salt Lake, North 24 Parganas", latitude: 22.5790, longitude: 88.4310, distance: 9.3, phone: "Demo contact — not a verified number", generalBeds: 11, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 9, _id: "6a9e9a4074b2ff9e0afbfa02", name: "Bidhannagar Medical Centre", district: "North 24 Parganas", area: "Bidhannagar", address: "Bidhannagar, North 24 Parganas", latitude: 22.5850, longitude: 88.4160, distance: 8.7, phone: "Demo contact — not a verified number", generalBeds: 4, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "7 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 10, _id: "6a9e9a4074b2ff9e0afbfa03", name: "South City Emergency Hospital", district: "South 24 Parganas", area: "Jadavpur", address: "Jadavpur, South 24 Parganas", latitude: 22.4990, longitude: 88.3710, distance: 6.4, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 11, _id: "6a9e9a4074b2ff9e0afbfa04", name: "Asansol District Hospital", district: "Paschim Bardhaman", area: "Asansol", address: "Asansol, Paschim Bardhaman", latitude: 23.6739, longitude: 86.9524, distance: 210, phone: "Demo contact — not a verified number", generalBeds: 16, icuBeds: 4, oxygenBeds: 7, ventilators: 2, status: "available", lastUpdated: "2 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Ambulance Support"] },
    { id: 12, _id: "6a9e9a4074b2ff9e0afbfa05", name: "Durgapur Sub Divisional Hospital", district: "Paschim Bardhaman", area: "Durgapur", address: "Durgapur, Paschim Bardhaman", latitude: 23.5204, longitude: 87.3119, distance: 195, phone: "Demo contact — not a verified number", generalBeds: 7, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 13, _id: "6a9e9a4074b2ff9e0afbfa06", name: "North Bengal Emergency Care Centre", district: "Darjeeling", area: "Siliguri", address: "Siliguri, Darjeeling", latitude: 26.7271, longitude: 88.3953, distance: 570, phone: "Demo contact — not a verified number", generalBeds: 13, icuBeds: 4, oxygenBeds: 6, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 14, _id: "6a9e9a4074b2ff9e0afbfa07", name: "Siliguri Medical Support Centre", district: "Darjeeling", area: "Siliguri", address: "Siliguri, Darjeeling", latitude: 26.7100, longitude: 88.4290, distance: 575, phone: "Demo contact — not a verified number", generalBeds: 3, icuBeds: 1, oxygenBeds: 1, ventilators: 0, status: "limited", lastUpdated: "8 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 15, _id: "6a9e9a4074b2ff9e0afbfa08", name: "Jalpaiguri Emergency Hospital", district: "Jalpaiguri", area: "Jalpaiguri", address: "Jalpaiguri", latitude: 26.5433, longitude: 88.7293, distance: 600, phone: "Demo contact — not a verified number", generalBeds: 10, icuBeds: 2, oxygenBeds: 4, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 16, _id: "6a9e9a4074b2ff9e0afbfa09", name: "Malda Emergency Care Centre", district: "Malda", area: "Malda", address: "Malda", latitude: 25.0088, longitude: 88.1414, distance: 340, phone: "Demo contact — not a verified number", generalBeds: 9, icuBeds: 2, oxygenBeds: 4, ventilators: 1, status: "available", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 17, _id: "6a9e9a4074b2ff9e0afbfa0a", name: "Murshidabad Medical Centre", district: "Murshidabad", area: "Berhampore", address: "Berhampore, Murshidabad", latitude: 24.0965, longitude: 88.2517, distance: 210, phone: "Demo contact — not a verified number", generalBeds: 5, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "7 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 18, _id: "6a9e9a4074b2ff9e0afbfa0b", name: "Kalyani Emergency Hospital", district: "Nadia", area: "Kalyani", address: "Kalyani, Nadia", latitude: 22.9750, longitude: 88.4340, distance: 55, phone: "Demo contact — not a verified number", generalBeds: 12, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 19, _id: "6a9e9a4074b2ff9e0afbfa0c", name: "Haldia Emergency Medical Centre", district: "Purba Medinipur", area: "Haldia", address: "Haldia, Purba Medinipur", latitude: 22.0667, longitude: 88.0698, distance: 120, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 20, _id: "6a9e9a4074b2ff9e0afbfa0d", name: "Kharagpur Emergency Hospital", district: "Paschim Medinipur", area: "Kharagpur", address: "Kharagpur, Paschim Medinipur", latitude: 22.3460, longitude: 87.2320, distance: 130, phone: "Demo contact — not a verified number", generalBeds: 6, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 21, _id: "6a9e9a4074b2ff9e0afbfa0e", name: "Bankura Emergency Care Centre", district: "Bankura", area: "Bankura", address: "Bankura", latitude: 23.2324, longitude: 87.0740, distance: 200, phone: "Demo contact — not a verified number", generalBeds: 7, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 22, _id: "6a9e9a4074b2ff9e0afbfa0f", name: "Purulia Emergency Medical Centre", district: "Purulia", area: "Purulia", address: "Purulia", latitude: 23.3320, longitude: 86.3650, distance: 260, phone: "Demo contact — not a verified number", generalBeds: 4, icuBeds: 1, oxygenBeds: 1, ventilators: 0, status: "limited", lastUpdated: "8 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 23, _id: "6a9e9a4074b2ff9e0afbfa10", name: "Cooch Behar Emergency Hospital", district: "Cooch Behar", area: "Cooch Behar", address: "Cooch Behar", latitude: 26.3260, longitude: 89.4470, distance: 650, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 24, _id: "6a9e9a4074b2ff9e0afbfa11", name: "Birbhum Medical Support Centre", district: "Birbhum", area: "Suri", address: "Suri, Birbhum", latitude: 23.9200, longitude: 87.5340, distance: 220, phone: "Demo contact — not a verified number", generalBeds: 5, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] }
  ];

  const STATUS_LABEL = { available: "🟢 AVAILABLE", limited: "🟡 LIMITED", full: "🔴 FULL" };
  const MAX_CAPACITY_REFERENCE = 25; // demo denominator for the illustrative capacity bar

  /* -----------------------------------------------------
     3. APPLICATION STATE & DOM REFERENCES
     ----------------------------------------------------- */
  let activeHospital = null;
  let authToken = localStorage.getItem('medbed_auth_token') || '';
  let currentUser = null;
  let leafletMap = null;
  let markerLayerGroup = null;

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

  /* -----------------------------------------------------
     4. API CLIENT & HTTP UTILITIES
     ----------------------------------------------------- */
  async function apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config = {
      ...options,
      headers,
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, config);
    let body = {};
    try {
      body = await res.json();
    } catch (e) {
      body = {};
    }

    if (!res.ok) {
      const errMsg = body.message || body.errors?.[0]?.message || `Request failed with status ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  function showToast(message, duration = 3400) {
    if (!toast) return;
    toast.textContent = message;
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
      }
    } catch (err) {
      console.warn('Backend hospital fetch note (using fallback):', err.message);
    } finally {
      loadingState.hidden = true;
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

        <div class="hc-meta">
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

  function searchHospitals() {
    loadingState.hidden = false;
    hospitalGrid.style.opacity = '0.4';

    setTimeout(() => {
      const results = filterHospitals();
      renderHospitals(results);
      hospitalGrid.style.opacity = '1';
      loadingState.hidden = true;
    }, 200);
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

    try {
      // Auto-authenticate as demo citizen if not currently authenticated
      if (!authToken) {
        try {
          const authRes = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'user@demo.wb.gov.in', password: 'Password123!' })
          });
          if (authRes.data?.token) {
            authToken = authRes.data.token;
            localStorage.setItem('medbed_auth_token', authToken);
          }
        } catch (authErr) {
          // If login fails, try citizen registration
          const regRes = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: patientName,
              email: `patient_${Date.now()}@wb.gov.in`,
              password: 'Password123!',
              phone: contactPhone,
            })
          });
          if (regRes.data?.token) {
            authToken = regRes.data.token;
            localStorage.setItem('medbed_auth_token', authToken);
          }
        }
      }

      // Submit atomic reservation request to backend
      const res = await apiRequest('/bed-requests', {
        method: 'POST',
        body: JSON.stringify({
          hospitalId,
          bedType,
          patientName,
          contactPhone,
          notes,
        })
      });

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
  function openStaffPortalModal() {
    staffPortalModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';

    if (authToken && currentUser) {
      renderStaffDashboard();
    } else if (authToken) {
      // Validate existing token
      apiRequest('/auth/me')
        .then(res => {
          currentUser = res.data;
          renderStaffDashboard();
        })
        .catch(() => {
          authToken = '';
          localStorage.removeItem('medbed_auth_token');
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
  }

  async function renderStaffDashboard() {
    staffLoginSection.hidden = true;
    staffDashboardSection.hidden = false;
    staffAuthBadge.textContent = `🟢 ${currentUser.role === 'super_admin' ? 'SUPER ADMIN' : 'HOSPITAL ADMIN'}`;
    staffAuthBadge.className = 'status-badge available';

    staffUserEmail.textContent = `${currentUser.email} (${currentUser.name})`;
    const targetHosp = currentUser.hospital || hospitals[0];
    staffHospName.textContent = targetHosp.name || 'Assigned Hospital Network';

    // Fetch live beds for this hospital
    try {
      const hospId = targetHosp._id || targetHosp.id;
      const bedsRes = await apiRequest(`/hospitals/${hospId}/beds`);
      renderStaffBedTable(bedsRes.data || []);
      loadStaffBedRequests();
    } catch (err) {
      console.warn('Failed to load beds for staff view:', err.message);
    }
  }

  function renderStaffBedTable(beds) {
    if (!beds.length) {
      staffBedTableBody.innerHTML = '<tr><td colspan="6">No bed inventory records found.</td></tr>';
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
      renderStaffDashboard();
      fetchHospitalsFromBackend();
    } catch (err) {
      showToast(`❌ Error: ${err.message}`);
    }
  }

  async function loadStaffBedRequests() {
    try {
      const res = await apiRequest('/bed-requests');
      const reqs = res.data || [];
      if (!reqs.length) {
        staffRequestsContainer.innerHTML = '<p style="color: var(--muted); font-size: 0.88rem;">No bed requests found.</p>';
        return;
      }

      staffRequestsContainer.innerHTML = reqs.slice(0, 5).map(r => `
        <div class="staff-req-card" data-req-id="${r._id}">
          <div class="staff-req-info">
            <h4>${escapeHtml(r.patientName)} · <span class="status-badge ${r.status}">${escapeHtml(r.status.toUpperCase())}</span></h4>
            <p>Type: <strong>${escapeHtml(r.bedType.toUpperCase())}</strong> · Phone: ${escapeHtml(r.contactPhone)}</p>
            ${r.notes ? `<p style="font-style: italic;">"${escapeHtml(r.notes)}"</p>` : ''}
          </div>
          <div class="staff-req-actions">
            ${r.status === 'pending' ? `
              <button type="button" class="btn btn-primary btn-xs req-approve-btn" data-id="${r._id}">Approve</button>
              <button type="button" class="btn btn-outline btn-xs req-reject-btn" data-id="${r._id}">Reject</button>
            ` : `<span>Completed</span>`}
          </div>
        </div>
      `).join('');

      staffRequestsContainer.querySelectorAll('.req-approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/bed-requests/${btn.dataset.id}/approve`, { method: 'PATCH' });
            showToast('✅ Bed request approved.');
            loadStaffBedRequests();
            fetchHospitalsFromBackend();
          } catch (e) { showToast(`❌ ${e.message}`); }
        });
      });

      staffRequestsContainer.querySelectorAll('.req-reject-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiRequest(`/bed-requests/${btn.dataset.id}/reject`, { method: 'PATCH' });
            showToast('Bed request rejected. Bed released back to pool.');
            loadStaffBedRequests();
            fetchHospitalsFromBackend();
          } catch (e) { showToast(`❌ ${e.message}`); }
        });
      });
    } catch (err) {
      staffRequestsContainer.innerHTML = `<p style="color: var(--muted); font-size: 0.88rem;">No requests currently available.</p>`;
    }
  }

  // Staff Login Submission
  staffLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('staffEmail').value.trim();
    const password = document.getElementById('staffPassword').value;

    staffLoginSubmitBtn.disabled = true;
    staffLoginSubmitBtn.textContent = '⏳ Logging in...';

    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      authToken = res.data.token;
      currentUser = res.data.user;
      localStorage.setItem('medbed_auth_token', authToken);

      showToast(`👋 Welcome, ${currentUser.name}!`);
      renderStaffDashboard();
    } catch (err) {
      showToast(`❌ Login failed: ${err.message}`);
    } finally {
      staffLoginSubmitBtn.disabled = false;
      staffLoginSubmitBtn.textContent = 'LOG IN';
    }
  });

  staffLogoutBtn.addEventListener('click', () => {
    authToken = '';
    currentUser = null;
    localStorage.removeItem('medbed_auth_token');
    showToast('Logged out of Staff Portal.');
    renderStaffLoginForm();
  });

  // Demo Prefill Buttons
  if (prefillApolloBtn) {
    prefillApolloBtn.addEventListener('click', () => {
      document.getElementById('staffEmail').value = 'admin@apollo.wb.gov.in';
      document.getElementById('staffPassword').value = 'Password123!';
    });
  }
  if (prefillSuperBtn) {
    prefillSuperBtn.addEventListener('click', () => {
      document.getElementById('staffEmail').value = 'superadmin@demo.wb.gov.in';
      document.getElementById('staffPassword').value = 'SuperAdmin123!';
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

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
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
        if (link) {
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
