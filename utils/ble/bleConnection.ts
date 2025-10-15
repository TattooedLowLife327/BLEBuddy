// utils/ble/bleConnection.ts
// BLE Dart Board Connection for LowLife BLE Buddy

const SERVICE_UUID = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const RX_UUID = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';

export type BLEStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface DartThrowData {
  segment: string;
  score: number;
  multiplier: number;
  dartNum: number;
  timestamp: string;
  device?: string;
  coordinates?: { x: number; y: number };
}

export type ThrowCallback = (throwData: DartThrowData) => void;
export type StatusCallback = (status: BLEStatus) => void;

class BLEConnection {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  public isConnected: boolean = false;
  private onThrowCallbacks: ThrowCallback[] = [];
  private onStatusChangeCallbacks: StatusCallback[] = [];

  // Subscribe to dart throw events
  onThrow(callback: ThrowCallback): void {
    this.onThrowCallbacks.push(callback);
  }

  // Unsubscribe from dart throw events
  offThrow(callback: ThrowCallback): void {
    this.onThrowCallbacks = this.onThrowCallbacks.filter(cb => cb !== callback);
  }

  // Subscribe to connection status changes
  onStatusChange(callback: StatusCallback): void {
    this.onStatusChangeCallbacks.push(callback);
  }

  // Unsubscribe from status changes
  offStatusChange(callback: StatusCallback): void {
    this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter(cb => cb !== callback);
  }

  // Notify status change listeners
  private notifyStatusChange(status: BLEStatus): void {
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  // Connect to Granboard
  async connect(): Promise<{ success: boolean; device?: BluetoothDevice; error?: string }> {
    try {
      // Check if Bluetooth is supported
      if (!navigator.bluetooth) {
        // Provide detailed error info
        const isSecure = window.isSecureContext;
        const protocol = window.location.protocol;

        let error = 'Web Bluetooth is not available.\n\n';

        if (!isSecure) {
          error += 'Issue: Not a secure context (HTTPS required)\n';
          error += `Current protocol: ${protocol}\n\n`;
          error += 'Solution: Access this site via HTTPS';
        } else {
          error += 'Your browser may not support Web Bluetooth.\n\n';
          error += 'Try:\n';
          error += '1. Enable Web Bluetooth in chrome://flags\n';
          error += '2. Update Chrome to latest version\n';
          error += '3. Use Chrome or Edge browser';
        }

        this.notifyStatusChange('error');
        return { success: false, error };
      }

      this.notifyStatusChange('scanning');

      // Request Bluetooth device with more flexible options
      try {
        this.device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
          optionalServices: [SERVICE_UUID]
        });
      } catch (deviceError) {
        // If service filter fails, try with name filter
        this.device = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'GranBoard' }],
          optionalServices: [SERVICE_UUID]
        });
      }

      this.notifyStatusChange('connecting');

      // Connect to GATT server
      if (!this.device.gatt) {
        throw new Error('Device does not support GATT');
      }

      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(RX_UUID);
      await this.characteristic.startNotifications();

      // Listen for dart throws
      this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleDartThrow(event as Event & { target: { value: DataView } });
      });

      // Listen for disconnection
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.notifyStatusChange('connected');

      return { success: true, device: this.device };

    } catch (error) {
      const err = error as Error;
      let errorMessage = err.message || 'Unknown error';

      // Log full error details for debugging
      const errorDetails = {
        name: err.name,
        message: err.message,
        stack: err.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      };

      // Provide more helpful error messages
      if (err.name === 'NotFoundError') {
        errorMessage = `No Granboard device found.\n\nMake sure:\n- Board is powered on\n- Board is in pairing mode\n- Bluetooth is enabled\n\nError: ${err.message}`;
      } else if (err.name === 'SecurityError') {
        errorMessage = `Bluetooth access denied.\n\nError: ${err.message}\n\nThis app requires HTTPS and Bluetooth permissions.`;
      } else if (err.name === 'NotSupportedError') {
        errorMessage = `Web Bluetooth not supported.\n\nError: ${err.message}\n\nTry Microsoft Edge browser.`;
      } else if (err.name === 'NotAllowedError') {
        errorMessage = `Bluetooth permission denied.\n\nError: ${err.message}\n\nYou cancelled the Bluetooth pairing dialog or browser doesn't have permission.`;
      } else {
        errorMessage = `Connection failed: ${err.name}\n\n${err.message}\n\nDetails: ${errorDetails.fullError}`;
      }

      this.isConnected = false;
      this.notifyStatusChange('error');
      return { success: false, error: errorMessage };
    }
  }

  // Handle incoming dart throw data
  private handleDartThrow(event: Event & { target: { value: DataView } }): void {
    try {
      const value = new TextDecoder().decode(event.target.value);
      const throwData = JSON.parse(value) as Partial<DartThrowData>;

      // Enrich throw data with timestamp
      const enrichedThrow: DartThrowData = {
        segment: throwData.segment || 'Unknown',
        score: throwData.score || 0,
        multiplier: throwData.multiplier || 1,
        dartNum: throwData.dartNum || 1,
        timestamp: new Date().toISOString(),
        device: this.device?.name || 'Granboard',
        coordinates: throwData.coordinates
      };

      // Notify all throw listeners
      this.onThrowCallbacks.forEach(cb => cb(enrichedThrow));

    } catch (error) {
      // Silently fail - invalid data from board
    }
  }

  // Handle disconnection
  private handleDisconnection(): void {
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.notifyStatusChange('disconnected');
  }

  // Disconnect from board
  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt!.connected) {
      await this.device.gatt!.disconnect();
    }
    this.handleDisconnection();
  }

  // Generate test throw (for development)
  simulateThrow(segment: string = 'T20', score: number = 60): DartThrowData {
    const testThrow: DartThrowData = {
      segment,
      score,
      multiplier: segment.startsWith('T') ? 3 : segment.startsWith('D') ? 2 : 1,
      dartNum: Math.floor(Math.random() * 3) + 1,
      timestamp: new Date().toISOString(),
      device: 'Simulated'
    };

    this.onThrowCallbacks.forEach(cb => cb(testThrow));

    return testThrow;
  }

  // Check if Web Bluetooth is supported
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  // Get current device info
  getDeviceInfo(): { name: string; connected: boolean } | null {
    if (!this.device) return null;
    return {
      name: this.device.name || 'Granboard',
      connected: this.isConnected
    };
  }
}

// Export singleton instance
export const bleConnection = new BLEConnection();
export default bleConnection;
