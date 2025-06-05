/**
 * Event Controller
 * Handles WebSocket connections for event notifications
 */

const logger = require('../utils/logger');
const eventEmitter = require('../utils/eventEmitter');
const configService = require('../services/configService');

/**
 * Handle WebSocket connection for event notifications
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} req - HTTP request
 */
const handleConnection = (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const clientId = `${clientIp}:${req.socket.remotePort}`;
  
  logger.info('New event subscriber connected', { clientId });
  
  // Function to send event to client
  const sendEvent = (event) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  };
  
  // Subscribe to events
  const eventTypes = [
    'connection:established',
    'connection:error',
    'connection:closed',
    'data:received',
    'config:updated'
  ];
  
  // Create event listeners
  const eventListeners = {};
  
  eventTypes.forEach(eventType => {
    eventListeners[eventType] = (data) => {
      sendEvent({
        type: eventType,
        timestamp: new Date().toISOString(),
        data
      });
    };
    
    // Subscribe to event
    eventEmitter.on(eventType, eventListeners[eventType]);
  });
  
  // Subscribe to configuration changes
  const configChangeListener = (targetConfig) => {
    sendEvent({
      type: 'config:updated',
      timestamp: new Date().toISOString(),
      data: { targetConfig }
    });
  };
  
  configService.subscribe('targetConfigChanged', configChangeListener);
  
  // Handle WebSocket close
  ws.on('close', () => {
    logger.info('Event subscriber disconnected', { clientId });
    
    // Unsubscribe from events
    eventTypes.forEach(eventType => {
      eventEmitter.off(eventType, eventListeners[eventType]);
    });
    
    // Unsubscribe from configuration changes
    configService.unsubscribe('targetConfigChanged', configChangeListener);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    logger.error('Event WebSocket error', { clientId, error: error.message });
  });
  
  // Send initial connection info to client
  ws.send(JSON.stringify({
    type: 'info',
    timestamp: new Date().toISOString(),
    data: {
      message: 'Connected to WebSocket Passthrough Event Service',
      subscribedEvents: eventTypes
    }
  }));
};

module.exports = handleConnection;
