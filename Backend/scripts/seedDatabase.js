require('../config/bootstrap');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Bed = require('../models/Bed');
const BedRequest = require('../models/BedRequest');
const { connectDB, disconnectDB } = require('../config/db');

// The 24 demo hospitals accurately representing West Bengal's healthcare network from script.js
const DEMO_HOSPITALS = [
  {
    name: "Apollo Multispeciality Hospitals",
    district: "Kolkata",
    area: "Kankurgachi",
    address: "58 Canal Circular Road, Kolkata",
    latitude: 22.5820,
    longitude: 88.3960,
    phone: "Demo contact — 033-2320-3040",
    email: "apollo.kolkata@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: true,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services", "Ambulance Support"],
    beds: { general: { total: 30, occupied: 12, reserved: 0 }, icu: { total: 10, occupied: 5, reserved: 0 }, oxygen: { total: 15, occupied: 7, reserved: 0 }, ventilator: { total: 5, occupied: 3, reserved: 0 } }
  },
  {
    name: "Ruby General Hospital",
    district: "Kolkata",
    area: "Kasba",
    address: "Kasba Golpark, Kolkata",
    latitude: 22.5140,
    longitude: 88.3850,
    phone: "Demo contact — 033-2442-6091",
    email: "ruby.general@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: true,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"],
    beds: { general: { total: 20, occupied: 11, reserved: 0 }, icu: { total: 8, occupied: 5, reserved: 0 }, oxygen: { total: 10, occupied: 6, reserved: 0 }, ventilator: { total: 3, occupied: 2, reserved: 0 } }
  },
  {
    name: "R G Kar Medical College & Hospital",
    district: "Kolkata",
    area: "Shyambazar",
    address: "1 Khudiram Bose Sarani, Shyambazar, Kolkata",
    latitude: 22.6030,
    longitude: 88.3760,
    phone: "Demo contact — 033-2555-7656",
    email: "rgkar.hospital@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: true,
    facilities: ["Emergency Department", "Ambulance Support"],
    beds: { general: { total: 25, occupied: 25, reserved: 0 }, icu: { total: 8, occupied: 8, reserved: 0 }, oxygen: { total: 12, occupied: 12, reserved: 0 }, ventilator: { total: 4, occupied: 4, reserved: 0 } }
  },
  {
    name: "CMRI Hospital",
    district: "Kolkata",
    area: "New Alipore",
    address: "7/2 Diamond Harbour Road, New Alipore, Kolkata",
    latitude: 22.5090,
    longitude: 88.3320,
    phone: "Demo contact — 033-3090-3090",
    email: "cmri.kolkata@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: true,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Diagnostic Services"],
    beds: { general: { total: 25, occupied: 10, reserved: 0 }, icu: { total: 8, occupied: 4, reserved: 0 }, oxygen: { total: 12, occupied: 5, reserved: 0 }, ventilator: { total: 4, occupied: 2, reserved: 0 } }
  },
  {
    name: "Fortis Hospital Anandapur",
    district: "Kolkata",
    area: "Anandapur",
    address: "730 Anandapur, E.M. Bypass, Kolkata",
    latitude: 22.5100,
    longitude: 88.3980,
    phone: "Demo contact — 033-6628-4444",
    email: "fortis.anandapur@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: true,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"],
    beds: { general: { total: 15, occupied: 9, reserved: 0 }, icu: { total: 6, occupied: 4, reserved: 0 }, oxygen: { total: 8, occupied: 5, reserved: 0 }, ventilator: { total: 3, occupied: 2, reserved: 0 } }
  },
  {
    name: "Woodlands Multispeciality Hospital",
    district: "Kolkata",
    area: "Alipore",
    address: "8/5 Alipore Road, Kolkata",
    latitude: 22.5330,
    longitude: 88.3300,
    phone: "Demo contact — 033-2456-7075",
    email: "woodlands.alipore@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: true,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Diagnostic Services"],
    beds: { general: { total: 20, occupied: 8, reserved: 0 }, icu: { total: 6, occupied: 3, reserved: 0 }, oxygen: { total: 10, occupied: 5, reserved: 0 }, ventilator: { total: 3, occupied: 2, reserved: 0 } }
  },
  {
    name: "Howrah Emergency Medical Centre",
    district: "Howrah",
    area: "Howrah",
    address: "Howrah Station Road, Howrah",
    latitude: 22.5958,
    longitude: 88.2636,
    phone: "Demo contact — 033-2641-1000",
    email: "howrah.emc@demo.wb.gov.in",
    hospitalType: "public",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Ambulance Support"],
    beds: { general: { total: 22, occupied: 8, reserved: 0 }, icu: { total: 6, occupied: 3, reserved: 0 }, oxygen: { total: 10, occupied: 4, reserved: 0 }, ventilator: { total: 4, occupied: 2, reserved: 0 } }
  },
  {
    name: "Salt Lake Emergency Care Centre",
    district: "North 24 Parganas",
    area: "Salt Lake",
    address: "Salt Lake Sector 3, North 24 Parganas",
    latitude: 22.5790,
    longitude: 88.4310,
    phone: "Demo contact — 033-2334-5000",
    email: "saltlake.ecc@demo.wb.gov.in",
    hospitalType: "specialty",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"],
    beds: { general: { total: 18, occupied: 7, reserved: 0 }, icu: { total: 5, occupied: 2, reserved: 0 }, oxygen: { total: 8, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Bidhannagar Medical Centre",
    district: "North 24 Parganas",
    area: "Bidhannagar",
    address: "Bidhannagar Sub-Division, North 24 Parganas",
    latitude: 22.5850,
    longitude: 88.4160,
    phone: "Demo contact — 033-2359-2000",
    email: "bidhannagar.mc@demo.wb.gov.in",
    hospitalType: "public",
    isVerified: false,
    facilities: ["Emergency Department", "Oxygen Support"],
    beds: { general: { total: 15, occupied: 11, reserved: 0 }, icu: { total: 4, occupied: 3, reserved: 0 }, oxygen: { total: 6, occupied: 4, reserved: 0 }, ventilator: { total: 2, occupied: 2, reserved: 0 } }
  },
  {
    name: "South City Emergency Hospital",
    district: "South 24 Parganas",
    area: "Jadavpur",
    address: "Prince Anwar Shah Road, Jadavpur, South 24 Parganas",
    latitude: 22.4990,
    longitude: 88.3710,
    phone: "Demo contact — 033-2414-7000",
    email: "southcity.hospital@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 16, occupied: 8, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 7, occupied: 4, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Asansol District Hospital",
    district: "Paschim Bardhaman",
    area: "Asansol",
    address: "Hospital Road, Asansol, Paschim Bardhaman",
    latitude: 23.6739,
    longitude: 86.9524,
    phone: "Demo contact — 0341-225-1000",
    email: "asansol.dh@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy", "Ambulance Support"],
    beds: { general: { total: 26, occupied: 10, reserved: 0 }, icu: { total: 8, occupied: 4, reserved: 0 }, oxygen: { total: 12, occupied: 5, reserved: 0 }, ventilator: { total: 4, occupied: 2, reserved: 0 } }
  },
  {
    name: "Durgapur Sub Divisional Hospital",
    district: "Paschim Bardhaman",
    area: "Durgapur",
    address: "City Centre, Durgapur, Paschim Bardhaman",
    latitude: 23.5204,
    longitude: 87.3119,
    phone: "Demo contact — 0343-254-2000",
    email: "durgapur.sdh@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 18, occupied: 11, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 8, occupied: 5, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "North Bengal Emergency Care Centre",
    district: "Darjeeling",
    area: "Siliguri",
    address: "Hill Cart Road, Siliguri, Darjeeling",
    latitude: 26.7271,
    longitude: 88.3953,
    phone: "Demo contact — 0353-252-3000",
    email: "northbengal.ecc@demo.wb.gov.in",
    hospitalType: "specialty",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"],
    beds: { general: { total: 22, occupied: 9, reserved: 0 }, icu: { total: 7, occupied: 3, reserved: 0 }, oxygen: { total: 10, occupied: 4, reserved: 0 }, ventilator: { total: 3, occupied: 1, reserved: 0 } }
  },
  {
    name: "Siliguri Medical Support Centre",
    district: "Darjeeling",
    area: "Siliguri",
    address: "Sevoke Road, Siliguri, Darjeeling",
    latitude: 26.7100,
    longitude: 88.4290,
    phone: "Demo contact — 0353-254-4000",
    email: "siliguri.msc@demo.wb.gov.in",
    hospitalType: "private",
    isVerified: false,
    facilities: ["Emergency Department", "Oxygen Support"],
    beds: { general: { total: 12, occupied: 9, reserved: 0 }, icu: { total: 3, occupied: 2, reserved: 0 }, oxygen: { total: 4, occupied: 3, reserved: 0 }, ventilator: { total: 1, occupied: 1, reserved: 0 } }
  },
  {
    name: "Jalpaiguri Emergency Hospital",
    district: "Jalpaiguri",
    area: "Jalpaiguri",
    address: "Station Road, Jalpaiguri",
    latitude: 26.5433,
    longitude: 88.7293,
    phone: "Demo contact — 03561-230-100",
    email: "jalpaiguri.eh@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 18, occupied: 8, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 7, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Malda Emergency Care Centre",
    district: "Malda",
    area: "Malda",
    address: "English Bazar, Malda",
    latitude: 25.0088,
    longitude: 88.1414,
    phone: "Demo contact — 03512-252-000",
    email: "malda.ecc@demo.wb.gov.in",
    hospitalType: "public",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 16, occupied: 7, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 8, occupied: 4, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Murshidabad Medical Centre",
    district: "Murshidabad",
    area: "Berhampore",
    address: "Berhampore Town, Murshidabad",
    latitude: 24.0965,
    longitude: 88.2517,
    phone: "Demo contact — 03482-250-100",
    email: "murshidabad.mc@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "Oxygen Support"],
    beds: { general: { total: 14, occupied: 9, reserved: 0 }, icu: { total: 4, occupied: 3, reserved: 0 }, oxygen: { total: 6, occupied: 4, reserved: 0 }, ventilator: { total: 2, occupied: 2, reserved: 0 } }
  },
  {
    name: "Kalyani Emergency Hospital",
    district: "Nadia",
    area: "Kalyani",
    address: "Central Park, Kalyani, Nadia",
    latitude: 22.9750,
    longitude: 88.4340,
    phone: "Demo contact — 033-2582-8000",
    email: "kalyani.eh@demo.wb.gov.in",
    hospitalType: "public",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support", "Pharmacy"],
    beds: { general: { total: 20, occupied: 8, reserved: 0 }, icu: { total: 6, occupied: 3, reserved: 0 }, oxygen: { total: 8, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Haldia Emergency Medical Centre",
    district: "Purba Medinipur",
    area: "Haldia",
    address: "Port City, Haldia, Purba Medinipur",
    latitude: 22.0667,
    longitude: 88.0698,
    phone: "Demo contact — 03224-274-000",
    email: "haldia.emc@demo.wb.gov.in",
    hospitalType: "specialty",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 15, occupied: 7, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 6, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Kharagpur Emergency Hospital",
    district: "Paschim Medinipur",
    area: "Kharagpur",
    address: "Railway Settlement, Kharagpur, Paschim Medinipur",
    latitude: 22.3460,
    longitude: 87.2320,
    phone: "Demo contact — 03222-220-100",
    email: "kharagpur.eh@demo.wb.gov.in",
    hospitalType: "public",
    isVerified: false,
    facilities: ["Emergency Department", "Oxygen Support"],
    beds: { general: { total: 14, occupied: 8, reserved: 0 }, icu: { total: 4, occupied: 3, reserved: 0 }, oxygen: { total: 5, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 2, reserved: 0 } }
  },
  {
    name: "Bankura Emergency Care Centre",
    district: "Bankura",
    area: "Bankura",
    address: "College Road, Bankura",
    latitude: 23.2324,
    longitude: 87.0740,
    phone: "Demo contact — 03242-250-000",
    email: "bankura.ecc@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 15, occupied: 8, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 6, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Purulia Emergency Medical Centre",
    district: "Purulia",
    area: "Purulia",
    address: "Main Road, Purulia",
    latitude: 23.3320,
    longitude: 86.3650,
    phone: "Demo contact — 03252-222-100",
    email: "purulia.emc@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "Oxygen Support"],
    beds: { general: { total: 12, occupied: 8, reserved: 0 }, icu: { total: 3, occupied: 2, reserved: 0 }, oxygen: { total: 4, occupied: 3, reserved: 0 }, ventilator: { total: 1, occupied: 1, reserved: 0 } }
  },
  {
    name: "Cooch Behar Emergency Hospital",
    district: "Cooch Behar",
    area: "Cooch Behar",
    address: "Palace Road, Cooch Behar",
    latitude: 26.3260,
    longitude: 89.4470,
    phone: "Demo contact — 03582-222-000",
    email: "coochbehar.eh@demo.wb.gov.in",
    hospitalType: "government",
    isVerified: false,
    facilities: ["Emergency Department", "ICU", "Oxygen Support"],
    beds: { general: { total: 16, occupied: 8, reserved: 0 }, icu: { total: 5, occupied: 3, reserved: 0 }, oxygen: { total: 6, occupied: 3, reserved: 0 }, ventilator: { total: 2, occupied: 1, reserved: 0 } }
  },
  {
    name: "Birbhum Medical Support Centre",
    district: "Birbhum",
    area: "Suri",
    address: "Suri Sadar, Birbhum",
    latitude: 23.9200,
    longitude: 87.5340,
    phone: "Demo contact — 03462-255-000",
    email: "birbhum.msc@demo.wb.gov.in",
    hospitalType: "public",
    isVerified: false,
    facilities: ["Emergency Department", "Oxygen Support"],
    beds: { general: { total: 13, occupied: 8, reserved: 0 }, icu: { total: 3, occupied: 2, reserved: 0 }, oxygen: { total: 5, occupied: 3, reserved: 0 }, ventilator: { total: 1, occupied: 1, reserved: 0 } }
  }
];

async function seedDatabase(customUri = null) {
  try {
    console.log('🌱 Connecting to database for seeding...');
    await connectDB(customUri);

    console.log('⚠️  Resetting collections (clearing old demo data)...');
    await User.deleteMany({});
    await Hospital.deleteMany({});
    await Bed.deleteMany({});
    await BedRequest.deleteMany({});

    console.log('👥 Creating demo user accounts...');
    // 1. Citizen User
    const citizenUser = await User.create({
      name: "Demo Citizen User",
      email: "user@demo.wb.gov.in",
      passwordHash: "Password123!",
      phone: "+91 98300 12345",
      role: "user",
      isActive: true,
    });

    // 2. Super Admin
    const superAdmin = await User.create({
      name: "State Healthcare Super Admin",
      email: "superadmin@demo.wb.gov.in",
      passwordHash: "SuperAdmin123!",
      phone: "+91 98300 99999",
      role: "super_admin",
      isActive: true,
    });

    // 3. Hospital Admin (linked to Apollo)
    const apolloAdmin = await User.create({
      name: "Apollo Hospital Admin",
      email: "admin@apollo.wb.gov.in",
      passwordHash: "Password123!",
      phone: "+91 98300 55555",
      role: "hospital_admin",
      isActive: true,
    });

    console.log('🏥 Seeding 24 West Bengal demo hospitals and bed inventories...');
    let apolloHospitalId = null;

    for (const hData of DEMO_HOSPITALS) {
      const hospital = await Hospital.create({
        name: hData.name,
        district: hData.district,
        area: hData.area,
        address: hData.address,
        latitude: hData.latitude,
        longitude: hData.longitude,
        location: {
          type: 'Point',
          coordinates: [hData.longitude, hData.latitude],
        },
        phone: hData.phone,
        email: hData.email,
        hospitalType: hData.hospitalType,
        isVerified: hData.isVerified,
        facilities: hData.facilities,
        admin: hData.name.includes('Apollo') ? apolloAdmin._id : null,
      });

      if (hData.name.includes('Apollo')) {
        apolloHospitalId = hospital._id;
        // Assign hospital to Apollo Admin user
        apolloAdmin.hospital = hospital._id;
        await apolloAdmin.save();
      }

      // Seed 4 bed categories for this hospital
      const categories = ['general', 'icu', 'oxygen', 'ventilator'];
      for (const cat of categories) {
        const catConfig = hData.beds[cat] || { total: 10, occupied: 5, reserved: 0 };
        await Bed.create({
          hospital: hospital._id,
          type: cat,
          totalBeds: catConfig.total,
          occupiedBeds: catConfig.occupied,
          reservedBeds: catConfig.reserved || 0,
        });
      }
    }

    console.log('📋 Creating demo initial bed request...');
    const apolloGeneralBed = await Bed.findOne({ hospital: apolloHospitalId, type: 'general' });
    if (apolloGeneralBed) {
      await BedRequest.create({
        user: citizenUser._id,
        hospital: apolloHospitalId,
        bed: apolloGeneralBed._id,
        bedType: 'general',
        patientName: 'Subhas Chandra Bose (Demo Record)',
        contactPhone: '+91 98300 12345',
        notes: 'Demo bed reservation request for observation.',
        status: 'pending',
      });
    }

    console.log('\n======================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('DEMO ACCOUNTS (DEMO ONLY — DO NOT USE IN PRODUCTION):');
    console.log('1. Citizen User:');
    console.log('   Email:    user@demo.wb.gov.in');
    console.log('   Password: Password123!');
    console.log('   Role:     user');
    console.log('\n2. Hospital Administrator:');
    console.log('   Email:    admin@apollo.wb.gov.in');
    console.log('   Password: Password123!');
    console.log('   Role:     hospital_admin (Assigned to: Apollo Multispeciality Hospitals)');
    console.log('\n3. Super Administrator:');
    console.log('   Email:    superadmin@demo.wb.gov.in');
    console.log('   Password: SuperAdmin123!');
    console.log('   Role:     super_admin');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Seeding error:', err);
    throw err;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = { seedDatabase, DEMO_HOSPITALS };
