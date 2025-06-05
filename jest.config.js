/**
 * Jest configuration file
 */

module.exports = {
  // 테스트 환경 설정
  testEnvironment: 'node',
  
  // 테스트 파일 패턴
  testMatch: ['**/tests/**/*.test.js'],
  
  // 테스트 타임아웃 설정 (밀리초)
  testTimeout: 10000,
  
  // 상세한 테스트 출력
  verbose: true,
  
  // 테스트 실행 후 정리
  clearMocks: true,
  
  // 코드 커버리지 설정
  collectCoverage: false,
  
  // 테스트 실행 순서 무작위화
  randomize: false
};
