// src/index.js
import { WebSocket, WebSocketServer } from 'ws';
import TargetConnectionService from './services/targetConnectionService.js';
import EventEmitter from 'events';
import ConnectionManager from './services/ConnectionManager.js';
import PerformanceMonitor from './services/PerformanceMonitor.js';
import logger from './utils/logger.js';

// Helper function to convert Buffer/Uint8Array to Hex String
const toHexString = (byteArray) => {
  if (!byteArray) return 'null';
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase();
  }).join(' ');
};

const wss = new WebSocketServer({ port: 8080 });

const serverEvents = new EventEmitter();
const connectionManager = new ConnectionManager(serverEvents);
const performanceMonitor = new PerformanceMonitor();

function setupTargetSocketListeners(ws, socket) {
  socket.on('data', data => {
    // TCP socket data is always a Buffer, which is a Uint8Array.
    logger.debug(`recved from TCP: ${toHexString(data)}`);
    if (ws.readyState === WebSocket.OPEN) {
      const canWrite = ws.send(data); // Send Buffer directly to WebSocket
      if (!canWrite) {
        // WebSocket backpressure handling (optional: WebSocket may require less backpressure handling than TCP)
        // For now, simply log
        logger.warn('WebSocket backpressure detected on send.');
      }
      performanceMonitor.recordMessage(data.length, 0);
    }
  });

  socket.on('end', () => {
    logger.info('TCP 연결이 끊어졌습니다.');
    if (ws.readyState === WebSocket.OPEN) {
      const eventMessage = { path: '/event', type: 'target_disconnect', message: 'Target connection closed.' };
      ws.send(JSON.stringify(eventMessage));
      serverEvents.emit('serverEvent', { connectionId: ws.connectionId, ...eventMessage });
      connectionManager.cleanupConnection(ws.connectionId);
    }
  });

  socket.on('error', error => {
    logger.error('TCP 소켓 오류 발생:', error);
    if (ws.readyState === WebSocket.OPEN) {
      const eventMessage = { path: '/event', type: 'target_error', message: `Target connection error: ${error.message}` };
      ws.send(JSON.stringify(eventMessage));
      serverEvents.emit('serverEvent', { connectionId: ws.connectionId, ...eventMessage });
      connectionManager.handleConnectionError(ws.connectionId, error, 'target_error');
    }
  });
}

wss.on('connection', (ws, req) => {
  logger.info('클라이언트가 연결되었습니다.');

  const connectionId = Date.now().toString();
  ws.connectionId = connectionId;

  connectionManager.registerWebSocketConnection(connectionId, ws, req.url);
  performanceMonitor.updateConnectionCount(wss.clients.size);

  let initialTargetIp = '127.0.0.1';
  let initialTargetPort = 3001;

  let targetConnectionService = null;
  let targetSocket = null;

  const clientEventHandler = (event) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  };

  ws.on('message', message => {
    // Check if the message is binary (Buffer) or text (string)
    const logMessage = message.toString();
    logger.warn(`WebSocket 수신: ${message}`);

    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);

      if (parsedMessage.path === '/config') {
        const { targetIp, targetPort } = parsedMessage.data;

        if (!targetIp || !targetPort || typeof targetPort !== 'number' || targetPort <= 0 || targetPort > 65535) {
          ws.send(JSON.stringify({ status: 'error', message: 'Invalid target IP or port.' }));
          return;
        }

        logger.debug(`Received /config message. Processing connection setup. IP: ${targetIp}, Port: ${targetPort}`);

        if (targetConnectionService) {
          targetConnectionService.disconnect();
          targetConnectionService = null; // Explicitly nullify previous service
          targetSocket = null; // Explicitly nullify previous socket
        }

        targetConnectionService = new TargetConnectionService(targetIp, targetPort, { reconnectInterval: 3000, maxRetries: 10 });
        targetConnectionService.connect()
          .then(socket => {
            targetSocket = socket;
            connectionManager.registerTargetConnection(connectionId, targetSocket, targetIp, targetPort);
            connectionManager.createConnectionPair(connectionId, connectionId);
            setupTargetSocketListeners(ws, targetSocket);
            serverEvents.emit('serverEvent', { connectionId: ws.connectionId, path: '/event', type: 'target_connect', message: `Connected to ${targetIp}:${targetPort}` });
            ws.send(JSON.stringify({ status: 'success', message: `Connected to target ${targetIp}:${targetPort}` }));
          })
          .catch(error => {
            logger.error('Target 연결 실패:', error);
            targetSocket = null; // Ensure targetSocket is null on failure
            if (ws.readyState === WebSocket.OPEN) {
              const eventMessage = { path: '/event', type: 'target_connect_failed', message: `Target connection failed: ${error.message}` };
              ws.send(JSON.stringify(eventMessage));
              serverEvents.emit('serverEvent', { connectionId: ws.connectionId, ...eventMessage });
              connectionManager.handleConnectionError(ws.connectionId, error, 'target_connect_failed');
            }
          });

      } else if (parsedMessage.path === '/data') {
        // This path is for JSON messages containing data to be sent to targetSocket
        // Expecting parsedMessage.data to be an array of numbers (Uint8Array converted to array)
        if (targetSocket && !targetSocket.destroyed) {
          const dataBuffer = Buffer.from(parsedMessage.data);
          logger.debug(`Sending data to TCP: ${toHexString(dataBuffer)}`);
          const canWrite = targetSocket.write(dataBuffer);
          if (!canWrite) {
            ws.pause(); // Pause WebSocket reception
            targetSocket.once('drain', () => {
              ws.resume(); // Resume WebSocket reception when TCP socket drains
            });
          }
          performanceMonitor.recordMessage(dataBuffer.length, 0);
        } else {
          ws.send(JSON.stringify({ status: 'error', message: 'Target connection not established for JSON data.' }));
        }
      } else if (parsedMessage.path === '/event') {
        logger.warn(`event on`, parsedMessage.type, parsedMessage.message);
        serverEvents.on('serverEvent', clientEventHandler);
        ws.send(JSON.stringify({ status: 'success', message: 'Subscribed to server events.' }));
      } else {
        logger.warn(`3`);
        ws.send(JSON.stringify({ status: 'error', message: 'Unknown path.' }));
      }
    } catch (e) {
      // If not JSON, treat as raw data (assumed to be Uint8Array or similar received directly as Buffer)
      const logRawData = Buffer.isBuffer(message) ? toHexString(message) : message.toString();
      logger.debug(`WebSocket 수신 (Raw Data - not JSON): ${logRawData}`);
      if (targetSocket && !targetSocket.destroyed) {
        // Assuming 'message' is a Buffer (Uint8Array) when it's raw binary data
        const dataToWrite = Buffer.isBuffer(message) ? message : Buffer.from(message.toString());
        logger.debug(`Sending raw data to target: ${toHexString(dataToWrite)}`);
        const canWrite = targetSocket.write(dataToWrite);
        if (!canWrite) {
          ws.pause(); // Pause WebSocket reception
          targetSocket.once('drain', () => {
            ws.resume(); // Resume WebSocket reception when TCP socket drains
          });
        }
        performanceMonitor.recordMessage(dataToWrite.length, 0);
      } else {
        ws.send(JSON.stringify({ status: 'error', message: 'Target connection not established for raw data.' }));
      }
    }
  });

  ws.on('close', () => {
    logger.info('클라이언트 연결이 끊어졌습니다.');
    connectionManager.cleanupConnection(connectionId);
    serverEvents.removeListener('serverEvent', clientEventHandler);
    performanceMonitor.updateConnectionCount(wss.clients.size);
  });

  ws.on('error', error => {
    logger.error('WebSocket 오류 발생:', error);
    connectionManager.handleConnectionError(connectionId, error, 'websocket_error');
    serverEvents.removeListener('serverEvent', clientEventHandler);
    performanceMonitor.updateConnectionCount(wss.clients.size);
  });
});

logger.info('WebSocket 서버가 8080 포트에서 실행 중입니다.');

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM 신호 수신: 서버 종료 중...');
  shutdown();
});

process.on('SIGINT', () => {
  logger.info('SIGINT 신호 수신: 서버 종료 중...');
  shutdown();
});

function shutdown() {
  logger.info('서버 종료 시작...');
  wss.clients.forEach(ws => {
    logger.info(`WebSocket 클라이언트 ${ws.connectionId} 종료.`);
    connectionManager.cleanupConnection(ws.connectionId);
  });

  wss.close(() => {
    logger.info('WebSocket 서버가 닫혔습니다.');
    performanceMonitor.stop();
    process.exit(0);
  });
}
