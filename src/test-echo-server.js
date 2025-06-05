/**
 * 에코 서버 테스트 스크립트
 * 이 스크립트는 타겟 서버를 시뮬레이션하기 위한 간단한 TCP 에코 서버입니다.
 * WebSocket 패스스루 서버가 연결할 대상 서버 역할을 합니다.
 */

const net = require('net');
const dotenv = require('dotenv');

// 환경 변수 로드
dotenv.config();

// 서버 설정
const TARGET_PORT = 8080;
const TARGET_HOST = '0.0.0.0'; // 모든 인터페이스에서 연결 수락

// 클라이언트 연결 관리
const clients = new Map();
let clientIdCounter = 0;

// 에코 서버 생성
const server = net.createServer((socket) => {
  const clientId = ++clientIdCounter;
  const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
  
  // 클라이언트 정보 저장
  clients.set(clientId, {
    id: clientId,
    address: clientAddress,
    socket: socket,
    connectedAt: new Date()
  });
  
  console.log(`[${clientId}] 새 클라이언트 연결: ${clientAddress}`);
  
  // 데이터 수신 이벤트 처리
  socket.on('data', (data) => {
    console.log(`[${clientId}] 데이터 수신: ${data.toString().trim()}`);
    
    // 에코 응답 (수신한 데이터를 그대로 반환)
    const response = `에코: ${data.toString().trim()}`;
    console.log(`[${clientId}] 응답 전송: ${response}`);
    socket.write(response);
  });
  
  // 연결 종료 이벤트 처리
  socket.on('close', () => {
    console.log(`[${clientId}] 클라이언트 연결 종료: ${clientAddress}`);
    clients.delete(clientId);
    printConnectedClients();
  });
  
  // 오류 이벤트 처리
  socket.on('error', (error) => {
    console.error(`[${clientId}] 오류: ${error.message}`);
    clients.delete(clientId);
    printConnectedClients();
  });
  
  // 연결 환영 메시지 전송
  socket.write('에코 서버에 연결되었습니다.\n');
  
  // 현재 연결된 클라이언트 출력
  printConnectedClients();
});

// 연결된 클라이언트 정보 출력
function printConnectedClients() {
  console.log(`현재 연결된 클라이언트: ${clients.size}`);
  clients.forEach((client) => {
    const connectedTime = Math.round((new Date() - client.connectedAt) / 1000);
    console.log(`- [${client.id}] ${client.address} (연결 시간: ${connectedTime}초)`);
  });
}

// 서버 시작
server.listen(TARGET_PORT, TARGET_HOST, () => {
  console.log(`에코 서버가 ${TARGET_HOST}:${TARGET_PORT}에서 실행 중입니다.`);
});

// 오류 이벤트 처리
server.on('error', (error) => {
  console.error(`서버 오류: ${error.message}`);
});

// SIGINT 핸들러 (Ctrl+C)
process.on('SIGINT', () => {
  console.log('서버를 종료합니다...');
  server.close(() => {
    console.log('서버가 종료되었습니다.');
    process.exit(0);
  });
});
