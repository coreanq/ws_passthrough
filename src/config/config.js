/**
 * Configuration module for the WebSocket Passthrough Server
 * Manages server settings and target connection configurations
 */

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Default configuration
const defaultConfig = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  target: {
    // Default target configuration (will be updated via API)
    ip: process.env.TARGET_IP || '127.0.0.1',
    port: process.env.TARGET_PORT || 8080
  },
  connection: {
    reconnectAttempts: 5,
    reconnectInterval: 2000, // ms
    bufferSize: 1024 * 1024 // 1MB
  },
  security: {
    enableTLS: process.env.ENABLE_TLS === 'true' || false,
    requireAuth: process.env.REQUIRE_AUTH === 'true' || false
  }
};

// Current runtime configuration (mutable)
let currentConfig = JSON.parse(JSON.stringify(defaultConfig));

/**
 * Get the current configuration
 * @returns {Object} Current configuration object
 */
const getConfig = () => {
  return JSON.parse(JSON.stringify(currentConfig));
};

/**
 * Update target configuration
 * @param {Object} targetConfig - New target configuration
 * @param {string} targetConfig.ip - Target IP address
 * @param {number} targetConfig.port - Target port number
 * @returns {Object} Updated configuration
 */
const updateTargetConfig = (targetConfig) => {
  if (targetConfig.ip) {
    currentConfig.target.ip = targetConfig.ip;
  }
  
  if (targetConfig.port) {
    currentConfig.target.port = parseInt(targetConfig.port, 10);
  }
  
  return getConfig();
};

/**
 * Reset configuration to defaults
 * @returns {Object} Default configuration
 */
const resetConfig = () => {
  currentConfig = JSON.parse(JSON.stringify(defaultConfig));
  return getConfig();
};

module.exports = {
  getConfig,
  updateTargetConfig,
  resetConfig
};
