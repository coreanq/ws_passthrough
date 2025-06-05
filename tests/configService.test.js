/**
 * Configuration Service Tests
 * Tests for the configuration service functionality
 */

const configService = require('../src/services/configService');

// Mock logger to avoid console output during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Configuration Service', () => {
  // Reset configuration before each test
  beforeEach(() => {
    configService.resetConfig();
  });
  
  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = configService.getConfig();
      
      expect(config).toBeDefined();
      expect(config.target).toBeDefined();
      expect(config.target.ip).toBeDefined();
      expect(config.target.port).toBeDefined();
    });
    
    it('should return a copy of the configuration', () => {
      const config1 = configService.getConfig();
      const config2 = configService.getConfig();
      
      // Verify they're different objects (deep clone)
      expect(config1).not.toBe(config2);
      expect(config1.target).not.toBe(config2.target);
      
      // But they should have the same values
      expect(config1).toEqual(config2);
    });
  });
  
  describe('updateTargetConfig', () => {
    it('should update target IP and port', () => {
      const newConfig = {
        ip: '192.168.1.100',
        port: 9000
      };
      
      const updatedConfig = configService.updateTargetConfig(newConfig);
      
      expect(updatedConfig.target.ip).toBe(newConfig.ip);
      expect(updatedConfig.target.port).toBe(newConfig.port);
      
      // Verify the update persisted
      const currentConfig = configService.getConfig();
      expect(currentConfig.target.ip).toBe(newConfig.ip);
      expect(currentConfig.target.port).toBe(newConfig.port);
    });
    
    it('should update only provided fields', () => {
      const originalConfig = configService.getConfig();
      
      // Update only IP
      const updatedConfig1 = configService.updateTargetConfig({ ip: '192.168.1.100' });
      expect(updatedConfig1.target.ip).toBe('192.168.1.100');
      expect(updatedConfig1.target.port).toBe(originalConfig.target.port);
      
      // Update only port
      const updatedConfig2 = configService.updateTargetConfig({ port: 9000 });
      expect(updatedConfig2.target.ip).toBe('192.168.1.100'); // Still has updated IP
      expect(updatedConfig2.target.port).toBe(9000);
    });
    
    it('should convert port to number', () => {
      const updatedConfig = configService.updateTargetConfig({ port: '9000' });
      expect(typeof updatedConfig.target.port).toBe('number');
      expect(updatedConfig.target.port).toBe(9000);
    });
  });
  
  describe('resetConfig', () => {
    it('should reset configuration to defaults', () => {
      // First update config
      configService.updateTargetConfig({
        ip: '192.168.1.100',
        port: 9000
      });
      
      // Get original default values
      const originalConfig = configService.resetConfig();
      
      // Then reset and get new config
      const resetConfig = configService.getConfig();
      
      // Verify they match
      expect(resetConfig).toEqual(originalConfig);
      expect(resetConfig.target.ip).not.toBe('192.168.1.100');
      expect(resetConfig.target.port).not.toBe(9000);
    });
  });
  
  describe('events', () => {
    it('should notify subscribers when target config changes', (done) => {
      const newConfig = {
        ip: '192.168.1.100',
        port: 9000
      };
      
      // Subscribe to event
      configService.subscribe(configService.events.TARGET_CONFIG_CHANGED, (targetConfig) => {
        expect(targetConfig.ip).toBe(newConfig.ip);
        expect(targetConfig.port).toBe(newConfig.port);
        done();
      });
      
      // Update config to trigger event
      configService.updateTargetConfig(newConfig);
    });
    
    it('should notify subscribers when config is reset', (done) => {
      // Subscribe to event
      configService.subscribe(configService.events.CONFIG_RESET, (config) => {
        expect(config).toBeDefined();
        expect(config.target).toBeDefined();
        done();
      });
      
      // Reset config to trigger event
      configService.resetConfig();
    });
    
    it('should allow unsubscribing from events', () => {
      const listener = jest.fn();
      
      // Subscribe
      configService.subscribe(configService.events.TARGET_CONFIG_CHANGED, listener);
      
      // Unsubscribe
      configService.unsubscribe(configService.events.TARGET_CONFIG_CHANGED, listener);
      
      // Update config
      configService.updateTargetConfig({ ip: '192.168.1.100' });
      
      // Listener should not have been called
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
