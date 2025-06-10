// src/utils/logger.js
import * as winston from 'winston';

// Dark Mode 를 고려해서 색상 설정이 되어야 한다.
// winston.format.colorize()는 콘솔 출력에 색상을 추가합니다.
// 파일 출력에는 색상이 필요 없으므로, 콘솔 트랜스포트에만 적용합니다.
const customColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey'
};
winston.addColors(customColors);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // 환경 변수 또는 기본값 'info'
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json() // 구조화된 JSON 로그
  ),
  defaultMeta: { service: 'websocket-passthrough-server' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// 개발 환경에서만 디버그 레벨 로깅 활성화
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.printf(
        info => `${info.timestamp} ${info.level}: ${info.message} ${info.meta ? JSON.stringify(info.meta) : ''}`
      )
    )
  }));
}

export default logger;
