/**
 * WebSocket Passthrough Server
 * Main server file that initializes both HTTP and WebSocket servers
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

// Import configuration
const config = require('./config/config');
const logger = require('./utils/logger');

// Create Express app
const app = express();
app.use(express.json());

// 정적 파일 서빙 설정
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Import routes
const configRoutes = require('./controllers/configController');

// Use routes
app.use('/config', configRoutes);

// Add a simple status endpoint
app.get('/', (req, res) => {
  res.json({ status: 'running', message: 'WebSocket Passthrough Server is running' });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server - 가장 기본적인 설정만 사용
const wss = new WebSocket.Server({ 
  server,
  path: '/data'
});

// Create WebSocket server for events - 가장 기본적인 설정만 사용
const eventWss = new WebSocket.Server({ 
  server, 
  path: '/event'
});

// Import WebSocket handlers
const dataHandler = require('./controllers/dataController');
const eventHandler = require('./controllers/eventController');

// Setup WebSocket connection handlers
wss.on('connection', dataHandler);
eventWss.on('connection', eventHandler);

// Start the server
const PORT = process.env.PORT || 4000;

// 모든 인터페이스에서 접근 가능하도록 설정
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server running at /data`);
  logger.info(`Event WebSocket server running at /event`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = server;
