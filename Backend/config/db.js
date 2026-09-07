require('./bootstrap');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

/**
 * Redacts username:password from MongoDB connection string for safe logging
 */
function sanitizeMongoUri(uri) {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/(.*?)@/, '//***:***@');
}

/**
 * Connect to MongoDB Atlas / Local MongoDB
 */
const connectDB = async (customUri = null) => {
  const uri = customUri || process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    throw new Error('MONGODB_URI is missing');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
    console.log(`📡 Database target: ${sanitizeMongoUri(uri)}`);

    // Setup connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting reconnection...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully.');
    });

    return conn;
  } catch (error) {
    console.error(`❌ Failed to connect to MongoDB (${sanitizeMongoUri(uri)}): ${error.message}`);
    throw error;
  }
};

/**
 * Gracefully disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed gracefully.');
  } catch (err) {
    console.error(`❌ Error closing MongoDB connection: ${err.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  sanitizeMongoUri,
};
