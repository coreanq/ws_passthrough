/**
 * Target Connection Service
 * Manages connections to target IP addresses
 */

const net = require('net');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const configService = require('./configService');
const eventEmitter = require('../utils/eventEmitter');

/**
 * Target Connection class
 * Handles connection to a target IP and port
 */
class TargetConnection extends EventEmitter {
  /**
   * Create a new target connection
   * @param {string} clientId - Unique client identifier
   */
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.socket = null;
    this.buffer = [];
    this.connected = false;
    this.reconnectAttempts = 0;
    this.config = configService.getConfig();
    
    // Subscribe to configuration changes
    this.configChangeHandler = this.handleConfigChange.bind(this);
    configService.subscribe('targetConfigChanged', this.configChangeHandler);
    
    // Connect to target
    this.connect();
  }
  
  /**
   * Connect to target server
   */
  connect() {
    const { ip, port } = this.config.target;
    
    logger.info('Connecting to target', { clientId: this.clientId, ip, port });
    
    // Create socket connection
    this.socket = new net.Socket();
    
    // 타임아웃 설정 (5초)
    this.socket.setTimeout(5000);
    
    // Set up event handlers
    this.socket.on('connect', () => {
      logger.info('Connected to target', { clientId: this.clientId, ip, port });
      this.connected = true;
      this.reconnectAttempts = 0;
      
      // Emit connection established event
      eventEmitter.emit('connection:established', {
        clientId: this.clientId,
        target: { ip, port }
      });
      
      // Send any buffered data
      this.flushBuffer();
      
      // Emit connected event
      this.emit('connected');
    });
    
    // 타임아웃 이벤트 처리
    this.socket.on('timeout', () => {
      logger.warn('Target connection timeout', { clientId: this.clientId, ip, port });
      
      // 타임아웃 발생 시 연결 종료
      this.socket.end();
      
      // 에러 이벤트 발생
      this.emit('error', new Error('Connection timeout'));
    });
    
    this.socket.on('data', (data) => {
      // Forward data to client
      this.emit('data', data);
    });
    
    this.socket.on('close', () => {
      logger.info('Target connection closed', { clientId: this.clientId });
      this.connected = false;
      
      // Attempt to reconnect
      this.attemptReconnect();
      
      // Emit close event
      this.emit('close');
    });
    
    this.socket.on('error', (error) => {
      logger.error('Target connection error', { 
        clientId: this.clientId, 
        error: error.message 
      });
      
      // Emit error event
      this.emit('error', error);
    });
    
    // Connect to target
    this.socket.connect(port, ip);
  }
  
  /**
   * Attempt to reconnect to target
   */
  attemptReconnect() {
    const maxAttempts = this.config.connection.reconnectAttempts;
    const interval = this.config.connection.reconnectInterval;
    
    if (this.reconnectAttempts < maxAttempts) {
      this.reconnectAttempts++;
      
      logger.info('Attempting to reconnect', { 
        clientId: this.clientId, 
        attempt: this.reconnectAttempts, 
        maxAttempts 
      });
      
      // Notify about reconnection attempt
      eventEmitter.emit('connection:reconnecting', {
        clientId: this.clientId,
        attempt: this.reconnectAttempts,
        maxAttempts
      });
      
      // Attempt to reconnect after interval
      setTimeout(() => {
        if (!this.connected) {
          this.connect();
        }
      }, interval);
    } else {
      logger.warn('Max reconnect attempts reached', { clientId: this.clientId });
      
      // Notify about reconnection failure
      eventEmitter.emit('connection:reconnect_failed', {
        clientId: this.clientId
      });
    }
  }
  
  /**
   * Send data to target
   * @param {Buffer|string} data 
   */
  send(data) {
    if (!this.connected) {
      // Buffer data if not connected
      this.buffer.push(data);
      logger.debug('Data buffered for target', { clientId: this.clientId, size: data.length });
      return;
    }
    
    try {
      // 데이터 형식 확인 및 변환
      let dataToSend;
      
      if (Buffer.isBuffer(data)) {
        // 버퍼를 문자열로 변환
        dataToSend = data.toString('utf8');
        logger.debug('Buffer converted to string', { 
          clientId: this.clientId, 
          originalSize: data.length,
          convertedSize: dataToSend.length
        });
      } else if (typeof data === 'string') {
        // 문자열은 그대로 사용
        dataToSend = data;
        logger.debug('String data received', { 
          clientId: this.clientId, 
          size: data.length
        });
      } else {
        // 기타 형식은 문자열로 변환
        dataToSend = String(data);
        logger.debug('Unknown data type converted to string', { 
          clientId: this.clientId, 
          originalType: typeof data
        });
      }
      
      // 데이터 전송
      this.socket.write(dataToSend);
      logger.debug('Data sent to target', { 
        clientId: this.clientId, 
        size: dataToSend.length,
        type: 'string'
      });
    } catch (error) {
      logger.error('Error sending data to target', { 
        clientId: this.clientId, 
        error: error.message,
        errorStack: error.stack
      });
      this.emit('error', error);
    }
  }
  
  /**
   * Flush buffered data to target
   */
  flushBuffer() {
    if (this.connected && this.buffer.length > 0) {
      logger.debug('Flushing buffer', { 
        clientId: this.clientId, 
        bufferSize: this.buffer.length 
      });
      
      // Send all buffered data
      for (const data of this.buffer) {
        this.socket.write(data);
      }
      
      // Clear buffer
      this.buffer = [];
    }
  }
  
  /**
   * Handle configuration changes
   * @param {Object} targetConfig - New target configuration
   */
  handleConfigChange(targetConfig) {
    logger.info('Target configuration changed', { 
      clientId: this.clientId, 
      newConfig: targetConfig 
    });
    
    // Update configuration
    this.config = configService.getConfig();
    
    // Reconnect with new configuration
    this.close();
    this.connect();
  }
  
  /**
   * Close the connection
   */
  close() {
    // Unsubscribe from configuration changes
    configService.unsubscribe('targetConfigChanged', this.configChangeHandler);
    
    // Close socket if connected
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    
    this.connected = false;
  }
}

/**
 * Create a new target connection
 * @param {string} clientId - Unique client identifier
 * @returns {TargetConnection} New target connection
 */
const createConnection = (clientId) => {
  return new TargetConnection(clientId);
};

module.exports = {
  createConnection
};
