// utils/ble/bleConnection.ts
// BLE Dart Board Connection for LowLife BLE Buddy
// Using ACTUAL Granboard segment mapping from granboard2-app-by-JW

const SERVICE_UUID = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const RX_UUID = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';  // Notify (board -> app)
const TX_UUID = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';  // Write (app -> board) - for LED control

export type BLEStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';
export type SegmentType = 'SINGLE_INNER' | 'SINGLE_OUTER' | 'DOUBLE' | 'TRIPLE' | 'BULL' | 'DBL_BULL' | 'MISS' | 'RESET';

export interface DartThrowData {
  segment: string;
  score: number;
  multiplier: number;
  baseValue: number;
  segmentType: SegmentType;
  dartNum: number;
  timestamp: string;
  device?: string;
  rawBytes?: string;
  coordinates?: { x: number; y: number };
}

export type ThrowCallback = (throwData: DartThrowData) => void;
export type StatusCallback = (status: BLEStatus) => void;

// ============================================================================
// ACTUAL GRANBOARD SEGMENT MAP from granboard2-app-by-JW repo
// ============================================================================
interface SegmentInfo {
  value: number;
  type: SegmentType;
}

const SEGMENT_MAP: Record<string, SegmentInfo> = {
  // === NUMBER 1 ===
  '50-46-51-64': { value: 1, type: 'SINGLE_INNER' },
  '50-46-52-64': { value: 1, type: 'TRIPLE' },
  '50-46-53-64': { value: 1, type: 'SINGLE_OUTER' },
  '50-46-54-64': { value: 1, type: 'DOUBLE' },

  // === NUMBER 2 ===
  '57-46-49-64': { value: 2, type: 'SINGLE_INNER' },
  '57-46-48-64': { value: 2, type: 'TRIPLE' },
  '57-46-50-64': { value: 2, type: 'SINGLE_OUTER' },
  '56-46-50-64': { value: 2, type: 'DOUBLE' },

  // === NUMBER 3 ===
  '55-46-49-64': { value: 3, type: 'SINGLE_INNER' },
  '55-46-48-64': { value: 3, type: 'TRIPLE' },
  '55-46-50-64': { value: 3, type: 'SINGLE_OUTER' },
  '56-46-52-64': { value: 3, type: 'DOUBLE' },

  // === NUMBER 4 ===
  '48-46-49-64': { value: 4, type: 'SINGLE_INNER' },
  '48-46-51-64': { value: 4, type: 'TRIPLE' },
  '48-46-53-64': { value: 4, type: 'SINGLE_OUTER' },
  '48-46-54-64': { value: 4, type: 'DOUBLE' },

  // === NUMBER 5 ===
  '53-46-49-64': { value: 5, type: 'SINGLE_INNER' },
  '53-46-50-64': { value: 5, type: 'TRIPLE' },
  '53-46-52-64': { value: 5, type: 'SINGLE_OUTER' },
  '52-46-54-64': { value: 5, type: 'DOUBLE' },

  // === NUMBER 6 ===
  '49-46-48-64': { value: 6, type: 'SINGLE_INNER' },
  '49-46-49-64': { value: 6, type: 'TRIPLE' },
  '49-46-51-64': { value: 6, type: 'SINGLE_OUTER' },
  '52-46-52-64': { value: 6, type: 'DOUBLE' },

  // === NUMBER 7 ===
  '49-49-46-49-64': { value: 7, type: 'SINGLE_INNER' },
  '49-49-46-50-64': { value: 7, type: 'TRIPLE' },
  '49-49-46-52-64': { value: 7, type: 'SINGLE_OUTER' },
  '56-46-54-64': { value: 7, type: 'DOUBLE' },

  // === NUMBER 8 ===
  '54-46-50-64': { value: 8, type: 'SINGLE_INNER' },
  '54-46-52-64': { value: 8, type: 'TRIPLE' },
  '54-46-53-64': { value: 8, type: 'SINGLE_OUTER' },
  '54-46-54-64': { value: 8, type: 'DOUBLE' },

  // === NUMBER 9 ===
  '57-46-51-64': { value: 9, type: 'SINGLE_INNER' },
  '57-46-52-64': { value: 9, type: 'TRIPLE' },
  '57-46-53-64': { value: 9, type: 'SINGLE_OUTER' },
  '57-46-54-64': { value: 9, type: 'DOUBLE' },

  // === NUMBER 10 ===
  '50-46-48-64': { value: 10, type: 'SINGLE_INNER' },
  '50-46-49-64': { value: 10, type: 'TRIPLE' },
  '50-46-50-64': { value: 10, type: 'SINGLE_OUTER' },
  '52-46-51-64': { value: 10, type: 'DOUBLE' },

  // === NUMBER 11 ===
  '55-46-51-64': { value: 11, type: 'SINGLE_INNER' },
  '55-46-52-64': { value: 11, type: 'TRIPLE' },
  '55-46-53-64': { value: 11, type: 'SINGLE_OUTER' },
  '55-46-54-64': { value: 11, type: 'DOUBLE' },

  // === NUMBER 12 ===
  '53-46-48-64': { value: 12, type: 'SINGLE_INNER' },
  '53-46-51-64': { value: 12, type: 'TRIPLE' },
  '53-46-53-64': { value: 12, type: 'SINGLE_OUTER' },
  '53-46-54-64': { value: 12, type: 'DOUBLE' },

  // === NUMBER 13 ===
  '48-46-48-64': { value: 13, type: 'SINGLE_INNER' },
  '48-46-50-64': { value: 13, type: 'TRIPLE' },
  '48-46-52-64': { value: 13, type: 'SINGLE_OUTER' },
  '52-46-53-64': { value: 13, type: 'DOUBLE' },

  // === NUMBER 14 ===
  '49-48-46-51-64': { value: 14, type: 'SINGLE_INNER' },
  '49-48-46-52-64': { value: 14, type: 'TRIPLE' },
  '49-48-46-53-64': { value: 14, type: 'SINGLE_OUTER' },
  '49-48-46-54-64': { value: 14, type: 'DOUBLE' },

  // === NUMBER 15 ===
  '51-46-48-64': { value: 15, type: 'SINGLE_INNER' },
  '51-46-49-64': { value: 15, type: 'TRIPLE' },
  '51-46-50-64': { value: 15, type: 'SINGLE_OUTER' },
  '52-46-50-64': { value: 15, type: 'DOUBLE' },

  // === NUMBER 16 ===
  '49-49-46-48-64': { value: 16, type: 'SINGLE_INNER' },
  '49-49-46-51-64': { value: 16, type: 'TRIPLE' },
  '49-49-46-53-64': { value: 16, type: 'SINGLE_OUTER' },
  '49-49-46-54-64': { value: 16, type: 'DOUBLE' },

  // === NUMBER 17 ===
  '49-48-46-49-64': { value: 17, type: 'SINGLE_INNER' },
  '49-48-46-48-64': { value: 17, type: 'TRIPLE' },
  '49-48-46-50-64': { value: 17, type: 'SINGLE_OUTER' },
  '56-46-51-64': { value: 17, type: 'DOUBLE' },

  // === NUMBER 18 ===
  '49-46-50-64': { value: 18, type: 'SINGLE_INNER' },
  '49-46-52-64': { value: 18, type: 'TRIPLE' },
  '49-46-53-64': { value: 18, type: 'SINGLE_OUTER' },
  '49-46-54-64': { value: 18, type: 'DOUBLE' },

  // === NUMBER 19 ===
  '54-46-49-64': { value: 19, type: 'SINGLE_INNER' },
  '54-46-48-64': { value: 19, type: 'TRIPLE' },
  '54-46-51-64': { value: 19, type: 'SINGLE_OUTER' },
  '56-46-53-64': { value: 19, type: 'DOUBLE' },

  // === NUMBER 20 ===
  '51-46-51-64': { value: 20, type: 'SINGLE_INNER' },
  '51-46-52-64': { value: 20, type: 'TRIPLE' },
  '51-46-53-64': { value: 20, type: 'SINGLE_OUTER' },
  '51-46-54-64': { value: 20, type: 'DOUBLE' },

  // === BULLSEYE ===
  '56-46-48-64': { value: 25, type: 'BULL' },
  '52-46-48-64': { value: 25, type: 'DBL_BULL' },

  // === SPECIAL ===
  '66-84-78-64': { value: 0, type: 'RESET' },
  '79-85-84-64': { value: 0, type: 'MISS' },
};

class BLEConnection {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;  // Notify (receive throws)
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;  // Write (send LED commands)
  public isConnected: boolean = false;
  private onThrowCallbacks: ThrowCallback[] = [];
  private onStatusChangeCallbacks: StatusCallback[] = [];
  private dartCount: number = 0;
  private connectionTime: number = 0;  // For warmup period
  private readonly WARMUP_MS = 2000;   // Ignore events for 2 seconds after connection

  onThrow(callback: ThrowCallback): void {
    this.onThrowCallbacks.push(callback);
  }

  offThrow(callback: ThrowCallback): void {
    this.onThrowCallbacks = this.onThrowCallbacks.filter(cb => cb !== callback);
  }

  onStatusChange(callback: StatusCallback): void {
    this.onStatusChangeCallbacks.push(callback);
  }

  offStatusChange(callback: StatusCallback): void {
    this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter(cb => cb !== callback);
  }

  private notifyStatusChange(status: BLEStatus): void {
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  resetDartCount(): void {
    this.dartCount = 0;
  }

  async connect(): Promise<{ success: boolean; device?: BluetoothDevice; error?: string }> {
    try {
      if (!navigator.bluetooth) {
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
          error += '1. Use Chrome or Edge on Android/Windows/Mac\n';
          error += '2. iOS does NOT support Web Bluetooth\n';
          error += '3. Enable Web Bluetooth in chrome://flags if needed';
        }

        this.notifyStatusChange('error');
        return { success: false, error };
      }

      this.notifyStatusChange('scanning');

      try {
        this.device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
          optionalServices: [SERVICE_UUID]
        });
      } catch (deviceError) {
        this.device = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: 'GranBoard' }],
          optionalServices: [SERVICE_UUID]
        });
      }

      this.notifyStatusChange('connecting');

      if (!this.device.gatt) {
        throw new Error('Device does not support GATT');
      }

      this.server = await this.device.gatt.connect();
      this.service = await this.server.getPrimaryService(SERVICE_UUID);

      // Get all characteristics and log them for debugging
      const characteristics = await this.service.getCharacteristics();
      console.log('📋 Found characteristics:');
      characteristics.forEach(c => {
        console.log(`  - ${c.uuid}`);
        console.log(`    notify: ${c.properties.notify}, write: ${c.properties.write}, writeWithoutResponse: ${c.properties.writeWithoutResponse}`);
      });

      // Find the notify characteristic (for receiving dart throws)
      this.rxCharacteristic = characteristics.find(c => c.properties.notify) || null;

      // Find the write characteristic (for LED control)
      this.txCharacteristic = characteristics.find(
        c => c.properties.write || c.properties.writeWithoutResponse
      ) || null;

      if (!this.rxCharacteristic) {
        // Fallback to specific UUID
        this.rxCharacteristic = await this.service.getCharacteristic(RX_UUID);
      }

      // Try to get TX characteristic by UUID if not found
      if (!this.txCharacteristic) {
        try {
          this.txCharacteristic = await this.service.getCharacteristic(TX_UUID);
          console.log('✅ Found TX characteristic for LED control');
        } catch {
          console.log('⚠️ No TX characteristic found - LED control unavailable');
        }
      }

      await this.rxCharacteristic.startNotifications();

      this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleDartThrow(event);
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.dartCount = 0;
      this.connectionTime = Date.now();  // Start warmup timer
      this.notifyStatusChange('connected');

      console.log('✅ Connected to Granboard:', this.device.name);
      console.log(`⏳ Warmup period: ignoring events for ${this.WARMUP_MS}ms`);

      if (this.txCharacteristic) {
        console.log('💡 LED control available via TX characteristic');
      }

      return { success: true, device: this.device };

    } catch (error) {
      const err = error as Error;
      let errorMessage = err.message || 'Unknown error';

      if (err.name === 'NotFoundError') {
        errorMessage = `No Granboard device found.\n\nMake sure:\n- Board is powered on\n- Board is in pairing mode\n- Bluetooth is enabled`;
      } else if (err.name === 'SecurityError') {
        errorMessage = `Bluetooth access denied.\n\nThis app requires HTTPS and Bluetooth permissions.`;
      } else if (err.name === 'NotSupportedError') {
        errorMessage = `Web Bluetooth not supported.\n\nTry Chrome or Edge on Android/Windows/Mac.\niOS Safari does NOT support Web Bluetooth.`;
      } else if (err.name === 'NotAllowedError') {
        errorMessage = `Bluetooth permission denied.\n\nYou cancelled the pairing dialog.`;
      }

      console.error('❌ BLE Connection Error:', err);
      this.isConnected = false;
      this.notifyStatusChange('error');
      return { success: false, error: errorMessage };
    }
  }

  private handleDartThrow(event: Event): void {
    try {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const dataView = target.value;

      if (!dataView || dataView.byteLength < 4) {
        return;
      }

      // Check warmup period - ignore events in first 2 seconds after connection
      const timeSinceConnection = Date.now() - this.connectionTime;
      if (timeSinceConnection < this.WARMUP_MS) {
        console.log(`⏳ Ignoring event (${timeSinceConnection}ms after connection) - warming up`);
        return;
      }

      const bytes = new Uint8Array(dataView.buffer);
      const byteKey = Array.from(bytes).join('-');

      console.log('📡 Raw BLE bytes:', byteKey);

      // Skip init messages like "GB7;101"
      if (byteKey.startsWith('71-66-')) {
        console.log('📋 Init message, skipping');
        return;
      }

      const segmentInfo = SEGMENT_MAP[byteKey];

      if (!segmentInfo) {
        console.warn('⚠️ Unknown segment bytes:', byteKey);
        return;
      }

      // Handle reset button
      if (segmentInfo.type === 'RESET') {
        console.log('🔄 Reset button pressed');
        this.dartCount = 0;
        return;
      }

      // Handle miss/out
      if (segmentInfo.type === 'MISS') {
        console.log('❌ Miss/Out');
        this.dartCount++;
        const missThrow: DartThrowData = {
          segment: 'MISS',
          score: 0,
          multiplier: 0,
          baseValue: 0,
          segmentType: 'MISS',
          dartNum: this.dartCount,
          timestamp: new Date().toISOString(),
          device: this.device?.name || 'Granboard',
          rawBytes: byteKey
        };
        this.onThrowCallbacks.forEach(cb => cb(missThrow));
        if (this.dartCount >= 3) this.dartCount = 0;
        return;
      }

      let multiplier = 1;
      let segmentName = '';

      switch (segmentInfo.type) {
        case 'SINGLE_INNER':
        case 'SINGLE_OUTER':
          multiplier = 1;
          segmentName = `S${segmentInfo.value}`;
          break;
        case 'DOUBLE':
          multiplier = 2;
          segmentName = `D${segmentInfo.value}`;
          break;
        case 'TRIPLE':
          multiplier = 3;
          segmentName = `T${segmentInfo.value}`;
          break;
        case 'BULL':
          multiplier = 1;
          segmentName = 'BULL';
          break;
        case 'DBL_BULL':
          multiplier = 2;
          segmentName = 'DBL_BULL';
          break;
        default:
          segmentName = `${segmentInfo.value}`;
      }

      const score = segmentInfo.value * multiplier;
      this.dartCount++;

      const throwData: DartThrowData = {
        segment: segmentName,
        score: score,
        multiplier: multiplier,
        baseValue: segmentInfo.value,
        segmentType: segmentInfo.type,
        dartNum: this.dartCount,
        timestamp: new Date().toISOString(),
        device: this.device?.name || 'Granboard',
        rawBytes: byteKey
      };

      console.log('🎯 Dart throw:', throwData);

      this.onThrowCallbacks.forEach(cb => cb(throwData));

      if (this.dartCount >= 3) {
        this.dartCount = 0;
      }

    } catch (error) {
      console.error('❌ Error parsing dart throw:', error);
    }
  }

  private handleDisconnection(): void {
    console.log('📴 Granboard disconnected');
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.service = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.dartCount = 0;
    this.notifyStatusChange('disconnected');
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      await this.device.gatt.disconnect();
    }
    this.handleDisconnection();
  }

  // ============================================================================
  // LED CONTROL - EXPERIMENTAL
  // Note: Protocol for GB3s may differ from GB3. This is exploratory.
  // ============================================================================

  /**
   * Check if LED control is available
   */
  hasLEDControl(): boolean {
    return this.txCharacteristic !== null;
  }

  /**
   * Send raw bytes to the board (for LED control experimentation)
   * @param bytes - Raw byte array to send
   */
  async sendRawCommand(bytes: Uint8Array): Promise<boolean> {
    if (!this.txCharacteristic) {
      console.warn('❌ No TX characteristic - LED control unavailable');
      return false;
    }

    try {
      console.log('📤 Sending raw command:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      if (this.txCharacteristic.properties.writeWithoutResponse) {
        await this.txCharacteristic.writeValueWithoutResponse(bytes);
      } else {
        await this.txCharacteristic.writeValue(bytes);
      }
      
      console.log('✅ Command sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to send command:', error);
      return false;
    }
  }

  /**
   * EXPERIMENTAL: Light up specific segments
   * This uses a bitmap approach - may or may not work on your board
   * @param segments - Array of segment numbers to light (1-20, 25 for bull)
   */
  async setLEDs(segments: number[]): Promise<boolean> {
    if (!this.txCharacteristic) {
      console.warn('❌ LED control not available');
      return false;
    }

    // Create a 32-bit bitmap for segments 1-25
    let bitmap = 0;
    segments.forEach(segmentNum => {
      if (segmentNum >= 1 && segmentNum <= 25) {
        bitmap |= (1 << (segmentNum - 1));
      }
    });

    // Try different command formats - the correct one is unknown
    // Format 1: 'P' (0x50) + bitmap (little endian)
    const command = new Uint8Array([
      0x50, // Command byte 'P' for Pattern?
      (bitmap >> 0) & 0xFF,
      (bitmap >> 8) & 0xFF,
      (bitmap >> 16) & 0xFF,
      (bitmap >> 24) & 0xFF
    ]);

    console.log('💡 Attempting to set LEDs for segments:', segments);
    return this.sendRawCommand(command);
  }

  /**
   * EXPERIMENTAL: Turn off all LEDs
   */
  async clearLEDs(): Promise<boolean> {
    if (!this.txCharacteristic) {
      return false;
    }

    const command = new Uint8Array([0x50, 0x00, 0x00, 0x00, 0x00]);
    console.log('💡 Attempting to clear LEDs');
    return this.sendRawCommand(command);
  }

  /**
   * EXPERIMENTAL: Set LED color (if board supports RGB)
   * @param r - Red (0-255)
   * @param g - Green (0-255)
   * @param b - Blue (0-255)
   */
  async setLEDColor(r: number, g: number, b: number): Promise<boolean> {
    if (!this.txCharacteristic) {
      return false;
    }

    // Try common BLE LED color format
    const command = new Uint8Array([0x56, r, g, b, 0x00, 0xF0, 0xAA]);
    console.log(`💡 Attempting to set LED color: RGB(${r}, ${g}, ${b})`);
    return this.sendRawCommand(command);
  }

  // ============================================================================
  // SIMULATION & UTILITIES
  // ============================================================================

  simulateThrow(segment?: string, score?: number): DartThrowData {
    const segments = ['S1', 'S5', 'S20', 'T20', 'T19', 'D16', 'D20', 'BULL', 'DBL_BULL'];
    const randomSegment = segment || segments[Math.floor(Math.random() * segments.length)];

    let multiplier = 1;
    let baseValue = 20;
    let segmentType: SegmentType = 'SINGLE_INNER';

    if (randomSegment === 'BULL') {
      baseValue = 25; multiplier = 1; segmentType = 'BULL';
    } else if (randomSegment === 'DBL_BULL') {
      baseValue = 25; multiplier = 2; segmentType = 'DBL_BULL';
    } else if (randomSegment.startsWith('T')) {
      baseValue = parseInt(randomSegment.slice(1)); multiplier = 3; segmentType = 'TRIPLE';
    } else if (randomSegment.startsWith('D')) {
      baseValue = parseInt(randomSegment.slice(1)); multiplier = 2; segmentType = 'DOUBLE';
    } else if (randomSegment.startsWith('S')) {
      baseValue = parseInt(randomSegment.slice(1)); multiplier = 1; segmentType = 'SINGLE_INNER';
    }

    this.dartCount++;

    const testThrow: DartThrowData = {
      segment: randomSegment,
      score: score ?? (baseValue * multiplier),
      multiplier,
      baseValue,
      segmentType,
      dartNum: this.dartCount,
      timestamp: new Date().toISOString(),
      device: 'Simulated'
    };

    console.log('🧪 Simulated throw:', testThrow);
    this.onThrowCallbacks.forEach(cb => cb(testThrow));

    if (this.dartCount >= 3) this.dartCount = 0;

    return testThrow;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  getDeviceInfo(): { name: string; connected: boolean; hasLED: boolean } | null {
    if (!this.device) return null;
    return {
      name: this.device.name || 'Granboard',
      connected: this.isConnected,
      hasLED: this.txCharacteristic !== null
    };
  }
}

export const bleConnection = new BLEConnection();
export default bleConnection;