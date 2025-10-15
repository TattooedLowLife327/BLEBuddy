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
      this.notifyStatusChange('scanning');

      // Request Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });

      this.notifyStatusChange('connecting');

      // Connect to GATT server
      this.server = await this.device.gatt!.connect();

      // Get service
      this.service = await this.server.getPrimaryService(SERVICE_UUID);

      // Get characteristic
      this.characteristic = await this.service.getCharacteristic(RX_UUID);

      // Start notifications
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
      console.error('BLE Connection Error:', error);
      this.isConnected = false;
      this.notifyStatusChange('error');
      return { success: false, error: (error as Error).message };
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

      console.log('🎯 Dart Hit:', enrichedThrow);

      // Notify all throw listeners
      this.onThrowCallbacks.forEach(cb => cb(enrichedThrow));

    } catch (error) {
      console.error('Error parsing throw data:', error);
    }
  }

  // Handle disconnection
  private handleDisconnection(): void {
    console.log('🔌 Dart board disconnected');
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

    console.log('🧪 Simulated Throw:', testThrow);
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
