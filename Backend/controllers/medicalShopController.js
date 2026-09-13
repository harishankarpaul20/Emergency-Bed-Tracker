const MedicalShop = require('../models/MedicalShop');
const logger = require('../utils/logger');

/**
 * Haversine formula to calculate distance in km between two geo-coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
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
 * Dynamic Google Maps URL helper based on coordinates or address
 */
function buildGoogleMapsUrl(shop) {
  if (shop.googleMapsUrl && shop.googleMapsUrl.startsWith('http')) {
    return shop.googleMapsUrl;
  }
  if (shop.latitude != null && shop.longitude != null && !isNaN(shop.latitude) && !isNaN(shop.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
  }
  const query = [shop.name, shop.address, shop.area, shop.city, shop.district, 'West Bengal']
    .filter(Boolean)
    .join(', ');
  return query.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

/**
 * @desc    Get active 24x7 medical shops with search, district filter & distance sorting
 * @route   GET /api/medical-shops
 * @access  Public
 */
const getMedicalShops = async (req, res, next) => {
  try {
    const { search, district, area, city, is24x7, latitude, longitude } = req.query;

    const filter = { isActive: true };

    // 24x7 filter (default: return 24x7 if requested or true)
    if (is24x7 === 'true' || is24x7 === true) {
      filter.is24x7 = true;
    }

    // District filter
    if (district && district !== 'all') {
      filter.district = new RegExp(`^${district.trim()}$`, 'i');
    }

    // Area filter
    if (area && area !== 'all') {
      filter.area = new RegExp(area.trim(), 'i');
    }

    // City filter
    if (city && city !== 'all') {
      filter.city = new RegExp(city.trim(), 'i');
    }

    // General text search (name, area, city, district, address)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: searchRegex },
        { area: searchRegex },
        { city: searchRegex },
        { district: searchRegex },
        { address: searchRegex },
        { landmark: searchRegex },
      ];
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const rawShops = await MedicalShop.find(filter)
      .sort({ is24x7: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const userLat = latitude ? parseFloat(latitude) : null;
    const userLon = longitude ? parseFloat(longitude) : null;
    const hasUserCoords = userLat != null && userLon != null && !isNaN(userLat) && !isNaN(userLon);

    // Map formatted shops with distance & dynamic directionsUrl
    let shops = rawShops.map((s) => {
      const distance = hasUserCoords && s.latitude != null && s.longitude != null
        ? calculateDistance(userLat, userLon, s.latitude, s.longitude)
        : null;

      return {
        _id: s._id,
        name: s.name,
        address: s.address,
        area: s.area,
        city: s.city || 'Kolkata',
        district: s.district,
        state: s.state || 'West Bengal',
        pincode: s.pincode || '',
        landmark: s.landmark || '',
        phone: s.phone,
        alternatePhone: s.alternatePhone || '',
        email: s.email || '',
        is24x7: Boolean(s.is24x7),
        latitude: s.latitude,
        longitude: s.longitude,
        directionsUrl: buildGoogleMapsUrl(s),
        description: s.description || '',
        services: s.services || ['Allopathic Medicines', 'Emergency First Aid'],
        distance,
        createdAt: s.createdAt,
      };
    });

    // If user coordinates provided, sort by nearest distance first
    if (hasUserCoords) {
      shops.sort((a, b) => {
        if (a.distance != null && b.distance != null) return a.distance - b.distance;
        if (a.distance != null) return -1;
        if (b.distance != null) return 1;
        return 0;
      });
    }

    res.status(200).json({
      success: true,
      count: shops.length,
      medicalShops: shops,
    });
  } catch (error) {
    logger.error('Error in getMedicalShops:', error);
    next(error);
  }
};

/**
 * @desc    Get single medical shop by ID
 * @route   GET /api/medical-shops/:id
 * @access  Public
 */
const getMedicalShopById = async (req, res, next) => {
  try {
    const shop = await MedicalShop.findOne({ _id: req.params.id, isActive: true }).lean();

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Medical shop not found or inactive',
        errors: [],
      });
    }

    res.status(200).json({
      success: true,
      medicalShop: {
        ...shop,
        directionsUrl: buildGoogleMapsUrl(shop),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new medical shop (Staff / Admin)
 * @route   POST /api/medical-shops
 * @access  Private (Staff / Admin)
 */
const createMedicalShop = async (req, res, next) => {
  try {
    const {
      name,
      address,
      area,
      city,
      district,
      state,
      pincode,
      landmark,
      phone,
      alternatePhone,
      email,
      licenseNumber,
      is24x7,
      latitude,
      longitude,
      googleMapsUrl,
      description,
      services,
    } = req.body;

    // Duplicate detection: check if a shop with same name and phone or same name and address exists in same district
    const existingShop = await MedicalShop.findOne({
      district: new RegExp(`^${district.trim()}$`, 'i'),
      name: new RegExp(`^${name.trim()}$`, 'i'),
      $or: [
        { phone: phone.trim() },
        { address: new RegExp(`^${address.trim()}$`, 'i') },
      ],
    });

    if (existingShop) {
      return res.status(409).json({
        success: false,
        message: `A medical shop with the name '${name}' and same contact/address already exists in ${district}.`,
        errors: [{ field: 'name', message: 'Duplicate pharmacy record' }],
      });
    }

    const shop = await MedicalShop.create({
      name: name.trim(),
      address: address.trim(),
      area: area.trim(),
      city: (city || 'Kolkata').trim(),
      district: district.trim(),
      state: (state || 'West Bengal').trim(),
      pincode: (pincode || '').trim(),
      landmark: (landmark || '').trim(),
      phone: phone.trim(),
      alternatePhone: (alternatePhone || '').trim(),
      email: (email || '').trim().toLowerCase(),
      licenseNumber: (licenseNumber || '').trim(),
      is24x7: is24x7 !== false,
      latitude: latitude != null && !isNaN(latitude) ? parseFloat(latitude) : undefined,
      longitude: longitude != null && !isNaN(longitude) ? parseFloat(longitude) : undefined,
      googleMapsUrl: (googleMapsUrl || '').trim(),
      description: (description || '').trim(),
      services: Array.isArray(services) && services.length ? services : ['Allopathic Medicines', 'Emergency First Aid'],
      isActive: true,
    });

    logger.info(`💊 Medical Shop created [ID: ${shop._id}] - ${shop.name} (${shop.district})`);

    res.status(201).json({
      success: true,
      message: 'Medical shop registered successfully',
      medicalShop: {
        ...shop.toObject(),
        directionsUrl: buildGoogleMapsUrl(shop),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update medical shop details (Staff / Admin)
 * @route   PUT /api/medical-shops/:id
 * @access  Private (Staff / Admin)
 */
const updateMedicalShop = async (req, res, next) => {
  try {
    const shop = await MedicalShop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Medical shop not found',
        errors: [],
      });
    }

    const updatableFields = [
      'name',
      'address',
      'area',
      'city',
      'district',
      'pincode',
      'landmark',
      'phone',
      'alternatePhone',
      'email',
      'licenseNumber',
      'is24x7',
      'latitude',
      'longitude',
      'googleMapsUrl',
      'description',
      'services',
      'isActive',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        shop[field] = req.body[field];
      }
    });

    await shop.save();

    res.status(200).json({
      success: true,
      message: 'Medical shop updated successfully',
      medicalShop: {
        ...shop.toObject(),
        directionsUrl: buildGoogleMapsUrl(shop),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete medical shop (Admin)
 * @route   DELETE /api/medical-shops/:id
 * @access  Private (Super Admin / Hospital Admin)
 */
const deleteMedicalShop = async (req, res, next) => {
  try {
    const shop = await MedicalShop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Medical shop not found',
        errors: [],
      });
    }

    await MedicalShop.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Medical shop removed successfully',
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMedicalShops,
  getMedicalShopById,
  createMedicalShop,
  updateMedicalShop,
  deleteMedicalShop,
};
