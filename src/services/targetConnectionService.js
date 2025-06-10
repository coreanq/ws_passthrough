// src/services/targetConnectionService.js
import net from 'net';
import logger from '../utils/logger.js';

class TargetConnectionService {
  constructor(targetIp, targetPort, options = {}) {
    this.targetIp = targetIp;
    this.targetPort = targetPort;
    this.socket = null;
    this.reconnectInterval = options.reconnectInterval || 5000; // 5초
    this.maxRetries = options.maxRetries || 5; // 최대 5회 재시도
    this.currentRetries = 0;
    this.reconnectTimer = null;
    this.isConnecting = false; // 현재 연결 시도 중인지 여부
  }

  // 실제 연결을 시도하는 내부 메서드
  _attemptConnect() {
    return new Promise((resolve, reject) => {
      if (this.socket && !this.socket.destroyed) {
        this.socket.destroy(); // 이전 소켓이 남아있다면 정리
        this.socket = null;
      }

      const socket = net.createConnection({ host: this.targetIp, port: this.targetPort }, () => {
        logger.info(`Target ${this.targetIp}:${this.targetPort}에 연결되었습니다.`);
        this.socket = socket;
        this.socket.setNoDelay(true); // Nagle 알고리즘 비활성화로 지연 감소
        this.currentRetries = 0; // 성공 시 재시도 횟수 초기화
        this.isConnecting = false;
        resolve(this.socket);
      });

      socket.on('error', (err) => {
        logger.error(`Target 소켓 연결 오류 (${this.targetIp}:${this.targetPort}):`, err.message);
        socket.destroy(); // 오류 발생 시 소켓 정리
        this.isConnecting = false;
        reject(err);
      });

      // 소켓 닫힘 이벤트 처리 (재연결 로직에 영향)
      socket.on('close', () => {
        logger.info(`Target ${this.targetIp}:${this.targetPort} 소켓이 닫혔습니다.`);
        if (this.socket === socket) { // 현재 활성 소켓이 닫힌 경우에만 처리
          this.socket = null;
          // 여기서 자동 재연결 로직을 트리거할 수 있지만,
          // connect() 메서드에서 재시도 로직을 관리하는 것이 더 명확함.
        }
      });
    });
  }

  // 연결 및 재연결 로직을 포함하는 메인 연결 메서드
  connect() {
    clearTimeout(this.reconnectTimer); // 이전 재연결 타이머 제거

    if (this.isConnecting) {
      logger.warn(`Target ${this.targetIp}:${this.targetPort}에 이미 연결 시도 중입니다.`);
      return Promise.reject(new Error('Already attempting to connect.'));
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      const tryConnect = () => {
        this._attemptConnect()
          .then(socket => {
            resolve(socket);
          })
          .catch(err => {
            this.currentRetries++;
            if (this.currentRetries < this.maxRetries) {
              logger.warn(`Target ${this.targetIp}:${this.targetPort} 재연결 시도 중... (${this.currentRetries}/${this.maxRetries})`);
              this.reconnectTimer = setTimeout(tryConnect, this.reconnectInterval);
            } else {
              logger.error(`Target ${this.targetIp}:${this.targetPort} 연결 실패: 최대 재시도 횟수 도달.`);
              this.isConnecting = false; // 재시도 실패 시 상태 초기화
              reject(err); // 최종 실패
            }
          });
      };
      tryConnect();
    });
  }

  getSocket() {
    return this.socket;
  }

  disconnect() {
    clearTimeout(this.reconnectTimer); // 재연결 타이머 중지
    this.isConnecting = false;
    this.currentRetries = 0; // 재시도 횟수 초기화

    if (this.socket && !this.socket.destroyed) {
      this.socket.end();
      this.socket = null;
      logger.info(`Target ${this.targetIp}:${this.targetPort} 연결이 해제되었습니다.`); // console.log 대신 logger.info
    }
  }
}

export default TargetConnectionService;
