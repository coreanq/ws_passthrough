/**
 * Configuration API Tests
 * Tests for the configuration management API endpoints
 */

const request = require('supertest');
const express = require('express');
const configRoutes = require('../src/controllers/configController');
const configService = require('../src/services/configService');

// Mock logger to avoid console output during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/config', configRoutes);

describe('Configuration API', () => {
  // Reset configuration before each test
  beforeEach(() => {
    configService.resetConfig();
  });
  
  describe('GET /config', () => {
    it('should return current configuration', async () => {
      const response = await request(app).get('/config');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('target');
      expect(response.body.target).toHaveProperty('ip');
      expect(response.body.target).toHaveProperty('port');
    });
  });
  
  describe('POST /config', () => {
    it('should update target configuration with valid data', async () => {
      const newConfig = {
        ip: '192.168.1.100',
        port: 9000
      };
      
      const response = await request(app)
        .post('/config')
        .send(newConfig);
      
      expect(response.status).toBe(200);
      expect(response.body.target.ip).toBe(newConfig.ip);
      expect(response.body.target.port).toBe(newConfig.port);
      
      // Verify configuration was actually updated
      const getResponse = await request(app).get('/config');
      expect(getResponse.body.target.ip).toBe(newConfig.ip);
      expect(getResponse.body.target.port).toBe(newConfig.port);
    });
    
    it('should reject invalid IP address', async () => {
      const invalidConfig = {
        ip: 'invalid-ip',
        port: 9000
      };
      
      const response = await request(app)
        .post('/config')
        .send(invalidConfig);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should reject invalid port number', async () => {
      const invalidConfig = {
        ip: '192.168.1.100',
        port: 70000 // Port out of range
      };
      
      const response = await request(app)
        .post('/config')
        .send(invalidConfig);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should reject request missing required fields', async () => {
      const incompleteConfig = {
        ip: '192.168.1.100'
        // Missing port
      };
      
      const response = await request(app)
        .post('/config')
        .send(incompleteConfig);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('DELETE /config', () => {
    it('should reset configuration to defaults', async () => {
      // First update config
      const newConfig = {
        ip: '192.168.1.100',
        port: 9000
      };
      
      await request(app)
        .post('/config')
        .send(newConfig);
      
      // Then reset it
      const response = await request(app).delete('/config');
      
      expect(response.status).toBe(200);
      
      // Get default values from config service
      const defaultConfig = configService.getConfig();
      
      // Verify reset worked
      expect(response.body.target.ip).toBe(defaultConfig.target.ip);
      expect(response.body.target.port).toBe(defaultConfig.target.port);
    });
  });
});
