const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const { formatBedSummary } = require('./bedService');

/**
 * Haversine formula for calculating distance in km between two geo-coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Builds and executes a search/filter query for hospitals with bed inventory joined
 */
async function searchHospitals(queryParams = {}) {
  const {
    page = 1,
    limit = 50,
    search,
    district,
    city,
    bedType = 'all',
    availability = 'all',
    lat,
    lng,
    availableOnly,
  } = queryParams;

  const filter = { isActive: true };

  // Filter by District
  if (district && district !== 'all') {
    filter.district = new RegExp(`^${district.trim()}$`, 'i');
  }

  // Filter by City / Area
  if (city && city !== 'all') {
    filter.area = new RegExp(`^${city.trim()}$`, 'i');
  }

  // Text search query
  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { district: { $regex: s, $options: 'i' } },
      { area: { $regex: s, $options: 'i' } },
      { address: { $regex: s, $options: 'i' } },
    ];
  }

  // Fetch matched hospitals
  const hospitals = await Hospital.find(filter).lean();
  if (!hospitals.length) {
    return {
      hospitals: [],
      pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 },
    };
  }

  const hospitalIds = hospitals.map((h) => h._id);

  // Fetch all bed records for these hospitals
  const allBeds = await Bed.find({ hospital: { $in: hospitalIds }, isActive: true }).lean();

  // Group beds by hospital
  const bedsByHospital = {};
  for (const b of allBeds) {
    const hid = b.hospital.toString();
    if (!bedsByHospital[hid]) bedsByHospital[hid] = [];
    bedsByHospital[hid].push(b);
  }

  // Combine hospital with bed summary
  let enriched = hospitals.map((h) => {
    const beds = bedsByHospital[h._id.toString()] || [];
    const summary = formatBedSummary(beds);

    // Calculate distance if user lat/lng provided, else default to realistic fallback
    const userLat = lat ? parseFloat(lat) : 22.5726; // default center: Kolkata
    const userLng = lng ? parseFloat(lng) : 88.3639;
    const distance = calculateDistance(userLat, userLng, h.latitude, h.longitude);

    return {
      id: h._id.toString(), // ID string for frontend convenience
      _id: h._id,
      name: h.name,
      district: h.district,
      area: h.area,
      address: h.address,
      phone: h.phone,
      email: h.email,
      website: h.website,
      latitude: h.latitude,
      longitude: h.longitude,
      hospitalType: h.hospitalType,
      verified: h.isVerified,
      facilities: h.facilities || [],
      distance,
      ...summary,
    };
  });

  // Bed Type filter
  if (bedType && bedType !== 'all') {
    enriched = enriched.filter((h) => {
      if (bedType === 'general') return h.generalBeds > 0;
      if (bedType === 'icu') return h.icuBeds > 0;
      if (bedType === 'oxygen') return h.oxygenBeds > 0;
      if (bedType === 'ventilator') return h.ventilators > 0;
      return true;
    });
  }

  // Availability filter
  if (availability && availability !== 'all') {
    enriched = enriched.filter((h) => h.status === availability);
  }

  if (availableOnly === 'true' || availableOnly === true) {
    enriched = enriched.filter((h) => h.status === 'available');
  }

  // Sort by distance ascending
  enriched.sort((a, b) => a.distance - b.distance);

  // Pagination
  const total = enriched.length;
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.max(1, parseInt(limit, 10));
  const pages = Math.ceil(total / l) || 1;
  const paginated = enriched.slice((p - 1) * l, p * l);

  return {
    hospitals: paginated,
    pagination: {
      page: p,
      limit: l,
      total,
      pages,
    },
  };
}

/**
 * Aggregate state-wide metrics across all hospitals and bed collections
 */
async function getNetworkStatistics() {
  const activeHospitals = await Hospital.find({ isActive: true }).lean();
  const hospitalIds = activeHospitals.map((h) => h._id);

  const districtsCovered = new Set(activeHospitals.map((h) => h.district)).size;
  const totalHospitals = activeHospitals.length;

  const beds = await Bed.find({ hospital: { $in: hospitalIds }, isActive: true }).lean();

  let totalBeds = 0;
  let totalIcu = 0;
  let availableBedsCount = 0;

  // Group beds by hospital to calculate hospital statuses
  const bedsByHospital = {};
  for (const b of beds) {
    totalBeds += b.totalBeds;
    if (b.type === 'icu') totalIcu += b.availableBeds;
    availableBedsCount += b.availableBeds;

    const hid = b.hospital.toString();
    if (!bedsByHospital[hid]) bedsByHospital[hid] = [];
    bedsByHospital[hid].push(b);
  }

  let availableHospitals = 0;
  let fullHospitals = 0;
  let limitedHospitals = 0;

  for (const h of activeHospitals) {
    const hBeds = bedsByHospital[h._id.toString()] || [];
    const summary = formatBedSummary(hBeds);
    if (summary.status === 'available') availableHospitals++;
    else if (summary.status === 'full') fullHospitals++;
    else limitedHospitals++;
  }

  return {
    districtsCovered,
    totalHospitals,
    totalBedsTracked: totalBeds,
    totalIcuBeds: totalIcu,
    availableHospitals,
    limitedHospitals,
    fullHospitals,
    totalAvailableBeds: availableBedsCount,
  };
}

/**
 * Returns list of West Bengal districts and count of hospitals in each
 */
async function getDistrictBreakdown() {
  const breakdown = await Hospital.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$district', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return breakdown.map((item) => ({
    district: item._id,
    count: item.count,
  }));
}

module.exports = {
  calculateDistance,
  searchHospitals,
  getNetworkStatistics,
  getDistrictBreakdown,
};
