/**
 * Configuration Service
 * Manages application configuration and notifies relevant components of changes
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const EventEmitter = require('events');

// Event type constants
const EVENT_TYPES = {
  TARGET_CONFIG_CHANGED: 'targetConfigChanged',
  CONFIG_RESET: 'configReset'
};

// Create event emitter for configuration changes
class ConfigEvents extends EventEmitter {}
const configEvents = new ConfigEvents();

/**
 * Get current configuration
 * @returns {Object} Current configuration
 */
const getConfig = () => {
  return config.getConfig();
};

/**
 * Update target configuration and notify listeners
 * @param {Object} targetConfig - New target configuration
 * @returns {Object} Updated configuration
 */
const updateTargetConfig = (targetConfig) => {
  logger.info('Updating target configuration', { newConfig: targetConfig });
  
  const updatedConfig = config.updateTargetConfig(targetConfig);
  
  // Emit configuration change event
  configEvents.emit(EVENT_TYPES.TARGET_CONFIG_CHANGED, updatedConfig.target);
  
  return updatedConfig;
};

/**
 * Reset configuration to defaults and notify listeners
 * @returns {Object} Default configuration
 */
const resetConfig = () => {
  logger.info('Resetting configuration to defaults');
  
  const defaultConfig = config.resetConfig();
  
  // Emit configuration reset event
  configEvents.emit(EVENT_TYPES.CONFIG_RESET, defaultConfig);
  
  return defaultConfig;
};

/**
 * Subscribe to configuration change events
 * @param {string} event - Event name to subscribe to
 * @param {function} listener - Callback function
 */
const subscribe = (event, listener) => {
  configEvents.on(event, listener);
};

/**
 * Unsubscribe from configuration change events
 * @param {string} event - Event name to unsubscribe from
 * @param {function} listener - Callback function to remove
 */
const unsubscribe = (event, listener) => {
  configEvents.off(event, listener);
};

module.exports = {
  getConfig,
  updateTargetConfig,
  resetConfig,
  subscribe,
  unsubscribe,
  events: EVENT_TYPES
};
