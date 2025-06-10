// dummyTcpEchoServer.js
import net from 'net';
const PORT = process.argv[2] || 3001; // 명령줄 인수로 포트 번호 설정, 없으면 3001

const server = net.createServer(socket => {
  console.log('TCP Client connected:', socket.remoteAddress + ':' + socket.remotePort);

  socket.on('data', data => {
    console.log('Received from TCP Client:', data.toString());
    socket.write(data); // Echo back the received data
  });

  socket.on('end', () => {
    console.log('TCP Client disconnected:', socket.remoteAddress + ':' + socket.remotePort);
  });

  socket.on('error', err => {
    console.error('TCP Socket Error:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Dummy TCP Echo Server listening on port ${PORT}`);
});

server.on('error', err => {
  console.error('TCP Server Error:', err.message);
});
