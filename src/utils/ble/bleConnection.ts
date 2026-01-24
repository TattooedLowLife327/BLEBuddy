// utils/ble/bleConnection.ts
// BLE Dart Board Connection for LowLife BLE Buddy
// Using ACTUAL Granboard segment mapping from granboard2-app-by-JW

const SERVICE_UUID = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const RX_UUID = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';  // Notify (board -> app)
const TX_UUID = '442f1571-8a00-9a28-cbe1-e1d4212d53eb';  // Write (app -> board) - for LED control

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
   * Convert hex color string to RGB values
   * @param hexColor - Color in format '#RRGGBB' or 'RRGGBB'
   * @returns Object with r, g, b values (0-255)
   */
  private hexToRGB(hexColor: string): { r: number; g: number; b: number } {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
  }

  /**
   * Trigger LED animation with player color
   * Sends custom LED animation to board based on player's profile color
   * @param profileColor - Player's profile color in hex format (e.g., '5b21b6' from player.profilecolor)
   * @param animationType - Type of animation (pulse, wave, spin, rainbow, flash)
   */
  async triggerDartLED(profileColor: string, animationType: string = 'pulse'): Promise<boolean> {
    if (!this.txCharacteristic) {
      console.warn('❌ LED control not available');
      return false;
    }

    try {
      const { r, g, b } = this.hexToRGB(profileColor);
      
      // Map animation types to Granboard hex codes from reverse engineering
      let animationCode = '14'; // Default: pulse
      
      switch (animationType.toLowerCase()) {
        case 'wave':
          animationCode = '11111'; // Yellow wave
          break;
        case 'spin':
          animationCode = '21'; // Red spin
          break;
        case 'rainbow':
          animationCode = '10'; // Rainbow spin
          break;
        case 'flash':
          animationCode = '1b'; // White shake (fast flash)
          break;
        case 'pulse':
        default:
          animationCode = '14'; // Pulse
          break;
      }

      // Build command: animation code + RGB values
      const commandStr = animationCode;
      const bytes = new Uint8Array(commandStr.length / 2 + 3);
      
      // Convert hex string to bytes
      for (let i = 0; i < commandStr.length; i += 2) {
        bytes[i / 2] = parseInt(commandStr.substr(i, 2), 16);
      }
      
      // Append RGB values
      bytes[bytes.length - 3] = r;
      bytes[bytes.length - 2] = g;
      bytes[bytes.length - 1] = b;

      console.log(`💡 Triggering dart LED: color=${profileColor}, animation=${animationType}, RGB(${r},${g},${b})`);
      return this.sendRawCommand(bytes);
    } catch (error) {
      console.error('❌ Error triggering dart LED:', error);
      return false;
    }
  }

  /**
   * Turn off all LEDs
   */
  async clearLEDs(): Promise<boolean> {
    if (!this.txCharacteristic) {
      return false;
    }

    const command = new Uint8Array([0x50, 0x00, 0x00, 0x00, 0x00]);
    console.log('💡 Clearing all LEDs');
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
(window as any).bleConnection = bleConnection;
