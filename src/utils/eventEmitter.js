/**
 * Event Emitter Utility
 * Provides a centralized event bus for application-wide events
 */

const EventEmitter = require('events');
const logger = require('./logger');

// Create a singleton event emitter
class PassthroughEventEmitter extends EventEmitter {
  /**
   * Emit an event with logging
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {boolean} - True if event had listeners
   */
  emit(event, data) {
    logger.debug('Event emitted', { event, data });
    return super.emit(event, data);
  }
}

// Create and export a singleton instance
const eventEmitter = new PassthroughEventEmitter();

module.exports = eventEmitter;
