/**
 * Configuration Controller
 * Handles HTTP requests for managing passthrough configuration
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const logger = require('../utils/logger');

/**
 * GET /config
 * Returns current configuration
 */
router.get('/', (req, res) => {
  try {
    const config = configService.getConfig();
    logger.info('Configuration retrieved');
    res.json(config);
  } catch (error) {
    logger.error('Error retrieving configuration', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

/**
 * POST /config
 * Updates target configuration
 */
router.post('/', (req, res) => {
  try {
    const { ip, port } = req.body;
    
    // Validate input
    if (!ip || !port) {
      logger.warn('Invalid configuration update request', { body: req.body });
      return res.status(400).json({ error: 'IP address and port are required' });
    }
    
    // Validate IP format (simple validation)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      logger.warn('Invalid IP address format', { ip });
      return res.status(400).json({ error: 'Invalid IP address format' });
    }
    
    // Validate port range
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      logger.warn('Invalid port number', { port });
      return res.status(400).json({ error: 'Port must be a number between 1 and 65535' });
    }
    
    // Update configuration
    const updatedConfig = configService.updateTargetConfig({ ip, port: portNum });
    
    logger.info('Configuration updated', { target: updatedConfig.target });
    res.json(updatedConfig);
  } catch (error) {
    logger.error('Error updating configuration', { error: error.message });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * DELETE /config
 * Resets configuration to defaults
 */
router.delete('/', (req, res) => {
  try {
    const defaultConfig = configService.resetConfig();
    logger.info('Configuration reset to defaults');
    res.json(defaultConfig);
  } catch (error) {
    logger.error('Error resetting configuration', { error: error.message });
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

module.exports = router;
