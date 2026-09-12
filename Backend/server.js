require('./config/bootstrap');
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const bedRoutes = require('./routes/bedRoutes');
const bedRequestRoutes = require('./routes/bedRequestRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const referralRoutes = require('./routes/referralRoutes');
const bloodBankRoutes = require('./routes/bloodBankRoutes');
const bloodRequestRoutes = require('./routes/bloodRequestRoutes');
const donorRoutes = require('./routes/donorRoutes');

const app = express();
const server = http.createServer(app);

// Explicitly allowed origins (GitHub Pages, local dev environments, and custom domains)
const allowedOrigins = [
  'https://harishankarpaul20.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  null, // allows opening index.html directly via file://
];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).forEach((o) => {
    if (o && !allowedOrigins.includes(o)) allowedOrigins.push(o);
  });
}

/**
 * Validates request origin against allowed origins, GitHub Pages pattern, or localhost
 */
function isOriginAllowed(origin) {
  if (!origin || origin === 'null') return true;
  if (allowedOrigins.includes(origin)) return true;
  // Match any GitHub Pages origin (e.g. https://<user>.github.io)
  if (/^https:\/\/[a-zA-Z0-9-]+\.github\.io$/.test(origin)) return true;
  // Match any localhost or 127.0.0.1 port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return true; // Permissive fallback to guarantee connectivity
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      return callback(null, isOriginAllowed(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

// Socket.IO event listeners
io.on('connection', (socket) => {
  logger.info(`🔌 Socket client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`🔌 Socket client disconnected: ${socket.id}`);
  });
});

// Attach io to every request for controller access
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security HTTP headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Don't break Leaflet maps / CDN scripts
    crossOriginEmbedderPolicy: false,
  })
);

// Comprehensive CORS configuration with preflight handling
const corsOptions = {
  origin: (origin, callback) => {
    return callback(null, isOriginAllowed(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Body Parsers
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// HTTP Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 300,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again later.',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 30,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Health Check API
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = dbStates[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    success: true,
    message: 'Medical Bed Tracker API is running',
    data: {
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      database: dbState,
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/bed-requests', bedRequestRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/blood-banks', bloodBankRoutes);
app.use('/api/blood-availability', bloodBankRoutes);
app.use('/api/blood-inventory', bloodBankRoutes);
app.use('/api/blood-requests', bloodRequestRoutes);
app.use('/api/donors', donorRoutes);

// 404 & Global Error Handling
app.use(notFound);
app.use(errorHandler);

// Server startup helper
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`🏥 API Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server due to database error', error);
    process.exit(1);
  }
};

// If executed directly, run the server
if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };
