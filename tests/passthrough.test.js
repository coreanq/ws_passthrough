import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001; // dummy TCP server port
const WS_PORT = 8080;

console.log('Starting TCP and WebSocket servers...');

const echoPath = path.join(__dirname, 'dummyTcpEchoServer.js');
const tcpServer = spawn('node', [echoPath, PORT]);

tcpServer.stdout.on('data', data => {
  console.log(`TCP Server: ${data}`);
});
tcpServer.stderr.on('data', data => {
  console.error(`TCP Server Error: ${data}`);
});
tcpServer.on('error', err => {
  console.error('TCP Server Spawn Error: ', err);
});
tcpServer.on('close', code => {
  if (code !== 0) {
    console.log(`TCP Server process exited with code ${code}`);
  }
});

const serverPath = path.join(__dirname, '..', 'src', 'index.js');
const wsServer = spawn('node', [serverPath]);

wsServer.stdout.on('data', data => {
  const output = data.toString();
  console.log(`WS Server: ${output}`);
  if (output.includes('WebSocket 서버가 8080 포트에서 실행 중입니다.')) {
    console.log('WebSocket and TCP servers are running. Keeping them alive.');
  }
});
wsServer.stderr.on('data', data => {
  console.error(`WS Server Error: ${data}`);
});
wsServer.on('error', err => {
  console.error('WS Server Spawn Error: ', err);
});
wsServer.on('close', code => {
  if (code !== 0) {
    console.log(`WS Server process exited with code ${code}`);
  }
});

// To keep the main script process alive indefinitely
setInterval(() => {}, 1000); // Keep event loop busy
