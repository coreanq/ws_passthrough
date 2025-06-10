// src/index.js
import { WebSocket, WebSocketServer } from 'ws';
import TargetConnectionService from './services/targetConnectionService.js';
import EventEmitter from 'events';
import ConnectionManager from './services/ConnectionManager.js';
import PerformanceMonitor from './services/PerformanceMonitor.js';
import logger from './utils/logger.js';

const wss = new WebSocketServer({ port: 8080 });

const serverEvents = new EventEmitter();
const connectionManager = new ConnectionManager(serverEvents);
const performanceMonitor = new PerformanceMonitor();

function setupTargetSocketListeners(ws, socket) {
  socket.on('data', data => {
    logger.debug(`Target 수신: ${data}`);
    if (ws.readyState === WebSocket.OPEN) {
      const canWrite = ws.send(data); // WebSocket으로 데이터 전송
      if (!canWrite) {
        // WebSocket 백프레셔 처리 (선택 사항: WebSocket은 TCP보다 백프레셔 처리가 덜 필요할 수 있음)
        // 여기서는 간단히 로그만 남김
        logger.warn('WebSocket backpressure detected on send.');
      }
      performanceMonitor.recordMessage(data.length, 0);
    }
  });

  socket.on('end', () => {
    logger.info('Target 연결이 끊어졌습니다.');
    if (ws.readyState === WebSocket.OPEN) {
      const eventMessage = { path: '/event', type: 'target_disconnect', message: 'Target connection closed.' };
      ws.send(JSON.stringify(eventMessage));
      serverEvents.emit('serverEvent', { connectionId: ws.connectionId, ...eventMessage });
      connectionManager.cleanupConnection(ws.connectionId);
    }
  });

  socket.on('error', error => {
    logger.error('Target 소켓 오류 발생:', error);
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
    logger.warn(`WebSocket 수신: ${message}`);

    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
      // If parsing successful, it's a JSON message
      logger.warn(`1 parsedMessage: ${JSON.stringify(parsedMessage)}`);

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
        if (targetSocket && !targetSocket.destroyed) {
          // Assuming parsedMessage.data is a Uint8Array or similar that needs to be converted to a Buffer
          const dataBuffer = Buffer.from(parsedMessage.data);
          const canWrite = targetSocket.write(dataBuffer);
          if (!canWrite) {
            ws.pause(); // WebSocket 수신을 일시 중지
            targetSocket.once('drain', () => {
              ws.resume(); // TCP 소켓이 drain되면 WebSocket 수신 재개
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
      // If not JSON, treat as raw data (assumed to be Uint8Array or similar)
      logger.debug(`WebSocket 수신 (Raw Data - not JSON): ${message.toString()}`);
      if (targetSocket && !targetSocket.destroyed) {
        // Assuming 'message' is a Uint8Array or can be directly used to create a Buffer
        const dataToWrite = Buffer.from(message); 
        const canWrite = targetSocket.write(dataToWrite);
        if (!canWrite) {
          ws.pause(); // WebSocket 수신을 일시 중지
          targetSocket.once('drain', () => {
            ws.resume(); // TCP 소켓이 drain되면 WebSocket 수신 재개
          });
        }
        performanceMonitor.recordMessage(dataToWrite.length, 0);
      } else {
        ws.send(JSON.stringify({ status: 'error', message: 'Target connection not established for raw data.' }));
      }
    }
  });

  targetConnectionService = new TargetConnectionService(initialTargetIp, initialTargetPort, { reconnectInterval: 3000, maxRetries: 10 });
  targetConnectionService.connect()
    .then(socket => {
      targetSocket = socket;
      connectionManager.registerTargetConnection(connectionId, targetSocket, initialTargetIp, initialTargetPort);
      connectionManager.createConnectionPair(connectionId, connectionId);
      setupTargetSocketListeners(ws, targetSocket);
      serverEvents.emit('serverEvent', { connectionId: ws.connectionId, path: '/event', type: 'initial_target_connect', message: `Initial connection to ${initialTargetIp}:${initialTargetPort}` });
    })
    .catch(error => {
      logger.error('초기 Target 연결 실패:', error);
      if (ws.readyState === WebSocket.OPEN) {
        const eventMessage = { path: '/event', type: 'initial_target_connect_failed', message: `Initial Target connection failed: ${error.message}` };
        ws.send(JSON.stringify(eventMessage));
        serverEvents.emit('serverEvent', { connectionId: ws.connectionId, ...eventMessage });
        connectionManager.handleConnectionError(ws.connectionId, error, 'initial_target_connect_failed');
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
