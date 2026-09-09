# 🚀 Backend Deployment & GitHub Pages Connection Guide

This guide explains how to deploy the backend so your GitHub Pages frontend can communicate with it without encountering `"Failed to fetch"` errors.

---

## 🔍 Why Does "Failed to fetch" Happen on GitHub Pages?

1. **GitHub Pages only hosts static files (HTML, CSS, JS)**. It does not run Node.js, Express, or backend servers.
2. GitHub Pages is served over **HTTPS** (`https://harishankarpaul20.github.io/Emergency-Bed-Tracker/`).
3. If the frontend attempts to communicate with `http://localhost:5000/api`, the browser blocks it as **Insecure Mixed Content** and fails because `localhost` does not exist on your visitors' devices.
4. **Solution**: The backend must run on an HTTPS cloud service (like Render, Railway, or Fly.io) with CORS enabled for your GitHub Pages domain.

---

## ⚡ Option 1: Deploy Backend to Render (Recommended — Free Tier)

[Render](https://render.com) provides free Web Service hosting for Node.js applications with automatic HTTPS.

### Step 1: Push Project to GitHub
Ensure all latest changes are pushed to your repository:
```bash
git add .
git commit -m "Configure CORS and environment-aware API URL"
git push origin main
```

### Step 2: Create Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) and log in with GitHub.
2. Click **New +** $\to$ **Web Service**.
3. Select your repository: `harishankarpaul20/Emergency-Bed-Tracker`.
4. Fill in the settings:
   - **Name**: `emergency-bed-tracker`
   - **Region**: Singapore (or nearest to India)
   - **Root Directory**: `Backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

### Step 3: Add Environment Variables
Under the **Environment Variables** section on Render, add:
| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Production mode |
| `MONGODB_URI` | *Your MongoDB Atlas connection string from `Backend/.env`* | Redacted for security |
| `JWT_SECRET` | *Your JWT secret from `Backend/.env`* | Required for auth |
| `CLIENT_URL` | `https://harishankarpaul20.github.io` | GitHub Pages origin |
| `ALLOWED_ORIGINS` | `https://harishankarpaul20.github.io` | Comma-separated |

### Step 4: Deploy & Copy Your Render URL
1. Click **Deploy Web Service**.
2. Wait 1–2 minutes for the build to complete.
3. Once deployed, Render will display your live URL: `https://emergency-bed-tracker.onrender.com`.

### Step 5: Verify `config.js` Matches Your Render URL
In [`config.js`](./config.js), `PRODUCTION_BACKEND_URL` is configured as:
```javascript
const PRODUCTION_BACKEND_URL = 'https://emergency-bed-tracker.onrender.com';
```
Commit and push to GitHub:
```bash
git add config.js
git commit -m "Update production API URL"
git push origin main
```
Your GitHub Pages site will now instantly connect to your deployed backend!

---

## 🧪 Option 2: Test GitHub Pages Live Using Cloudflare Tunnel / Localtunnel (Instant Testing)

If you want to test GitHub Pages against your local server **right now without waiting for cloud deployment**, you can create a temporary secure HTTPS tunnel to your local backend:

1. Start your local backend on port 5000:
   ```bash
   cd Backend
   node server.js
   ```
2. In another terminal, create an HTTPS tunnel using `localtunnel` or `ngrok` or `cloudflared`:
   ```bash
   npx localtunnel --port 5000
   ```
   This gives you an HTTPS URL like: `https://rapid-fox-42.loca.lt`
3. Open your GitHub Pages website (`https://harishankarpaul20.github.io/Emergency-Bed-Tracker/`).
4. Open the browser developer console (F12) and run:
   ```javascript
   setBackendUrl('https://rapid-fox-42.loca.lt');
   ```
   The site will reload and route all reservation requests to your backend via the secure HTTPS tunnel!

---

## 🏥 Verification of Bed Reservation Flow

Once connected, submitting an emergency bed reservation performs the following atomic operations:
1. Citizen authentication $\to$ `POST /api/auth/login` (or auto-registration).
2. Atomic reservation submission $\to$ `POST /api/bed-requests`.
3. Inventory decrement $\to$ MongoDB Atlas updates `availableBeds: -1` and `reservedBeds: +1`.
4. Reservation persistence $\to$ A `BedRequest` record is created with status `'pending'`.
5. Frontend confirmation $\to$ Green success toast appears and modal closes.
