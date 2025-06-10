import { expect } from 'chai';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net'; // Import net module

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001; // dummy TCP server port
const WS_PORT = 8080;

// Helper function to promisify client.on('open')
function waitForOpen(client) {
  return new Promise((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject); // Also reject if an error occurs during open
  });
}

// Helper function to promisify client.once('message')
function waitForMessage(client) {
  return new Promise((resolve, reject) => {
    client.once('message', resolve);
    client.once('error', reject); // Also reject if an error occurs while waiting for message
  });
}

describe('WebSocket passthrough integration', function() {
  this.timeout(10000);
  let tcpServer;
  let wsServer;

  before(done => {
    const echoPath = path.join(__dirname, 'dummyTcpEchoServer.js');
    tcpServer = spawn('node', [echoPath, PORT]);

    tcpServer.stdout.on('data', data => {
      console.log(`TCP Server stdout: ${data}`);
    });
    tcpServer.stderr.on('data', data => {
      console.error(`TCP Server stderr: ${data}`);
    });
    tcpServer.on('error', err => {
      console.error('TCP Server spawn error:', err);
      done(err);
    });

    const serverPath = path.join(__dirname, '..', 'src', 'index.js');
    wsServer = spawn('node', [serverPath]);

    let wsServerReady = false;
    wsServer.stdout.on('data', data => {
      const output = data.toString();
      console.log(`WS Server stdout: ${output}`);
      if (output.includes('WebSocket 서버가 8080 포트에서 실행 중입니다.') && !wsServerReady) {
        wsServerReady = true;
        done(); // WS server is ready, proceed with tests
      }
    });
    wsServer.stderr.on('data', data => {
      console.error(`WS Server stderr: ${data}`);
    });
    wsServer.on('error', err => {
      console.error('WS Server spawn error:', err);
      done(err);
    });

    // Add a timeout for server startup to prevent hanging indefinitely
    setTimeout(() => {
      if (!wsServerReady) {
        done(new Error('WebSocket server did not start within the allocated time.'));
      }
    }, 5000); // 5 seconds timeout for server to start
  });

  after(done => {
    if (wsServer) wsServer.kill();
    if (tcpServer) tcpServer.kill();
    setTimeout(done, 200);
  });

  it('echos data sent through /config and /data', async () => {
    const client = new WebSocket(`ws://localhost:${WS_PORT}`);

    // Centralized error handling for the client
    client.on('error', (err) => {
      console.error('WebSocket client error:', err);
      throw err;
    });

    try {
      await waitForOpen(client);

      client.send(JSON.stringify({ path: '/config', data: { targetIp: '127.0.0.1', targetPort: PORT } }));
      await waitForMessage(client); // Wait for config response

      client.send(JSON.stringify({ path: '/data', data: 'hello' }));
      const msg = await waitForMessage(client); // Wait for data echo

      expect(msg.toString()).to.equal('hello');
      client.close();
    } catch (error) {
      console.error('Test failed due to WebSocket operation:', error);
      client.close(); // Ensure client is closed on error
      throw error; // Re-throw to ensure the test fails
    }
  });
});
