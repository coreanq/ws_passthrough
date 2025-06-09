const { expect } = require('chai');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

// Increase test timeout because spawning processes may take time
const PORT = 3001; // dummy TCP server port
const WS_PORT = 8080;

describe('WebSocket passthrough integration', function() {
  this.timeout(10000);
  let tcpServer;
  let wsServer;

  before(done => {
    const echoPath = path.join(__dirname, 'dummyTcpEchoServer.js');
    tcpServer = spawn('node', [echoPath, PORT]);
    tcpServer.on('error', done);
    // Wait a bit for TCP server to be ready
    setTimeout(() => {
      const serverPath = path.join(__dirname, '..', 'src', 'index.js');
      wsServer = spawn('node', [serverPath]);
      wsServer.on('error', done);
      // give server time to start
      setTimeout(done, 500);
    }, 500);
  });

  after(done => {
    if (wsServer) wsServer.kill();
    if (tcpServer) tcpServer.kill();
    setTimeout(done, 200);
  });

  it('echos data sent through /config and /data', done => {
    const client = new WebSocket(`ws://localhost:${WS_PORT}`);

    client.on('open', () => {
      // Listen for config response first
      client.once('message', () => {
        // After config success, listen for echo
        client.once('message', msg => {
          expect(msg.toString()).to.equal('hello');
          client.close();
          done();
        });
        client.send(JSON.stringify({ path: '/data', data: 'hello' }));
      });
      client.send(JSON.stringify({ path: '/config', data: { targetIp: '127.0.0.1', targetPort: PORT } }));
    });

    client.on('error', done);
  });
});
