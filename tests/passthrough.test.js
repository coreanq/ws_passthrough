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

const toHexString = (byteArray) => {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase();
  }).join(' ');
};

describe('WebSocket passthrough integration', function() {
  this.timeout(10000);
  let tcpServer;
  let wsServer;

  before(done => {
    const echoPath = path.join(__dirname, 'dummyTcpEchoServer.js');
    tcpServer = spawn('node', [echoPath, PORT]);

    tcpServer.stdout.on('data', data => {
      console.log(`TCP Server:\n${data}`);
    });
    tcpServer.stderr.on('data', data => {
      console.error(`TCP Server:\n${data}`);
    });
    tcpServer.on('error', err => {
      console.error('TCP Server:\n', err);
      done(err);
    });

    const serverPath = path.join(__dirname, '..', 'src', 'index.js');
    wsServer = spawn('node', [serverPath]);

    let wsServerReady = false;
    wsServer.stdout.on('data', data => {
      const output = data.toString();
      console.log(`WS Server:\n${output}`);
      if (output.includes('WebSocket 서버가 8080 포트에서 실행 중입니다.') && !wsServerReady) {
        wsServerReady = true;
        done(); // WS server is ready, proceed with tests
      }
    });
    wsServer.stderr.on('data', data => {
      console.error(`WS Server:\n${data}`);
    });
    wsServer.on('error', err => {
      console.error('WS Server:\n', err);
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
    const ws_client = new WebSocket(`ws://localhost:${WS_PORT}`);

    // Centralized error handling for the client
    ws_client.on('error', (err) => {
      console.error('WebSocket client error:', err);
      throw err;
    });

    try {
      await waitForOpen(ws_client);
      console.log('WS Client: Connected.');

      const configMessage = { path: '/config', data: { targetIp: '127.0.0.1', targetPort: PORT } };
      const configMessageString = JSON.stringify(configMessage);
      console.log(`WS Client: Sending config: ${configMessageString}`);
      ws_client.send(configMessageString);
      
      const configResponse = await waitForMessage(ws_client); // Wait for config response
      console.log(`WS Client: Received config response: ${configResponse.toString()}`);

      const testDataString = 'hello';
      const testDataUint8Array = Buffer.from(testDataString);
      const testDataAsArray = Array.from(testDataUint8Array);
      const dataMessage = { path: '/data', data: testDataAsArray };
      const dataMessageString = JSON.stringify(dataMessage);

      console.log(`WS Client: Sending data (HexString): ${toHexString(testDataUint8Array)}`);
      ws_client.send(dataMessageString);
      
      const msg = await waitForMessage(ws_client); // Wait for data echo

      const expectedHex = toHexString(testDataUint8Array);
      const receivedHex = toHexString(msg);
      
      console.log(`WS Client: Received data (HexString): ${receivedHex}`);
      
      expect(receivedHex).to.equal(expectedHex);
      ws_client.close();
      console.log('WS Client: Connection closed.');
    } catch (error) {
      console.error('Test failed due to WebSocket operation:', error);
      ws_client.close(); // Ensure client is closed on error
      throw error; // Re-throw to ensure the test fails
    }
  });
});
