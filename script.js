/* =========================================================
   EMERGENCY BED TRACKER — WEST BENGAL — SCRIPT
   ========================================================= */

(function () {
  'use strict';

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
     2. SAMPLE / DEMO HOSPITAL DATA
     All bed counts below are FICTIONAL DEMO DATA.
     Where a real hospital name is used, only its general
     public location is referenced — bed numbers are invented
     for demonstration purposes only and are not accurate.
     ----------------------------------------------------- */
  const hospitals = [
    { id: 1, name: "Apollo Multispeciality Hospitals", district: "Kolkata", area: "Kankurgachi", address: "58 Canal Circular Road, Kolkata", latitude: 22.5820, longitude: 88.3960, distance: 3.1, phone: "Demo contact — not a verified number", generalBeds: 18, icuBeds: 5, oxygenBeds: 8, ventilators: 2, status: "available", lastUpdated: "2 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services", "Ambulance Support"] },
    { id: 2, name: "Ruby General Hospital", district: "Kolkata", area: "Kasba", address: "Kasba Golpark, Kolkata", latitude: 22.5140, longitude: 88.3850, distance: 4.4, phone: "Demo contact — not a verified number", generalBeds: 9, icuBeds: 3, oxygenBeds: 4, ventilators: 1, status: "limited", lastUpdated: "5 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"] },
    { id: 3, name: "R G Kar Medical College & Hospital", district: "Kolkata", area: "Shyambazar", address: "1 Khudiram Bose Sarani, Shyambazar, Kolkata", latitude: 22.6030, longitude: 88.3760, distance: 6.8, phone: "Demo contact — not a verified number", generalBeds: 0, icuBeds: 0, oxygenBeds: 0, ventilators: 0, status: "full", lastUpdated: "1 minute ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "Ambulance Support"] },
    { id: 4, name: "CMRI Hospital", district: "Kolkata", area: "New Alipore", address: "7/2 Diamond Harbour Road, New Alipore, Kolkata", latitude: 22.5090, longitude: 88.3320, distance: 5.5, phone: "Demo contact — not a verified number", generalBeds: 15, icuBeds: 4, oxygenBeds: 7, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services"] },
    { id: 5, name: "Fortis Hospital Anandapur", district: "Kolkata", area: "Anandapur", address: "730 Anandapur, E.M. Bypass, Kolkata", latitude: 22.5100, longitude: 88.3980, distance: 7.2, phone: "Demo contact — not a verified number", generalBeds: 6, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "6 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 6, name: "Woodlands Multispeciality Hospital", district: "Kolkata", area: "Alipore", address: "8/5 Alipore Road, Kolkata", latitude: 22.5330, longitude: 88.3300, distance: 4.9, phone: "Demo contact — not a verified number", generalBeds: 12, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: true, demoRecord: false, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"] },
    { id: 7, name: "Howrah Emergency Medical Centre", district: "Howrah", area: "Howrah", address: "Howrah", latitude: 22.5958, longitude: 88.2636, distance: 8.0, phone: "Demo contact — not a verified number", generalBeds: 14, icuBeds: 3, oxygenBeds: 6, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Ambulance Support"] },
    { id: 8, name: "Salt Lake Emergency Care Centre", district: "North 24 Parganas", area: "Salt Lake", address: "Salt Lake, North 24 Parganas", latitude: 22.5790, longitude: 88.4310, distance: 9.3, phone: "Demo contact — not a verified number", generalBeds: 11, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 9, name: "Bidhannagar Medical Centre", district: "North 24 Parganas", area: "Bidhannagar", address: "Bidhannagar, North 24 Parganas", latitude: 22.5850, longitude: 88.4160, distance: 8.7, phone: "Demo contact — not a verified number", generalBeds: 4, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "7 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 10, name: "South City Emergency Hospital", district: "South 24 Parganas", area: "Jadavpur", address: "Jadavpur, South 24 Parganas", latitude: 22.4990, longitude: 88.3710, distance: 6.4, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 11, name: "Asansol District Hospital", district: "Paschim Bardhaman", area: "Asansol", address: "Asansol, Paschim Bardhaman", latitude: 23.6739, longitude: 86.9524, distance: 210, phone: "Demo contact — not a verified number", generalBeds: 16, icuBeds: 4, oxygenBeds: 7, ventilators: 2, status: "available", lastUpdated: "2 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Ambulance Support"] },
    { id: 12, name: "Durgapur Sub Divisional Hospital", district: "Paschim Bardhaman", area: "Durgapur", address: "Durgapur, Paschim Bardhaman", latitude: 23.5204, longitude: 87.3119, distance: 195, phone: "Demo contact — not a verified number", generalBeds: 7, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 13, name: "North Bengal Emergency Care Centre", district: "Darjeeling", area: "Siliguri", address: "Siliguri, Darjeeling", latitude: 26.7271, longitude: 88.3953, distance: 570, phone: "Demo contact — not a verified number", generalBeds: 13, icuBeds: 4, oxygenBeds: 6, ventilators: 2, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 14, name: "Siliguri Medical Support Centre", district: "Darjeeling", area: "Siliguri", address: "Siliguri, Darjeeling", latitude: 26.7100, longitude: 88.4290, distance: 575, phone: "Demo contact — not a verified number", generalBeds: 3, icuBeds: 1, oxygenBeds: 1, ventilators: 0, status: "limited", lastUpdated: "8 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 15, name: "Jalpaiguri Emergency Hospital", district: "Jalpaiguri", area: "Jalpaiguri", address: "Jalpaiguri", latitude: 26.5433, longitude: 88.7293, distance: 600, phone: "Demo contact — not a verified number", generalBeds: 10, icuBeds: 2, oxygenBeds: 4, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 16, name: "Malda Emergency Care Centre", district: "Malda", area: "Malda", address: "Malda", latitude: 25.0088, longitude: 88.1414, distance: 340, phone: "Demo contact — not a verified number", generalBeds: 9, icuBeds: 2, oxygenBeds: 4, ventilators: 1, status: "available", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 17, name: "Murshidabad Medical Centre", district: "Murshidabad", area: "Berhampore", address: "Berhampore, Murshidabad", latitude: 24.0965, longitude: 88.2517, distance: 210, phone: "Demo contact — not a verified number", generalBeds: 5, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "7 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 18, name: "Kalyani Emergency Hospital", district: "Nadia", area: "Kalyani", address: "Kalyani, Nadia", latitude: 22.9750, longitude: 88.4340, distance: 55, phone: "Demo contact — not a verified number", generalBeds: 12, icuBeds: 3, oxygenBeds: 5, ventilators: 1, status: "available", lastUpdated: "3 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"] },
    { id: 19, name: "Haldia Emergency Medical Centre", district: "Purba Medinipur", area: "Haldia", address: "Haldia, Purba Medinipur", latitude: 22.0667, longitude: 88.0698, distance: 120, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 20, name: "Kharagpur Emergency Hospital", district: "Paschim Medinipur", area: "Kharagpur", address: "Kharagpur, Paschim Medinipur", latitude: 22.3460, longitude: 87.2320, distance: 130, phone: "Demo contact — not a verified number", generalBeds: 6, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 21, name: "Bankura Emergency Care Centre", district: "Bankura", area: "Bankura", address: "Bankura", latitude: 23.2324, longitude: 87.0740, distance: 200, phone: "Demo contact — not a verified number", generalBeds: 7, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "5 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 22, name: "Purulia Emergency Medical Centre", district: "Purulia", area: "Purulia", address: "Purulia", latitude: 23.3320, longitude: 86.3650, distance: 260, phone: "Demo contact — not a verified number", generalBeds: 4, icuBeds: 1, oxygenBeds: 1, ventilators: 0, status: "limited", lastUpdated: "8 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] },
    { id: 23, name: "Cooch Behar Emergency Hospital", district: "Cooch Behar", area: "Cooch Behar", address: "Cooch Behar", latitude: 26.3260, longitude: 89.4470, distance: 650, phone: "Demo contact — not a verified number", generalBeds: 8, icuBeds: 2, oxygenBeds: 3, ventilators: 1, status: "available", lastUpdated: "4 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "ICU", "Oxygen Support"] },
    { id: 24, name: "Birbhum Medical Support Centre", district: "Birbhum", area: "Suri", address: "Suri, Birbhum", latitude: 23.9200, longitude: 87.5340, distance: 220, phone: "Demo contact — not a verified number", generalBeds: 5, icuBeds: 1, oxygenBeds: 2, ventilators: 0, status: "limited", lastUpdated: "6 minutes ago", verified: false, demoRecord: true, facilities: ["Emergency Department", "Oxygen Support"] }
  ];

  const STATUS_LABEL = { available: "🟢 AVAILABLE", limited: "🟡 LIMITED", full: "🔴 FULL" };
  const MAX_CAPACITY_REFERENCE = 25; // demo denominator for the illustrative capacity bar

  /* -----------------------------------------------------
     3. DOM REFERENCES
     ----------------------------------------------------- */
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

  /* -----------------------------------------------------
     4. UTILITIES
     ----------------------------------------------------- */
  function showToast(message, duration = 3200) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, duration);
  }

  function escapeHtml(str) {
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
    return R * c;
  }

  /* -----------------------------------------------------
     5. POPULATE DISTRICT / CITY DROPDOWNS
     ----------------------------------------------------- */
  function populateDistrictDropdown() {
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
    )).sort();
    areas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      filterCity.appendChild(opt);
    });
    // Preserve selection if still valid, else reset
    if (areas.includes(current)) filterCity.value = current;
  }

  filterDistrict.addEventListener('change', () => {
    populateCityDropdown(filterDistrict.value);
    syncDistrictChips(filterDistrict.value);
  });

  /* -----------------------------------------------------
     6. DISTRICT EXPLORER CHIPS
     ----------------------------------------------------- */
  function renderDistrictExplorer() {
    const counts = {};
    hospitals.forEach(h => { counts[h.district] = (counts[h.district] || 0) + 1; });

    const chipsHtml = DISTRICTS.slice().sort().map(d => {
      const count = counts[d] || 0;
      return `<button type="button" class="district-chip" data-district="${escapeHtml(d)}">
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
     7. RENDER HOSPITAL CARDS
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
    const statusLabel = isFull ? "🔴 CURRENTLY FULL" : STATUS_LABEL[h.status];
    const totalBeds = h.generalBeds + h.icuBeds + h.oxygenBeds;
    const capacityPct = Math.min(100, Math.round((totalBeds / MAX_CAPACITY_REFERENCE) * 100));
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ', ' + h.address)}`;

    return `
      <article class="hospital-card" data-id="${h.id}" tabindex="0" aria-label="${escapeHtml(h.name)}">
        <div class="hc-top">
          <div class="hc-title-row">
            <span class="hc-icon" aria-hidden="true">🏥</span>
            <div>
              <h3 class="hc-name">${escapeHtml(h.name)}</h3>
              ${h.verified
                ? '<p class="hc-verified">✓ Verified location</p>'
                : '<p class="hc-demo-tag">⚠ Demo Hospital Record</p>'}
            </div>
          </div>
          <span class="status-badge ${h.status}">${statusLabel}</span>
        </div>

        <div class="hc-meta">
          <span>📍 ${escapeHtml(h.district)}</span>
          <span>📍 ${escapeHtml(h.area)}</span>
          <span>${h.distance.toFixed(1)} km away</span>
        </div>

        <div class="hc-beds">
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.generalBeds)}">${h.generalBeds}</span>
            <span class="hc-bed-label">General</span>
          </div>
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.icuBeds)}">${h.icuBeds}</span>
            <span class="hc-bed-label">ICU</span>
          </div>
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.oxygenBeds)}">${h.oxygenBeds}</span>
            <span class="hc-bed-label">Oxygen</span>
          </div>
          <div class="hc-bed-stat">
            <span class="${bedNumClass(h.ventilators)}">${h.ventilators}</span>
            <span class="hc-bed-label">Vent.</span>
          </div>
        </div>

        <div class="hc-capacity">
          <span class="hc-capacity-label"><span>General capacity (demo)</span><span>${capacityPct}%</span></span>
          <div class="hc-capacity-track">
            <div class="${capacityFillClass(h.status)}" style="width:${capacityPct}%"></div>
          </div>
        </div>

        <p class="hc-updated">Last demo update: ${escapeHtml(h.lastUpdated)}</p>
        <p class="hc-demo-note">DEMO DATA — not real-time.</p>

        <div class="hc-actions">
          <button class="btn btn-primary btn-sm view-details-btn" data-id="${h.id}">VIEW DETAILS</button>
          <a href="tel:112" class="btn btn-outline btn-sm">📞 CALL</a>
          <a href="${directionsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">🗺️ DIRECTIONS</a>
        </div>
      </article>
    `;
  }

  function renderHospitals(list) {
    if (!list.length) {
      hospitalGrid.innerHTML = '';
      emptyState.hidden = false;
      resultsMeta.textContent = `Showing 0 of ${hospitals.length} demo hospitals`;
      return;
    }
    emptyState.hidden = true;
    hospitalGrid.innerHTML = list.map(renderHospitalCard).join('');
    resultsMeta.textContent = `Showing ${list.length} of ${hospitals.length} demo hospitals`;

    hospitalGrid.querySelectorAll('.view-details-btn').forEach(btn => {
      btn.addEventListener('click', () => showHospitalDetails(Number(btn.dataset.id)));
    });
  }

  /* -----------------------------------------------------
     8. FILTER FUNCTIONS
     ----------------------------------------------------- */
  function filterByBedType(list, bedType) {
    if (bedType === 'general') return list.filter(h => h.generalBeds > 0);
    if (bedType === 'icu') return list.filter(h => h.icuBeds > 0);
    if (bedType === 'oxygen') return list.filter(h => h.oxygenBeds > 0);
    if (bedType === 'ventilator') return list.filter(h => h.ventilators > 0);
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

    if (district !== 'all') list = list.filter(h => h.district === district);
    if (city !== 'all') list = list.filter(h => h.area === city);
    list = filterByBedType(list, bedType);
    list = filterByAvailability(list, availability);

    if (query) {
      list = list.filter(h => {
        const haystack = `${h.name} ${h.district} ${h.area} ${h.address}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    return list.sort((a, b) => a.distance - b.distance);
  }

  function searchHospitals() {
    loadingState.hidden = false;
    hospitalGrid.style.opacity = '0.4';

    // Small delay to simulate a search — purely a UI affordance for the demo.
    setTimeout(() => {
      const results = filterHospitals();
      renderHospitals(results);
      hospitalGrid.style.opacity = '1';
      loadingState.hidden = true;
    }, 350);
  }

  function clearFilters() {
    filterDistrict.value = 'all';
    populateCityDropdown('all');
    filterBedType.value = 'all';
    filterAvailability.value = 'all';
    filterSearch.value = '';
    syncDistrictChips('all');
    renderHospitals(hospitals.slice().sort((a, b) => a.distance - b.distance));
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
     9. HOSPITAL DETAILS MODAL
     ----------------------------------------------------- */
  const modalOverlay = document.getElementById('modalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCloseBtn2 = document.getElementById('modalCloseBtn2');
  let lastFocusedEl = null;

  function showHospitalDetails(id) {
    const h = hospitals.find(x => x.id === id);
    if (!h) return;

    document.getElementById('modalHospitalName').textContent = h.name;
    const verifiedEl = document.getElementById('modalVerified');
    verifiedEl.textContent = h.verified ? '✓ Verified location' : '⚠ Demo Hospital Record';
    verifiedEl.style.color = h.verified ? 'var(--success)' : 'var(--warning)';

    const badge = document.getElementById('modalStatusBadge');
    const isFull = h.generalBeds === 0 && h.icuBeds === 0 && h.oxygenBeds === 0;
    badge.className = 'status-badge ' + h.status;
    badge.textContent = isFull ? '🔴 CURRENTLY FULL' : STATUS_LABEL[h.status];

    document.getElementById('modalDistrict').textContent = h.district;
    document.getElementById('modalArea').textContent = h.area;
    document.getElementById('modalAddress').textContent = h.address;
    document.getElementById('modalEmergencyDept').textContent = h.facilities.includes('Emergency Department') ? 'Yes, 24/7' : 'Not listed';
    document.getElementById('modalPhone').textContent = h.phone;
    document.getElementById('modalLastUpdated').textContent = h.lastUpdated;

    document.getElementById('modalGeneralBeds').textContent = h.generalBeds;
    document.getElementById('modalIcuBeds').textContent = h.icuBeds;
    document.getElementById('modalOxygenBeds').textContent = h.oxygenBeds;
    document.getElementById('modalVentilators').textContent = h.ventilators;

    document.getElementById('modalFacilities').innerHTML =
      h.facilities.map(f => `<li>${escapeHtml(f)}</li>`).join('');

    document.getElementById('modalCallBtn').href = 'tel:112';
    document.getElementById('modalDirectionsBtn').href = getDirectionsUrl(h);

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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); });

  /* -----------------------------------------------------
     10. DIRECTIONS + CALL HELPERS
     ----------------------------------------------------- */
  function getDirectionsUrl(h) {
    // Generated from hospital name + address rather than hardcoded coordinates.
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ', ' + h.address)}`;
  }

  function getDirections(h) {
    window.open(getDirectionsUrl(h), '_blank', 'noopener');
  }

  function callHospital() {
    window.location.href = 'tel:112';
  }

  /* -----------------------------------------------------
     11. MOBILE NAVIGATION
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
     12. DYNAMIC STATISTICS
     ----------------------------------------------------- */
  function updateStatistics() {
    const districtsCovered = new Set(hospitals.map(h => h.district)).size;
    const totalHospitals = hospitals.length;
    const totalBeds = hospitals.reduce((sum, h) => sum + h.generalBeds + h.icuBeds + h.oxygenBeds, 0);
    const totalIcu = hospitals.reduce((sum, h) => sum + h.icuBeds, 0);
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

  /* -----------------------------------------------------
     13. ANIMATED NUMBER COUNTERS (on viewport entry)
     ----------------------------------------------------- */
  function animateCounter(el) {
    const target = Number(el.dataset.countTarget || el.dataset.count || 0);
    const duration = 1100;
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

  /* -----------------------------------------------------
     14. SCROLL REVEAL
     ----------------------------------------------------- */
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
        // Demo only — this coordinate is used in-memory for sorting and is not stored.
        const { latitude, longitude } = position.coords;

        hospitals.forEach(h => {
          h.distance = Number(calculateDistance(latitude, longitude, h.latitude, h.longitude).toFixed(1));
        });

        renderHospitals(filterHospitals());
        showToast('Your location detected. Hospitals sorted by distance.');
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
     16. MAP (Leaflet + OpenStreetMap, no API key required)
     ----------------------------------------------------- */
  function initMap() {
    const mapEl = document.getElementById('hospitalMap');
    const fallback = document.getElementById('mapFallback');
    if (!mapEl || typeof L === 'undefined') {
      if (fallback) fallback.hidden = false;
      if (mapEl) mapEl.style.display = 'none';
      return;
    }

    // Center on West Bengal generally (roughly around Kolkata / central WB)
    const map = L.map(mapEl, { scrollWheelZoom: false }).setView([23.6, 87.8], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const statusColor = { available: '#16A34A', limited: '#F59E0B', full: '#DC2626' };

    hospitals.forEach(h => {
      const marker = L.circleMarker([h.latitude, h.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: statusColor[h.status],
        fillOpacity: 0.95
      }).addTo(map);

      const totalBeds = h.generalBeds + h.icuBeds + h.oxygenBeds;
      const popupHtml = `
        <div class="map-popup-title">${escapeHtml(h.name)}</div>
        <div class="map-popup-line">${escapeHtml(h.district)} · ${totalBeds} demo beds</div>
        <div class="map-popup-line">${STATUS_LABEL[h.status]}</div>
        <a href="#" class="map-popup-link" data-id="${h.id}">View Details →</a>
      `;
      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const link = document.querySelector(`.leaflet-popup-content a[data-id="${h.id}"]`);
        if (link) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            showHospitalDetails(h.id);
          });
        }
      });
    });
  }

  /* -----------------------------------------------------
     17. INITIAL SETUP
     ----------------------------------------------------- */
  function init() {
    populateDistrictDropdown();
    populateCityDropdown('all');
    renderDistrictExplorer();
    updateStatistics();
    renderHospitals(hospitals.slice().sort((a, b) => a.distance - b.distance));

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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
