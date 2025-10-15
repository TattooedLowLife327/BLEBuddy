// utils/bleConnection.js
// BLE Dart Board Connection for LowLife BLE Buddy

const SERVICE_UUID = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const RX_UUID = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';

class BLEConnection {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    this.onThrowCallbacks = [];
    this.onStatusChangeCallbacks = [];
  }

  // Subscribe to dart throw events
  onThrow(callback) {
    this.onThrowCallbacks.push(callback);
  }

  // Subscribe to connection status changes
  onStatusChange(callback) {
    this.onStatusChangeCallbacks.push(callback);
  }

  // Notify status change listeners
  notifyStatusChange(status) {
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  // Connect to Granboard
  async connect() {
    try {
      this.notifyStatusChange('scanning');

      // Request Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });

      this.notifyStatusChange('connecting');

      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      
      // Get service
      this.service = await this.server.getPrimaryService(SERVICE_UUID);
      
      // Get characteristic
      this.characteristic = await this.service.getCharacteristic(RX_UUID);

      // Start notifications
      await this.characteristic.startNotifications();
      
      // Listen for dart throws
      this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleDartThrow(event);
      });

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.notifyStatusChange('connected');

      return { success: true, device: this.device };

    } catch (error) {
      console.error('BLE Connection Error:', error);
      this.isConnected = false;
      this.notifyStatusChange('error');
      return { success: false, error: error.message };
    }
  }

  // Handle incoming dart throw data
  handleDartThrow(event) {
    try {
      const value = new TextDecoder().decode(event.target.value);
      const throwData = JSON.parse(value);

      // Enrich throw data with timestamp
      const enrichedThrow = {
        ...throwData,
        timestamp: new Date().toISOString(),
        device: this.device?.name || 'Granboard'
      };

      console.log('🎯 Dart Hit:', enrichedThrow);

      // Notify all throw listeners
      this.onThrowCallbacks.forEach(cb => cb(enrichedThrow));

    } catch (error) {
      console.error('Error parsing throw data:', error);
    }
  }

  // Handle disconnection
  handleDisconnection() {
    console.log('🔌 Dart board disconnected');
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.notifyStatusChange('disconnected');
  }

  // Disconnect from board
  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.handleDisconnection();
  }

  // Generate test throw (for development)
  simulateThrow(segment = 'T20', score = 60) {
    const testThrow = {
      segment,
      score,
      multiplier: segment.startsWith('T') ? 3 : segment.startsWith('D') ? 2 : 1,
      dartNum: Math.floor(Math.random() * 3) + 1,
      timestamp: new Date().toISOString()
    };

    console.log('🧪 Simulated Throw:', testThrow);
    this.onThrowCallbacks.forEach(cb => cb(testThrow));
    
    return testThrow;
  }

  // Check if Web Bluetooth is supported
  static isSupported() {
    return 'bluetooth' in navigator;
  }
}

// Export singleton instance
export const bleConnection = new BLEConnection();
export default bleConnection;
