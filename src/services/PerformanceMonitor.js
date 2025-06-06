// src/services/PerformanceMonitor.js
const logger = require('../utils/logger'); // logger 추가

class PerformanceMonitor {
  constructor(interval = 60000) { // 기본 60초
    this.interval = interval;
    this.metrics = {
      messagesProcessed: 0,
      bytesTransferred: 0,
      totalLatency: 0, // 현재는 사용되지 않음
      peakLatency: 0,  // 현재는 사용되지 않음
      activeConnections: 0,
      messageSizes: [] // 메시지 크기 기록 (분포 분석용)
    };
    this.timer = null;
  }

  recordMessage(size, latency = 0) {
    this.metrics.messagesProcessed++;
    this.metrics.bytesTransferred += size;
    this.metrics.messageSizes.push(size);
    // 현재는 latency 측정이 구현되지 않았으므로 0으로 기록
    this.metrics.totalLatency += latency;
    if (latency > this.metrics.peakLatency) {
      this.metrics.peakLatency = latency;
    }
  }

  updateConnectionCount(count) {
    this.metrics.activeConnections = count;
  }

  start() {
    this.timer = setInterval(() => {
      this._calculateAndLogMetrics();
      this._resetMetrics();
    }, this.interval);
    logger.info('Performance monitoring started.'); // console.log 대신 logger.info
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Performance monitoring stopped.'); // console.log 대신 logger.info
    }
  }

  _calculateAndLogMetrics() {
    const { messagesProcessed, bytesTransferred, totalLatency, peakLatency, activeConnections, messageSizes } = this.metrics;

    if (messagesProcessed === 0) {
      logger.info('No messages processed in this interval.'); // console.log 대신 logger.info
      return;
    }

    const averageLatency = messagesProcessed > 0 ? (totalLatency / messagesProcessed).toFixed(2) : 0;
    const averageMessageSize = messageSizes.length > 0 ? (messageSizes.reduce((a, b) => a + b, 0) / messageSizes.length).toFixed(2) : 0;

    logger.info('--- Performance Metrics ---'); // console.log 대신 logger.info
    logger.info(`Messages Processed: ${messagesProcessed}`); // console.log 대신 logger.info
    logger.info(`Bytes Transferred: ${bytesTransferred} bytes`); // console.log 대신 logger.info
    logger.info(`Average Message Size: ${averageMessageSize} bytes`); // console.log 대신 logger.info
    logger.info(`Active Connections: ${activeConnections}`); // console.log 대신 logger.info
    logger.info(`Average Latency: ${averageLatency} ms (Currently not implemented)`); // console.log 대신 logger.info
    logger.info(`Peak Latency: ${peakLatency} ms (Currently not implemented)`); // console.log 대신 logger.info
    logger.info('-------------------------'); // console.log 대신 logger.info
  }

  _resetMetrics() {
    this.metrics = {
      messagesProcessed: 0,
      bytesTransferred: 0,
      totalLatency: 0,
      peakLatency: 0,
      activeConnections: this.metrics.activeConnections, // 연결 수는 유지
      messageSizes: []
    };
  }
}

module.exports = PerformanceMonitor;
