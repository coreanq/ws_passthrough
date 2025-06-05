/**
 * Data Controller
 * Handles WebSocket connections for data passthrough
 */

const logger = require('../utils/logger');
const targetService = require('../services/targetService');
const configService = require('../services/configService');
const eventEmitter = require('../utils/eventEmitter');

/**
 * Handle WebSocket connection for data passthrough
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} req - HTTP request
 */
const handleConnection = (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  const clientId = `${clientIp}:${req.socket.remotePort}`;
  
  logger.info('New WebSocket client connected', { clientId });
  
  // Create target connection
  let targetConnection;
  
  try {
    targetConnection = targetService.createConnection(clientId);
    logger.info('Target connection created successfully', { clientId });
  } catch (error) {
    logger.error('Failed to create target connection', { clientId, error: error.message });
    
    // Notify client about the error
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to create target connection: ${error.message}`
      }));
    }
    
    return; // 타겟 연결 생성 실패 시 여기서 종료
  }
  
  // Handle connection errors
  targetConnection.on('error', (error) => {
    logger.error('Target connection error', { clientId, error: error.message });
    
    // Notify client about the error
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Target connection error: ${error.message}`
      }));
    }
    
    // Emit event for monitoring
    eventEmitter.emit('connection:error', {
      clientId,
      error: error.message
    });
  });
  
  // Handle target data
  targetConnection.on('data', (data) => {
    // Send data to WebSocket client
    if (ws.readyState === ws.OPEN) {
      try {
        // 데이터를 문자열로 변환하여 전송
        const dataString = data.toString('utf8');
        ws.send(dataString);
        
        logger.debug('Data sent to client as string', { 
          clientId, 
          size: dataString.length 
        });
        
        // Emit event for monitoring
        eventEmitter.emit('data:received', {
          clientId,
          size: dataString.length,
          direction: 'target-to-client',
          type: 'string'
        });
      } catch (error) {
        logger.error('Error sending data to client', { 
          clientId, 
          error: error.message 
        });
        
        // 오류 발생 시 JSON 오류 메시지 전송
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Error processing data from target: ${error.message}`
          }));
        } catch (e) {
          logger.error('Failed to send error message to client', { 
            clientId, 
            error: e.message 
          });
        }
      }
    }
  });
  
  // Handle target connection close
  targetConnection.on('close', () => {
    logger.info('Target connection closed', { clientId });
    
    // Notify client about the connection close
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'info',
        message: 'Target connection closed'
      }));
    }
    
    // Emit event for monitoring
    eventEmitter.emit('connection:closed', {
      clientId,
      type: 'target'
    });
  });
  
  // Handle WebSocket messages
  ws.on('message', (message, isBinary) => {
    // 메시지 형식 로깅
    logger.debug('WebSocket message received', { 
      clientId, 
      isBinary, 
      size: message.length 
    });
    
    try {
      // 메시지 처리
      let processedMessage;
      
      if (isBinary) {
        // 바이너리 데이터를 문자열로 변환
        processedMessage = message.toString('utf8');
        logger.debug('Binary message converted to string', { 
          clientId, 
          originalSize: message.length,
          convertedSize: processedMessage.length
        });
      } else if (Buffer.isBuffer(message)) {
        // 버퍼를 문자열로 변환
        processedMessage = message.toString('utf8');
        logger.debug('Buffer converted to string', { 
          clientId, 
          originalSize: message.length,
          convertedSize: processedMessage.length
        });
      } else {
        // 문자열은 그대로 사용
        processedMessage = message;
        logger.debug('String message received', { 
          clientId, 
          size: message.length
        });
      }
      
      // Forward message to target
      targetConnection.send(processedMessage);
      
      // Emit event for monitoring
      eventEmitter.emit('data:received', {
        clientId,
        size: processedMessage.length,
        direction: 'client-to-target',
        type: 'string'
      });
    } catch (error) {
      logger.error('Error forwarding message to target', { 
        clientId, 
        error: error.message,
        stack: error.stack 
      });
      
      // Notify client about the error
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Error forwarding message: ${error.message}`
          }));
        } catch (e) {
          logger.error('Failed to send error message to client', { 
            clientId, 
            error: e.message 
          });
        }
      }
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    logger.info('WebSocket client disconnected', { clientId });
    
    // Close target connection
    targetConnection.close();
    
    // Emit event for monitoring
    eventEmitter.emit('connection:closed', {
      clientId,
      type: 'client'
    });
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    logger.error('WebSocket error', { clientId, error: error.message });
    
    // Close target connection
    targetConnection.close();
    
    // Emit event for monitoring
    eventEmitter.emit('connection:error', {
      clientId,
      error: error.message
    });
  });
  
  // Send initial connection info to client
  ws.send(JSON.stringify({
    type: 'info',
    message: 'Connected to WebSocket Passthrough Server',
    targetConfig: configService.getConfig().target
  }));
};

module.exports = handleConnection;
