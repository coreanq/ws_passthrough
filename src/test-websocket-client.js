/**
 * WebSocket 패스스루 클라이언트 테스트 스크립트
 * 이 스크립트는 WebSocket 연결을 설정하고 데이터를 송수신하는 기능을 테스트합니다.
 */

const WebSocket = require('ws');
const dotenv = require('dotenv');

// 환경 변수 로드
dotenv.config();

// 서버 설정
const SERVER_PORT = process.env.PORT || 4000;
const SERVER_HOST = '127.0.0.1';
const WS_URL = `ws://${SERVER_HOST}:${SERVER_PORT}/data`;

console.log(`WebSocket 서버 주소: ${WS_URL}`);

// 테스트 데이터
const TEST_MESSAGES = [
  'Hello, WebSocket Server!',
  'This is a test message',
  'Testing data passthrough functionality',
  JSON.stringify({ type: 'command', action: 'getData', id: 12345 })
  // 바이너리 데이터 테스트는 일단 제외
];

// WebSocket 클라이언트 생성
const ws = new WebSocket(WS_URL, {
  perMessageDeflate: false // 압축 비활성화
});

// 메시지 전송 간격 (밀리초)
const MESSAGE_INTERVAL = 2000;
let messageIndex = 0;
let messageInterval;

// 연결 이벤트 처리
ws.on('open', () => {
  console.log('서버에 연결되었습니다.');
  
  // 주기적으로 메시지 전송
  messageInterval = setInterval(() => {
    if (messageIndex < TEST_MESSAGES.length) {
      const message = TEST_MESSAGES[messageIndex];
      console.log(`메시지 전송: ${message}`);
      ws.send(message);
      messageIndex++;
    } else {
      // 모든 메시지를 전송한 후 인터벌 정리
      clearInterval(messageInterval);
      console.log('모든 테스트 메시지를 전송했습니다.');
      
      // 5초 후에 연결 종료
      setTimeout(() => {
        console.log('연결을 종료합니다...');
        ws.close();
      }, 5000);
    }
  }, MESSAGE_INTERVAL);
});

// 메시지 수신 이벤트 처리
ws.on('message', (data) => {
  try {
    // 수신된 데이터가 JSON인지 확인
    const jsonData = JSON.parse(data.toString());
    console.log('서버로부터 JSON 메시지 수신:', jsonData);
  } catch (e) {
    // JSON이 아닌 경우 일반 텍스트로 처리
    console.log('서버로부터 텍스트 수신:', data.toString());
  }
});

// 오류 이벤트 처리
ws.on('error', (error) => {
  console.error('WebSocket 오류:', error.message);
});

// 연결 종료 이벤트 처리
ws.on('close', () => {
  console.log('서버와의 연결이 종료되었습니다.');
  
  // 인터벌이 아직 활성화된 경우 정리
  if (messageInterval) {
    clearInterval(messageInterval);
  }
  
  // 프로세스 종료
  process.exit(0);
});

// SIGINT 핸들러 (Ctrl+C)
process.on('SIGINT', () => {
  console.log('프로그램 종료 중...');
  
  // 인터벌 정리
  if (messageInterval) {
    clearInterval(messageInterval);
  }
  
  // WebSocket 연결 종료
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  } else {
    process.exit(0);
  }
});
