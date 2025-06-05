/**
 * 설정 관리 API 테스트 스크립트
 * 이 스크립트는 설정 관리 API의 기능을 테스트합니다.
 */

const http = require('http');
const dotenv = require('dotenv');

// 환경 변수 로드
dotenv.config();

// 서버 설정
const SERVER_PORT = process.env.PORT || 4000;
const SERVER_HOST = '127.0.0.1';

console.log(`서버 주소: http://${SERVER_HOST}:${SERVER_PORT}`);


// 설정 가져오기 테스트
console.log('설정 가져오기 테스트 중...');
const getConfigOptions = {
  hostname: SERVER_HOST,
  port: SERVER_PORT,
  path: '/config',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const getConfigRequest = http.request(getConfigOptions, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('현재 설정:');
    console.log(JSON.parse(data));
    
    // 설정 업데이트 테스트
    updateConfigTest();
  });
});

getConfigRequest.on('error', (error) => {
  console.error('설정 가져오기 오류:', error);
  console.error('서버가 실행 중인지 확인하고, 포트 번호가 올바른지 확인하세요.');
});

getConfigRequest.end();

// 설정 업데이트 테스트
function updateConfigTest() {
  console.log('\n설정 업데이트 테스트 중...');
  
  const newConfig = {
    ip: '192.168.1.100',
    port: 9000
  };
  
  const updateConfigOptions = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: '/config',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const updateConfigRequest = http.request(updateConfigOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('업데이트된 설정:');
      console.log(JSON.parse(data));
      
      // 설정 초기화 테스트
      resetConfigTest();
    });
  });
  
  updateConfigRequest.on('error', (error) => {
    console.error('설정 업데이트 오류:', error);
    console.error('서버가 실행 중인지 확인하고, 포트 번호가 올바른지 확인하세요.');
  });
  
  updateConfigRequest.write(JSON.stringify(newConfig));
  updateConfigRequest.end();
}

// 설정 초기화 테스트
function resetConfigTest() {
  console.log('\n설정 초기화 테스트 중...');
  
  const resetConfigOptions = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: '/config',
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const resetConfigRequest = http.request(resetConfigOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('초기화된 설정:');
      console.log(JSON.parse(data));
      console.log('\n모든 테스트 완료!');
    });
  });
  
  resetConfigRequest.on('error', (error) => {
    console.error('설정 초기화 오류:', error);
    console.error('서버가 실행 중인지 확인하고, 포트 번호가 올바른지 확인하세요.');
  });
  
  resetConfigRequest.end();
}
