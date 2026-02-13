// utils/ble/bleConnection.ts
// BLE Dart Board Connection for LowLife BLE Buddy
// Using ACTUAL Granboard segment mapping from granboard2-app-by-JW

const SERVICE_UUID = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
// Per GranBoard-with-Autodarts MITM analysis: 1571=notify, 1572=write
const RX_UUID = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';  // Notify (board -> app) - dart throws
const TX_UUID = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';  // Write (app -> board) - LED control

// ============================================================================
// LED PROTOCOL CONSTANTS
// Source: GranBoard-with-Autodarts reverse engineering (Lennart-Jerome)
// ============================================================================

// Segment number (1-20) → internal target ID for hit effects (bytes [10-11] LE)
const SEGMENT_TARGET_ID: Record<number, number> = {
   1: 0x001C,   2: 0x0031,   3: 0x0037,   4: 0x0022,   5: 0x0016,
   6: 0x0028,   7: 0x0001,   8: 0x0007,   9: 0x0010,  10: 0x002B,
  11: 0x000A,  12: 0x0013,  13: 0x0025,  14: 0x000D,  15: 0x002E,
  16: 0x0004,  17: 0x0034,  18: 0x001F,  19: 0x003A,  20: 0x0019
};

// LED effect opcodes (16-byte frames)
const LED_EFFECT = {
  HIT_SINGLE:    0x01,  // Single segment hit (needs target ID + 2 colors)
  HIT_DOUBLE:    0x02,  // Double segment hit
  HIT_TRIPLE:    0x03,  // Triple segment hit
  TOUCH_RAINBOW: 0x0C,  // Rainbow on touch (no color params)
  EVENT:         0x0D,  // Ring + touch combined (no color params)
  RAINBOW:       0x0F,  // 3-segment rainbow rotation (no color params)
  SPLIT_RAINBOW: 0x10,  // Split rainbow (no color params)
  NEXT:          0x11,  // Two-color segment transition (2 colors)
  PULSE:         0x14,  // Pulsing glow (1 color, byte[4]=0x7D)
  DARK_SOLID:    0x15,  // Low-brightness solid (1 color)
  COLOR_CYCLE:   0x16,  // Auto color cycle (no color params)
  FLASH:         0x17,  // Flashing/blink (1 color)
  FLICKER:       0x18,  // Candle flicker (1 color)
  HUNT_FLICKER:  0x19,  // Pattern flicker (no color params)
  SHAKE:         0x1B,  // Shaking vibrate (1 color)
  FADE:          0x1D,  // Sweeping fade (1 color)
  BULL_FADE:     0x1F,  // 3-color fade from bull outward (3 colors)
} as const;

// Static ring palette codes (20-byte frames, 1 byte per segment)
const LED_PALETTE = {
  OFF:         0x00,
  RED:         0x01,
  ORANGE:      0x02,
  YELLOW:      0x03,
  LIGHT_GREEN: 0x04,
  CYAN:        0x05,
  PURPLE:      0x06,
  WHITE:       0x07,
} as const;

export type BLEStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';
export type SegmentType = 'SINGLE_INNER' | 'SINGLE_OUTER' | 'DOUBLE' | 'TRIPLE' | 'BULL' | 'DBL_BULL' | 'MISS' | 'RESET' | 'BUTTON';

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
  '42-54-4E-40': { value: 0, type: 'BUTTON' },
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
  private readonly STORAGE_KEY = 'bb_last_ble_device';
  private autoReconnectEnabled: boolean = true;  // Auto-reconnect on disconnect
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private onConnectCallbacks: (() => void)[] = [];  // Called when connection starts (for camera check)

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

  /**
   * Register a callback to be called when connection process starts
   * Use this for silent camera checks during pairing
   */
  onConnect(callback: () => void): void {
    this.onConnectCallbacks.push(callback);
  }

  offConnect(callback: () => void): void {
    this.onConnectCallbacks = this.onConnectCallbacks.filter(cb => cb !== callback);
  }

  private notifyConnect(): void {
    this.onConnectCallbacks.forEach(cb => cb());
  }

  private notifyStatusChange(status: BLEStatus): void {
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  /**
   * Enable or disable auto-reconnect on disconnection
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
  }

  resetDartCount(): void {
    this.dartCount = 0;
  }

  /**
   * Check if we can auto-reconnect to a previously paired device
   */
  async canAutoReconnect(): Promise<boolean> {
    if (!navigator.bluetooth || !('getDevices' in navigator.bluetooth)) {
      return false;
    }
    const savedName = localStorage.getItem(this.STORAGE_KEY);
    if (!savedName) return false;

    try {
      const devices = await (navigator.bluetooth as any).getDevices();
      return devices.some((d: BluetoothDevice) => d.name === savedName);
    } catch {
      return false;
    }
  }

  /**
   * Get the name of the last connected device (for UI display)
   */
  getLastDeviceName(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Attempt to reconnect to a previously paired device without user prompt
   */
  async autoReconnect(): Promise<{ success: boolean; device?: BluetoothDevice; error?: string }> {
    if (!navigator.bluetooth || !('getDevices' in navigator.bluetooth)) {
      return { success: false, error: 'Auto-reconnect not supported in this browser' };
    }

    const savedName = localStorage.getItem(this.STORAGE_KEY);
    if (!savedName) {
      return { success: false, error: 'No previously connected device' };
    }

    try {
      this.notifyStatusChange('connecting');
      console.log(`🔄 Attempting auto-reconnect to: ${savedName}`);

      const devices = await (navigator.bluetooth as any).getDevices();
      const device = devices.find((d: BluetoothDevice) => d.name === savedName);

      if (!device) {
        this.notifyStatusChange('disconnected');
        return { success: false, error: `Device "${savedName}" not found. Try manual connect.` };
      }

      this.device = device;

      // Set up disconnect listener
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      // Connect to GATT server
      if (!this.device.gatt) {
        throw new Error('Device does not support GATT');
      }

      this.server = await this.device.gatt.connect();
      return this.setupCharacteristics();

    } catch (error) {
      const err = error as Error;
      console.error('❌ Auto-reconnect failed:', err);
      this.notifyStatusChange('disconnected');
      return { success: false, error: `Auto-reconnect failed: ${err.message}` };
    }
  }

  /**
   * Setup characteristics after GATT connection (shared between connect and autoReconnect)
   */
  private async setupCharacteristics(): Promise<{ success: boolean; device?: BluetoothDevice; error?: string }> {
    try {
      this.service = await this.server!.getPrimaryService(SERVICE_UUID);

      const characteristics = await this.service.getCharacteristics();
      console.log('📋 Found characteristics:');
      characteristics.forEach(c => {
        console.log(`  - ${c.uuid}`);
        console.log(`    notify: ${c.properties.notify}, write: ${c.properties.write}`);
      });

      this.rxCharacteristic = characteristics.find(c => c.properties.notify) || null;
      this.txCharacteristic = characteristics.find(
        c => c.properties.write || c.properties.writeWithoutResponse
      ) || null;

      if (!this.rxCharacteristic) {
        this.rxCharacteristic = await this.service.getCharacteristic(RX_UUID);
      }

      if (!this.txCharacteristic) {
        try {
          this.txCharacteristic = await this.service.getCharacteristic(TX_UUID);
        } catch {
          console.log('⚠️ No TX characteristic - LED control unavailable');
        }
      }

      await this.rxCharacteristic.startNotifications();

      this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleDartThrow(event);
      });

      this.isConnected = true;
      this.dartCount = 0;
      this.connectionTime = Date.now();
      this.reconnectAttempts = 0;  // Reset reconnect attempts on successful connection
      this.notifyStatusChange('connected');

      // Save device name for auto-reconnect
      if (this.device?.name) {
        localStorage.setItem(this.STORAGE_KEY, this.device.name);
      }

      console.log('✅ Connected to Granboard:', this.device?.name);

      return { success: true, device: this.device! };

    } catch (error) {
      const err = error as Error;
      console.error('❌ Setup failed:', err);
      this.isConnected = false;
      this.notifyStatusChange('error');
      return { success: false, error: err.message };
    }
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

      // Notify that connection process is starting (for silent camera check)
      this.notifyConnect();

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

      // Set up disconnect listener
      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      this.notifyStatusChange('connecting');

      if (!this.device.gatt) {
        throw new Error('Device does not support GATT');
      }

      this.server = await this.device.gatt.connect();
      return this.setupCharacteristics();

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

      if (segmentInfo.type === 'BUTTON') {
        console.log('🔘 Board button pressed');
        const buttonEvent: DartThrowData = {
          segment: 'BTN',
          score: 0,
          multiplier: 0,
          baseValue: 0,
          segmentType: 'BUTTON',
          dartNum: this.dartCount,
          timestamp: new Date().toISOString(),
          device: this.device?.name || 'Granboard',
          rawBytes: byteKey
        };
        this.onThrowCallbacks.forEach(cb => cb(buttonEvent));
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
    this.server = null;
    this.service = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.dartCount = 0;
    this.notifyStatusChange('disconnected');

    // Attempt auto-reconnect if enabled and we have a saved device
    if (this.autoReconnectEnabled && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      const savedName = localStorage.getItem(this.STORAGE_KEY);
      if (savedName) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * this.reconnectAttempts, 5000); // 1s, 2s, 3s max 5s
        console.log(`🔄 Auto-reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);

        this.reconnectTimeout = setTimeout(async () => {
          this.reconnectTimeout = null;
          const result = await this.autoReconnect();
          if (result.success) {
            console.log('✅ Auto-reconnect successful');
            this.reconnectAttempts = 0; // Reset on success
          } else {
            console.log('❌ Auto-reconnect failed:', result.error);
            // If still disconnected, schedule next attempt (up to MAX_RECONNECT_ATTEMPTS total)
            if (!this.isConnected && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
              this.handleDisconnection();
            } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
              console.log('❌ Max auto-reconnect attempts reached. Manual reconnection required.');
              this.reconnectAttempts = 0;
              this.device = null;
            }
          }
        }, delay);
      }
    } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('❌ Max auto-reconnect attempts reached. Manual reconnection required.');
      this.reconnectAttempts = 0;
      this.device = null;
    }
  }

  async disconnect(): Promise<void> {
    // Disable auto-reconnect for intentional disconnection
    this.autoReconnectEnabled = false;

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;

    if (this.device?.gatt?.connected) {
      await this.device.gatt.disconnect();
    }

    // Reset auto-reconnect after intentional disconnect (for next session)
    this.device = null;
    this.isConnected = false;
    this.server = null;
    this.service = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.dartCount = 0;
    this.notifyStatusChange('disconnected');

    // Re-enable auto-reconnect for future connections
    this.autoReconnectEnabled = true;
  }

  // ============================================================================
  // LED CONTROL
  // Protocol from GranBoard-with-Autodarts reverse engineering (Lennart-Jerome)
  // Two frame types: 16-byte effect frames, 20-byte static ring frames
  // ============================================================================

  hasLEDControl(): boolean {
    return this.txCharacteristic !== null;
  }

  /**
   * Send raw bytes to the board via TX (write) characteristic
   */
  async sendRawCommand(bytes: Uint8Array): Promise<boolean> {
    if (!this.txCharacteristic) {
      console.warn('❌ No TX characteristic - LED control unavailable');
      return false;
    }

    try {
      console.log('📤 TX:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      if (this.txCharacteristic.properties.writeWithoutResponse) {
        await this.txCharacteristic.writeValueWithoutResponse(bytes);
      } else {
        await this.txCharacteristic.writeValue(bytes);
      }

      return true;
    } catch (error) {
      console.error('❌ TX failed:', error);
      return false;
    }
  }

  private hexToRGB(hexColor: string): { r: number; g: number; b: number } {
    const hex = hexColor.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  /**
   * Build a 16-byte LED effect frame
   * Layout: [opcode, R1,G1,B1, R2,G2,B2, R3,G3,B3, targetLo,targetHi, speed, 0,0, 0x01]
   */
  private buildEffectFrame(
    opcode: number,
    colorA?: { r: number; g: number; b: number },
    colorB?: { r: number; g: number; b: number },
    colorC?: { r: number; g: number; b: number },
    targetId?: number,
    speed: number = 10
  ): Uint8Array {
    const frame = new Uint8Array(16);
    frame[0] = opcode & 0xFF;
    if (colorA) { frame[1] = colorA.r; frame[2] = colorA.g; frame[3] = colorA.b; }
    if (colorB) { frame[4] = colorB.r; frame[5] = colorB.g; frame[6] = colorB.b; }
    if (colorC) { frame[7] = colorC.r; frame[8] = colorC.g; frame[9] = colorC.b; }
    if (targetId !== undefined) {
      frame[10] = targetId & 0xFF;
      frame[11] = (targetId >> 8) & 0xFF;
    }
    frame[12] = speed & 0xFF;
    frame[15] = 0x01;  // Frame terminator - always 0x01
    return frame;
  }

  /**
   * Trigger LED effect on the whole board with player color
   * This is the main method called on dart throws
   * @param profileColor - Hex color (e.g., '5b21b6')
   * @param animationType - pulse, flash, rainbow, shake, fade, flicker, color_cycle
   * @param speed - 0 (fastest) to 35 (slowest), default 10
   */
  async triggerDartLED(profileColor: string, animationType: string = 'pulse', speed: number = 10): Promise<boolean> {
    if (!this.txCharacteristic) {
      console.warn('❌ LED control not available');
      return false;
    }

    try {
      const color = this.hexToRGB(profileColor);
      let frame: Uint8Array;

      switch (animationType.toLowerCase()) {
        case 'pulse':
          frame = this.buildEffectFrame(LED_EFFECT.PULSE, color, undefined, undefined, undefined, speed);
          frame[4] = 0x7D;  // Brightness accent parameter for pulse
          break;
        case 'flash':
          frame = this.buildEffectFrame(LED_EFFECT.FLASH, color, undefined, undefined, undefined, speed);
          break;
        case 'shake':
          frame = this.buildEffectFrame(LED_EFFECT.SHAKE, color, undefined, undefined, undefined, speed);
          break;
        case 'fade':
          frame = this.buildEffectFrame(LED_EFFECT.FADE, color, undefined, undefined, undefined, speed);
          break;
        case 'flicker':
          frame = this.buildEffectFrame(LED_EFFECT.FLICKER, color, undefined, undefined, undefined, speed);
          break;
        case 'solid':
          frame = this.buildEffectFrame(LED_EFFECT.DARK_SOLID, color, undefined, undefined, undefined, speed);
          break;
        case 'rainbow':
          frame = this.buildEffectFrame(LED_EFFECT.RAINBOW, undefined, undefined, undefined, undefined, speed);
          break;
        case 'split_rainbow':
          frame = this.buildEffectFrame(LED_EFFECT.SPLIT_RAINBOW, undefined, undefined, undefined, undefined, speed);
          break;
        case 'color_cycle':
          frame = this.buildEffectFrame(LED_EFFECT.COLOR_CYCLE, undefined, undefined, undefined, undefined, speed);
          break;
        default:
          frame = this.buildEffectFrame(LED_EFFECT.PULSE, color, undefined, undefined, undefined, speed);
          frame[4] = 0x7D;
          break;
      }

      console.log(`💡 LED effect: ${animationType}, color=${profileColor}, speed=${speed}`);
      return this.sendRawCommand(frame);
    } catch (error) {
      console.error('❌ Error triggering LED:', error);
      return false;
    }
  }

  /**
   * Trigger a hit-specific LED effect on a particular segment
   * @param segmentNumber - Board segment 1-20
   * @param hitType - 'single', 'double', or 'triple'
   * @param colorA - Primary hit color hex
   * @param colorB - Secondary hit color hex (optional, defaults to white)
   * @param speed - 0x00 (fast) to 0xFF (slow), default 0x14
   */
  async triggerHitLED(
    segmentNumber: number,
    hitType: 'single' | 'double' | 'triple' = 'single',
    colorA: string = 'ff0000',
    colorB: string = 'ffffff',
    speed: number = 0x14
  ): Promise<boolean> {
    if (!this.txCharacteristic) return false;

    const targetId = SEGMENT_TARGET_ID[segmentNumber];
    if (targetId === undefined) {
      console.warn(`❌ Unknown segment number: ${segmentNumber}`);
      return false;
    }

    const opcode = hitType === 'triple' ? LED_EFFECT.HIT_TRIPLE
                 : hitType === 'double' ? LED_EFFECT.HIT_DOUBLE
                 : LED_EFFECT.HIT_SINGLE;

    const frame = this.buildEffectFrame(
      opcode,
      this.hexToRGB(colorA),
      this.hexToRGB(colorB),
      undefined,
      targetId,
      speed
    );

    console.log(`💡 Hit LED: segment=${segmentNumber}, type=${hitType}, target=0x${targetId.toString(16)}`);
    return this.sendRawCommand(frame);
  }

  /**
   * Two-color transition effect (NEXT - opcode 0x11)
   */
  async triggerTwoColorEffect(colorA: string, colorB: string, speed: number = 7): Promise<boolean> {
    if (!this.txCharacteristic) return false;
    const frame = this.buildEffectFrame(
      LED_EFFECT.NEXT,
      this.hexToRGB(colorA),
      this.hexToRGB(colorB),
      undefined,
      0x0010,  // Fixed target for NEXT effect
      speed
    );
    return this.sendRawCommand(frame);
  }

  /**
   * Three-color bull fade effect (opcode 0x1F)
   */
  async triggerBullFade(colorA: string, colorB: string, colorC: string, speed: number = 12): Promise<boolean> {
    if (!this.txCharacteristic) return false;
    const frame = this.buildEffectFrame(
      LED_EFFECT.BULL_FADE,
      this.hexToRGB(colorA),
      this.hexToRGB(colorB),
      this.hexToRGB(colorC),
      undefined,
      speed
    );
    return this.sendRawCommand(frame);
  }

  /**
   * Set static colors on each of the 20 ring segments using palette codes
   * @param colors - Array of 20 palette codes (0x00=off, 0x01=red, 0x02=orange,
   *                 0x03=yellow, 0x04=green, 0x05=cyan, 0x06=purple, 0x07=white)
   */
  async setRingColors(colors: number[]): Promise<boolean> {
    if (!this.txCharacteristic) return false;
    const frame = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
      frame[i] = (colors[i] ?? 0x00) & 0xFF;
    }
    console.log('💡 Ring colors:', Array.from(frame).map(b => b.toString(16)).join(' '));
    return this.sendRawCommand(frame);
  }

  /**
   * Light up a single segment with a palette color (all others off)
   */
  async highlightSegment(segmentIndex: number, paletteColor: number = LED_PALETTE.RED): Promise<boolean> {
    const colors = new Array(20).fill(LED_PALETTE.OFF);
    if (segmentIndex >= 0 && segmentIndex < 20) {
      colors[segmentIndex] = paletteColor;
    }
    return this.setRingColors(colors);
  }

  /**
   * Turn off all LEDs - sends 20-byte ring frame of all zeros
   */
  async clearLEDs(): Promise<boolean> {
    if (!this.txCharacteristic) return false;
    console.log('💡 Clearing all LEDs');
    return this.sendRawCommand(new Uint8Array(20));
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
export { LED_EFFECT, LED_PALETTE, SEGMENT_TARGET_ID };
(window as any).bleConnection = bleConnection;
