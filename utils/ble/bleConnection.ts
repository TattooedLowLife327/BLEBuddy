// utils/ble/bleConnection.ts
// BLE Dart Board Connection for LowLife BLE Buddy
// FIXED: Proper byte parsing and segment mapping for Granboard

const SERVICE_UUID = '442f1570-8a00-9a28-cbe1-e1d4212d53eb';
const RX_UUID = '442f1572-8a00-9a28-cbe1-e1d4212d53eb';

export type BLEStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

// Segment types for the dartboard
export type SegmentType = 'SINGLE_INNER' | 'SINGLE_OUTER' | 'DOUBLE' | 'TRIPLE' | 'BULL' | 'DBL_BULL' | 'MISS' | 'RESET';

export interface DartThrowData {
  segment: string;        // e.g., "T20", "D16", "S5", "BULL", "DBL_BULL"
  score: number;          // Calculated score (e.g., 60 for T20)
  multiplier: number;     // 1, 2, or 3
  baseValue: number;      // The number hit (1-20, 25 for bull)
  segmentType: SegmentType;
  dartNum: number;
  timestamp: string;
  device?: string;
  rawBytes?: string;      // For debugging
  coordinates?: { x: number; y: number };
}

export type ThrowCallback = (throwData: DartThrowData) => void;
export type StatusCallback = (status: BLEStatus) => void;

// ============================================================================
// GRANBOARD SEGMENT MAP - All 82 segments
// Format: 'byte1-byte2-byte3-byte4' -> { value, type }
// ============================================================================
interface SegmentInfo {
  value: number;      // 1-20 or 25 for bull
  type: SegmentType;
}

const SEGMENT_MAP: Record<string, SegmentInfo> = {
  // === NUMBER 1 ===
  '50-46-51-64': { value: 1, type: 'SINGLE_INNER' },
  '51-46-51-64': { value: 1, type: 'TRIPLE' },
  '52-46-51-64': { value: 1, type: 'SINGLE_OUTER' },
  '53-46-51-64': { value: 1, type: 'DOUBLE' },

  // === NUMBER 2 ===
  '50-46-50-64': { value: 2, type: 'SINGLE_INNER' },
  '51-46-50-64': { value: 2, type: 'TRIPLE' },
  '52-46-50-64': { value: 2, type: 'SINGLE_OUTER' },
  '53-46-50-64': { value: 2, type: 'DOUBLE' },

  // === NUMBER 3 ===
  '50-46-52-64': { value: 3, type: 'SINGLE_INNER' },
  '51-46-52-64': { value: 3, type: 'TRIPLE' },
  '52-46-52-64': { value: 3, type: 'SINGLE_OUTER' },
  '53-46-52-64': { value: 3, type: 'DOUBLE' },

  // === NUMBER 4 ===
  '50-46-53-64': { value: 4, type: 'SINGLE_INNER' },
  '51-46-53-64': { value: 4, type: 'TRIPLE' },
  '52-46-53-64': { value: 4, type: 'SINGLE_OUTER' },
  '53-46-53-64': { value: 4, type: 'DOUBLE' },

  // === NUMBER 5 ===
  '50-46-54-64': { value: 5, type: 'SINGLE_INNER' },
  '51-46-54-64': { value: 5, type: 'TRIPLE' },
  '52-46-54-64': { value: 5, type: 'SINGLE_OUTER' },
  '53-46-54-64': { value: 5, type: 'DOUBLE' },

  // === NUMBER 6 ===
  '50-46-55-64': { value: 6, type: 'SINGLE_INNER' },
  '51-46-55-64': { value: 6, type: 'TRIPLE' },
  '52-46-55-64': { value: 6, type: 'SINGLE_OUTER' },
  '53-46-55-64': { value: 6, type: 'DOUBLE' },

  // === NUMBER 7 ===
  '50-46-56-64': { value: 7, type: 'SINGLE_INNER' },
  '51-46-56-64': { value: 7, type: 'TRIPLE' },
  '52-46-56-64': { value: 7, type: 'SINGLE_OUTER' },
  '53-46-56-64': { value: 7, type: 'DOUBLE' },

  // === NUMBER 8 ===
  '50-46-57-64': { value: 8, type: 'SINGLE_INNER' },
  '51-46-57-64': { value: 8, type: 'TRIPLE' },
  '52-46-57-64': { value: 8, type: 'SINGLE_OUTER' },
  '53-46-57-64': { value: 8, type: 'DOUBLE' },

  // === NUMBER 9 ===
  '50-46-58-64': { value: 9, type: 'SINGLE_INNER' },
  '51-46-58-64': { value: 9, type: 'TRIPLE' },
  '52-46-58-64': { value: 9, type: 'SINGLE_OUTER' },
  '53-46-58-64': { value: 9, type: 'DOUBLE' },

  // === NUMBER 10 ===
  '50-49-48-64': { value: 10, type: 'SINGLE_INNER' },
  '51-49-48-64': { value: 10, type: 'TRIPLE' },
  '52-49-48-64': { value: 10, type: 'SINGLE_OUTER' },
  '53-49-48-64': { value: 10, type: 'DOUBLE' },

  // === NUMBER 11 ===
  '50-49-49-64': { value: 11, type: 'SINGLE_INNER' },
  '51-49-49-64': { value: 11, type: 'TRIPLE' },
  '52-49-49-64': { value: 11, type: 'SINGLE_OUTER' },
  '53-49-49-64': { value: 11, type: 'DOUBLE' },

  // === NUMBER 12 ===
  '50-49-50-64': { value: 12, type: 'SINGLE_INNER' },
  '51-49-50-64': { value: 12, type: 'TRIPLE' },
  '52-49-50-64': { value: 12, type: 'SINGLE_OUTER' },
  '53-49-50-64': { value: 12, type: 'DOUBLE' },

  // === NUMBER 13 ===
  '50-49-51-64': { value: 13, type: 'SINGLE_INNER' },
  '51-49-51-64': { value: 13, type: 'TRIPLE' },
  '52-49-51-64': { value: 13, type: 'SINGLE_OUTER' },
  '53-49-51-64': { value: 13, type: 'DOUBLE' },

  // === NUMBER 14 ===
  '50-49-52-64': { value: 14, type: 'SINGLE_INNER' },
  '51-49-52-64': { value: 14, type: 'TRIPLE' },
  '52-49-52-64': { value: 14, type: 'SINGLE_OUTER' },
  '53-49-52-64': { value: 14, type: 'DOUBLE' },

  // === NUMBER 15 ===
  '50-49-53-64': { value: 15, type: 'SINGLE_INNER' },
  '51-49-53-64': { value: 15, type: 'TRIPLE' },
  '52-49-53-64': { value: 15, type: 'SINGLE_OUTER' },
  '53-49-53-64': { value: 15, type: 'DOUBLE' },

  // === NUMBER 16 ===
  '50-49-54-64': { value: 16, type: 'SINGLE_INNER' },
  '51-49-54-64': { value: 16, type: 'TRIPLE' },
  '52-49-54-64': { value: 16, type: 'SINGLE_OUTER' },
  '53-49-54-64': { value: 16, type: 'DOUBLE' },

  // === NUMBER 17 ===
  '50-49-55-64': { value: 17, type: 'SINGLE_INNER' },
  '51-49-55-64': { value: 17, type: 'TRIPLE' },
  '52-49-55-64': { value: 17, type: 'SINGLE_OUTER' },
  '53-49-55-64': { value: 17, type: 'DOUBLE' },

  // === NUMBER 18 ===
  '50-49-56-64': { value: 18, type: 'SINGLE_INNER' },
  '51-49-56-64': { value: 18, type: 'TRIPLE' },
  '52-49-56-64': { value: 18, type: 'SINGLE_OUTER' },
  '53-49-56-64': { value: 18, type: 'DOUBLE' },

  // === NUMBER 19 ===
  '50-49-57-64': { value: 19, type: 'SINGLE_INNER' },
  '51-49-57-64': { value: 19, type: 'TRIPLE' },
  '52-49-57-64': { value: 19, type: 'SINGLE_OUTER' },
  '53-49-57-64': { value: 19, type: 'DOUBLE' },

  // === NUMBER 20 ===
  '50-50-48-64': { value: 20, type: 'SINGLE_INNER' },
  '51-50-48-64': { value: 20, type: 'TRIPLE' },
  '52-50-48-64': { value: 20, type: 'SINGLE_OUTER' },
  '53-50-48-64': { value: 20, type: 'DOUBLE' },

  // === BULLSEYE ===
  '56-46-48-64': { value: 25, type: 'BULL' },
  '52-46-48-64': { value: 25, type: 'DBL_BULL' },

  // === SPECIAL ===
  '66-84-78-64': { value: 0, type: 'RESET' },
};

class BLEConnection {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  public isConnected: boolean = false;
  private onThrowCallbacks: ThrowCallback[] = [];
  private onStatusChangeCallbacks: StatusCallback[] = [];
  private dartCount: number = 0;

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

      const characteristics = await this.service.getCharacteristics();
      this.characteristic = characteristics.find(c => c.properties.notify) || null;

      if (!this.characteristic) {
        this.characteristic = await this.service.getCharacteristic(RX_UUID);
      }

      await this.characteristic.startNotifications();

      this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleDartThrow(event);
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleDisconnection();
      });

      this.isConnected = true;
      this.dartCount = 0;
      this.notifyStatusChange('connected');

      console.log('✅ Connected to Granboard:', this.device.name);

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

  // FIXED: Proper byte parsing for Granboard
  private handleDartThrow(event: Event): void {
    try {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const dataView = target.value;

      if (!dataView || dataView.byteLength < 4) {
        console.warn('⚠️ Invalid BLE data received:', dataView);
        return;
      }

      const bytes = new Uint8Array(dataView.buffer);
      const byteKey = Array.from(bytes).join('-');

      console.log('📡 Raw BLE bytes:', byteKey, '| Hex:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));

      const segmentInfo = SEGMENT_MAP[byteKey];

      if (!segmentInfo) {
        console.warn('⚠️ Unknown segment bytes:', byteKey);
        const unknownThrow: DartThrowData = {
          segment: 'UNKNOWN',
          score: 0,
          multiplier: 1,
          baseValue: 0,
          segmentType: 'MISS',
          dartNum: this.dartCount + 1,
          timestamp: new Date().toISOString(),
          device: this.device?.name || 'Granboard',
          rawBytes: byteKey
        };
        this.onThrowCallbacks.forEach(cb => cb(unknownThrow));
        return;
      }

      if (segmentInfo.type === 'RESET') {
        console.log('🔄 Reset button pressed');
        this.dartCount = 0;
        return;
      }

      let multiplier = 1;
      let segmentName = '';

      switch (segmentInfo.type) {
        case 'SINGLE_INNER':
        case 'SINGLE_OUTER':
          multiplier = 1;
          segmentName = segmentInfo.value === 25 ? 'BULL' : `S${segmentInfo.value}`;
          break;
        case 'DOUBLE':
          multiplier = 2;
          segmentName = segmentInfo.value === 25 ? 'DBL_BULL' : `D${segmentInfo.value}`;
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
    this.characteristic = null;
    this.dartCount = 0;
    this.notifyStatusChange('disconnected');
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      await this.device.gatt.disconnect();
    }
    this.handleDisconnection();
  }

  simulateThrow(segment?: string, score?: number): DartThrowData {
    const segments = ['S1', 'S5', 'S20', 'T20', 'T19', 'D16', 'D20', 'BULL', 'DBL_BULL'];
    const randomSegment = segment || segments[Math.floor(Math.random() * segments.length)];

    let multiplier = 1;
    let baseValue = 20;
    let segmentType: SegmentType = 'SINGLE_INNER';

    if (randomSegment === 'BULL') {
      baseValue = 25;
      multiplier = 1;
      segmentType = 'BULL';
    } else if (randomSegment === 'DBL_BULL') {
      baseValue = 25;
      multiplier = 2;
      segmentType = 'DBL_BULL';
    } else if (randomSegment.startsWith('T')) {
      baseValue = parseInt(randomSegment.slice(1));
      multiplier = 3;
      segmentType = 'TRIPLE';
    } else if (randomSegment.startsWith('D')) {
      baseValue = parseInt(randomSegment.slice(1));
      multiplier = 2;
      segmentType = 'DOUBLE';
    } else if (randomSegment.startsWith('S')) {
      baseValue = parseInt(randomSegment.slice(1));
      multiplier = 1;
      segmentType = 'SINGLE_INNER';
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

    if (this.dartCount >= 3) {
      this.dartCount = 0;
    }

    return testThrow;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  getDeviceInfo(): { name: string; connected: boolean } | null {
    if (!this.device) return null;
    return {
      name: this.device.name || 'Granboard',
      connected: this.isConnected
    };
  }
}

export const bleConnection = new BLEConnection();
export default bleConnection;