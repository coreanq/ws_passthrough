// dummyTcpEchoServer.js
import net from 'net';
const PORT = process.argv[2] || 3001; // 명령줄 인수로 포트 번호 설정, 없으면 3001

// Helper function to convert Buffer/Uint8Array to Hex String
const toHexString = (byteArray) => {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase();
  }).join(' ');
};

const server = net.createServer(socket => {
  console.log('TCP Client connected:', socket.remoteAddress + ':' + socket.remotePort);

  socket.on('data', data => {
    // Received data is already a Buffer, which is a subclass of Uint8Array.
    const hexData = toHexString(data);
    console.log('Received from TCP Client: ', socket.remoteAddress + ':' + socket.remotePort, hexData);
    socket.write(data); // Echo back the received data (which is a Buffer/Uint8Array)
    console.log('Sent to TCP Client:', socket.remoteAddress + ':' + socket.remotePort, hexData);
  });

  socket.on('end', () => {
    console.log('TCP Client disconnected: ', socket.remoteAddress + ':' + socket.remotePort);
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
