# 🏥 Medical Bed Tracker — Backend Documentation

A robust, secure, scalable, and production-ready REST API and real-time backend for the **Medical Bed Tracker (West Bengal Emergency Network)**.

---

## 📋 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Directory Structure](#-directory-structure)
- [Environment Configuration](#-environment-configuration)
- [Demo Accounts & Credentials](#-demo-accounts--credentials)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Real-Time WebSocket Events](#-real-time-websocket-events)
- [Concurrency & Atomic Guards](#-concurrency--atomic-guards)
- [Setup & Running Instructions](#-setup--running-instructions)
- [Verification & Automated Testing](#-verification--automated-testing)
- [Frontend Integration](#-frontend-integration)

---

## 🏗️ Architecture Overview

The backend is built with:
- **Node.js & Express.js** (`4.21.x`): Modular router architecture with MVC service layer.
- **MongoDB Atlas & Mongoose** (`8.9.x`): Document database with 2dsphere geo-indexing, compound indexes, and strict validation schemas.
- **Socket.IO** (`4.8.x`): Real-time bi-directional bed availability push notifications.
- **JSON Web Tokens (JWT)** & **Bcrypt.js**: Secure token-based authentication with salted password hashing (work factor: 10).
- **Security Middleware**: Helmet for HTTP security headers, CORS origin whitelisting, Express Rate Limiters for brute-force prevention, and express-validator for strict schema verification.

---

## 📁 Directory Structure

```
backend/
├── config/
│   ├── bootstrap.js       # Node module resolver for cross-drive / caching
│   └── db.js              # MongoDB Atlas Mongoose connection with IPv4 fallback
├── controllers/
│   ├── authController.js        # Citizen, staff & admin registration / login
│   ├── hospitalController.js    # Hospital search, filter, stats, district aggregates
│   ├── bedController.js         # Bed inventory CRUD & availability updates
│   └── bedRequestController.js  # Bed booking requests & lifecycle actions
├── middleware/
│   ├── authMiddleware.js        # JWT Bearer token authentication
│   ├── roleMiddleware.js        # RBAC (user, hospital_admin, super_admin)
│   ├── validationMiddleware.js  # express-validator result formatter
│   └── errorMiddleware.js       # Centralized 404 & error handlers
├── models/
│   ├── User.js            # User accounts with roles & hospital affiliation
│   ├── Hospital.js        # Hospital metadata, 2dsphere location, phone, district
│   ├── Bed.js             # Bed categories (general, icu, oxygen, ventilator)
│   └── BedRequest.js      # Patient reservation lifecycle tracking
├── routes/
│   ├── authRoutes.js
│   ├── hospitalRoutes.js
│   ├── bedRoutes.js
│   └── bedRequestRoutes.js
├── scripts/
│   └── seedDatabase.js    # 24 WB hospitals, 96 beds & demo users seeder
├── services/
│   ├── authService.js
│   ├── hospitalService.js
│   ├── bedService.js
│   └── bedRequestService.js
├── tests/
│   └── runTests.js        # 30-scenario comprehensive automated verification suite
├── utils/
│   └── logger.js          # Timestamped logging utility with credential sanitization
├── validators/
│   ├── authValidator.js
│   ├── hospitalValidator.js
│   ├── bedValidator.js
│   └── bedRequestValidator.js
├── .env                   # Environment variables (MongoDB Atlas URI, JWT, Port)
├── .env.example           # Example environment template
├── package.json
└── server.js              # Main Express & Socket.IO entry point
```

---

## ⚙️ Environment Configuration

Create or verify `backend/.env` containing:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xztvwaj.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=super_secret_jwt_key_west_bengal_emergency_2026
JWT_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX_REQUESTS=300
AUTH_RATE_LIMIT_MAX_REQUESTS=30
CLIENT_URL=http://localhost:5500
```

---

## 👥 Demo Accounts & Credentials

The database seeder automatically initializes three demo user accounts:

| Role | Email | Password | Affiliation / Notes |
| :--- | :--- | :--- | :--- |
| **Citizen / Patient** | `user@demo.wb.gov.in` | `Password123!` | Standard citizen; can submit bed requests |
| **Hospital Staff / Admin** | `admin@apollo.wb.gov.in` | `Password123!` | Manages Apollo Multispeciality Hospitals (Beds & Requests) |
| **Super Admin** | `superadmin@demo.wb.gov.in` | `SuperAdmin123!` | Full state-wide administrative authority |

---

## 📡 API Endpoints Reference

### Health & Diagnostic
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | System uptime, environment & DB connection status | Public |

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user | Public |
| `POST` | `/api/auth/login` | Log in and receive JWT token | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Bearer Token |

### Hospitals (`/api/hospitals`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/hospitals` | List hospitals (query: `district`, `bedType`, `search`, `page`, `limit`) | Public |
| `GET` | `/api/hospitals/statistics` | State-wide aggregate bed counters & totals | Public |
| `GET` | `/api/hospitals/districts` | List all 23 districts with hospital counts | Public |
| `GET` | `/api/hospitals/:id` | Get hospital profile by ID with bed inventory | Public |
| `POST` | `/api/hospitals` | Create hospital | Super Admin |
| `PUT` | `/api/hospitals/:id` | Update hospital details | Hospital Admin / Super Admin |
| `DELETE` | `/api/hospitals/:id` | Delete hospital | Super Admin |
| `GET` | `/api/hospitals/:id/beds` | Retrieve hospital's bed inventory | Public |

### Beds (`/api/beds`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/beds/:id` | Get specific bed details | Public |
| `PATCH` | `/api/beds/:id/availability` | Update `occupiedBeds` and/or `reservedBeds` | Hospital Admin / Super Admin |
| `PUT` | `/api/beds/:id` | Update bed category config | Hospital Admin / Super Admin |
| `POST` | `/api/beds` | Add a new bed category to a hospital | Hospital Admin / Super Admin |

### Bed Requests (`/api/bed-requests`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/bed-requests` | Citizen submits bed reservation (atomic reservation guard) | Bearer Token |
| `GET` | `/api/bed-requests/my` | Citizen retrieves their submitted requests | Bearer Token |
| `GET` | `/api/bed-requests/hospital/:hospitalId` | Hospital staff views bed requests for their hospital | Staff / Super Admin |
| `PATCH` | `/api/bed-requests/:id/approve` | Staff approves request (`reserved` $\to$ `occupied`) | Staff / Super Admin |
| `PATCH` | `/api/bed-requests/:id/reject` | Staff rejects request (`reserved` released) | Staff / Super Admin |
| `PATCH` | `/api/bed-requests/:id/cancel` | Citizen cancels pending request | Citizen / Staff |

---

## ⚡ Real-Time WebSocket Events

The server broadcasts live events via Socket.IO:

- **`bedAvailabilityUpdated`**: Emitted whenever bed inventory changes (via reservation, staff counter update, or request approval/rejection).
  ```json
  {
    "hospitalId": "6a9e9a4074b2ff9e0afbf9fa",
    "bedId": "6a9e9a4174b2ff9e0afbf9fb",
    "bedType": "icu",
    "availableBeds": 3,
    "totalBeds": 20,
    "occupiedBeds": 15,
    "reservedBeds": 2,
    "updatedAt": "2026-09-07T11:08:16.000Z"
  }
  ```

---

## 🔒 Concurrency & Atomic Guards

To prevent race conditions and overbooking:
1. **Atomic Availability Check**:
   ```javascript
   const bed = await Bed.findOneAndUpdate(
     { _id: bedId, availableBeds: { $gt: 0 } },
     { $inc: { reservedBeds: 1 } },
     { returnDocument: 'after' }
   );
   ```
2. **Double-Booking Prevention**: If two patients request the final ICU bed concurrently, MongoDB's atomic document locking ensures only one update matches `{ availableBeds: { $gt: 0 } }`. The second request immediately fails with `400 Bad Request: "No beds available for this category"`.

---

## 🚀 Setup & Running Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Seed Database with West Bengal Hospitals
```bash
npm run seed:reset
```

### 3. Start Backend Server
```bash
# Production / standard mode
npm start

# Development mode with auto-reload
npm run dev
```
The server will start on `http://localhost:5000` and connect to MongoDB Atlas.

---

## 🧪 Verification & Automated Testing

Run the automated test suite covering 30 end-to-end scenarios:
```bash
npm test
```

### Coverage Overview:
- Server Startup & Health Response Contract
- Helmet Security Headers & CORS Preflight
- 404 & Malformed JSON Handling
- Express-Validator Input Validation (email, password length, pagination bounds)
- JWT Authentication & Unauthorized Route Protection (401)
- Role-Based Access Control & Affiliation Checks (403)
- Hospital Search, Filters, Statistics & District Aggregates
- Bed Inventory Management & Real-Time Broadcasts
- Atomic Bed Reservations & Concurrency Rejection
- Hospital Staff Workflow (Approve / Reject)

---

## 🌐 Frontend Integration

The existing frontend files in the root folder are connected without breaking the design:
- `index.html`: Contains modal templates for citizen reservation requests (`#requestBedModalOverlay`) and staff portal authentication/management (`#staffPortalModalOverlay`).
- `style.css`: Preserves original design system while adding styling for staff login forms, counter controls, and status pills.
- `script.js`:
  - Dynamically fetches hospital data from `GET /api/hospitals` and `GET /api/hospitals/statistics`.
  - Connects to Socket.IO (`http://localhost:5000`) and listens for `bedAvailabilityUpdated` to update UI and Leaflet map markers in real-time.
  - Includes offline resilience fallback if the backend is momentarily unreachable.
