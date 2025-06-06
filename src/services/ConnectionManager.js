// src/services/ConnectionManager.js
const WebSocket = require('ws');
const EventEmitter = require('events');
const logger = require('../utils/logger'); // logger 추가

class ConnectionManager {
  constructor(serverEvents) {
    this.wsConnections = new Map();
    this.targetConnections = new Map();
    this.connectionPairs = new Map(); // WebSocket ID -> Target ID
    this.serverEvents = serverEvents; // EventEmitter 인스턴스 주입
  }
  
  registerWebSocketConnection(id, ws, path) {
    this.wsConnections.set(id, { ws, path, createdAt: Date.now() });
    logger.info(`WebSocket connection registered: ${id}`); // console.log 대신 logger.info
    return id;
  }
  
  registerTargetConnection(id, socket, targetIp, targetPort) {
    this.targetConnections.set(id, { socket, targetIp, targetPort, createdAt: Date.now() });
    logger.info(`Target connection registered: ${id}`); // console.log 대신 logger.info
    return id;
  }
  
  createConnectionPair(wsId, targetId) {
    this.connectionPairs.set(wsId, targetId);
    logger.info(`Connection pair created: ${wsId} -> ${targetId}`); // console.log 대신 logger.info
    return { wsId, targetId };
  }
  
  handleConnectionError(id, error, type = 'connection_error') {
    logger.error(`Connection error for ${id}:`, error); // console.error 대신 logger.error
    
    this.serverEvents.emit('serverEvent', {
      type: type,
      connectionId: id,
      message: error.message,
      timestamp: Date.now()
    });
    
    this.cleanupConnection(id);
  }
  
  cleanupConnection(id) {
    // WebSocket 연결 정리
    if (this.wsConnections.has(id)) {
      const wsConn = this.wsConnections.get(id);
      if (wsConn.ws.readyState === WebSocket.OPEN) {
        wsConn.ws.close();
      }
      this.wsConnections.delete(id);
      logger.info(`WebSocket connection ${id} cleaned up.`); // console.log 대신 logger.info
    }
    
    // Target 연결 정리
    if (this.targetConnections.has(id)) {
      const targetConn = this.targetConnections.get(id);
      targetConn.socket.destroy();
      this.targetConnections.delete(id);
      logger.info(`Target connection ${id} cleaned up.`); // console.log 대신 logger.info
    }
    
    // 연결 쌍 정리 (양방향 처리)
    // wsId -> targetId 매핑 제거
    if (this.connectionPairs.has(id)) {
      const targetId = this.connectionPairs.get(id);
      this.connectionPairs.delete(id);
      // targetId -> wsId 매핑도 있다면 제거 (옵션)
      for (let [key, value] of this.connectionPairs.entries()) {
        if (value === id) {
          this.connectionPairs.delete(key);
          break;
        }
      }
    } else {
      // targetId -> wsId 매핑 제거 (id가 targetId인 경우)
      for (let [key, value] of this.connectionPairs.entries()) {
        if (key === id || value === id) { // id가 wsId 또는 targetId인 경우 모두 처리
          this.connectionPairs.delete(key);
          break;
        }
      }
    }
  }
  
  getConnectionStats() {
    return {
      activeWebSocketConnections: this.wsConnections.size,
      activeTargetConnections: this.targetConnections.size,
      activeConnectionPairs: this.connectionPairs.size
    };
  }
}

module.exports = ConnectionManager;
