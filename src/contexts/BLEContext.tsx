// contexts/BLEContext.tsx
// BLE Context Provider for app-wide BLE state management

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import bleConnection, { BLEStatus, DartThrowData } from '../utils/ble/bleConnection';

interface BLEContextType {
  status: BLEStatus;
  isConnected: boolean;
  deviceName: string | null;
  lastThrow: DartThrowData | null;
  connect: () => Promise<{ success: boolean; error?: string }>;
  autoReconnect: () => Promise<{ success: boolean; error?: string }>;
  canAutoReconnect: boolean;
  lastDeviceName: string | null;
  disconnect: () => Promise<void>;
  simulateThrow: (segment?: string, score?: number) => DartThrowData;
  clearLEDs: () => Promise<boolean>;
  isSupported: boolean;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);

interface BLEProviderProps {
  children: ReactNode;
}

export function BLEProvider({ children }: BLEProviderProps) {
  const [status, setStatus] = useState<BLEStatus>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastThrow, setLastThrow] = useState<DartThrowData | null>(null);
  const [isSupported] = useState((bleConnection.constructor as any).isSupported());
  const [canAutoReconnect, setCanAutoReconnect] = useState(false);
  const [lastDeviceName] = useState<string | null>(bleConnection.getLastDeviceName());

  // Check if auto-reconnect is available on mount and auto-reconnect if possible
  useEffect(() => {
    const checkAndAutoReconnect = async () => {
      const canReconnect = await bleConnection.canAutoReconnect();
      setCanAutoReconnect(canReconnect);

      // Auto-reconnect if we have a saved device and aren't already connected
      if (canReconnect && status === 'disconnected') {
        console.log('[BLEContext] Auto-reconnecting to saved device...');
        const result = await bleConnection.autoReconnect();
        if (result.success && result.device) {
          setDeviceName(result.device.name || 'Unknown Device');
          console.log('[BLEContext] Auto-reconnect successful:', result.device.name);
        } else {
          console.log('[BLEContext] Auto-reconnect failed:', result.error);
        }
      }
    };
    checkAndAutoReconnect();
  }, []);

  useEffect(() => {
    // Subscribe to status changes
    const handleStatusChange = (newStatus: BLEStatus) => {
      setStatus(newStatus);

      // Clear device name on disconnect
      if (newStatus === 'disconnected') {
        setDeviceName(null);
      }
    };

    // Subscribe to throw events
    const handleThrow = (throwData: DartThrowData) => {
      setLastThrow(throwData);
    };

    bleConnection.onStatusChange(handleStatusChange);
    bleConnection.onThrow(handleThrow);

    // Check if already connected
    if (bleConnection.isConnected) {
      setStatus('connected');
      const deviceInfo = bleConnection.getDeviceInfo();
      if (deviceInfo) {
        setDeviceName(deviceInfo.name);
      }
    }

    // Cleanup
    return () => {
      bleConnection.offStatusChange(handleStatusChange);
      bleConnection.offThrow(handleThrow);
    };
  }, []);

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    const result = await bleConnection.connect();
    if (result.success && result.device) {
      setDeviceName(result.device.name || 'Granboard');
      setCanAutoReconnect(true);
    }
    return result;
  };

  const autoReconnect = async (): Promise<{ success: boolean; error?: string }> => {
    const result = await bleConnection.autoReconnect();
    if (result.success && result.device) {
      setDeviceName(result.device.name || 'Granboard');
    }
    return result;
  };

  const disconnect = async (): Promise<void> => {
    await bleConnection.disconnect();
    setDeviceName(null);
    setLastThrow(null);
  };

  const simulateThrow = (segment?: string, score?: number): DartThrowData => {
    return bleConnection.simulateThrow(segment, score);
  };

  const clearLEDs = (): Promise<boolean> => {
    return bleConnection.clearLEDs();
  };

  const value: BLEContextType = {
    status,
    isConnected: status === 'connected',
    deviceName,
    lastThrow,
    connect,
    autoReconnect,
    canAutoReconnect,
    lastDeviceName,
    disconnect,
    simulateThrow,
    clearLEDs,
    isSupported
  };

  return (
    <BLEContext.Provider value={value}>
      {children}
    </BLEContext.Provider>
  );
}

// Custom hook to use BLE context
export function useBLE(): BLEContextType {
  const context = useContext(BLEContext);
  if (context === undefined) {
    throw new Error('useBLE must be used within a BLEProvider');
  }
  return context;
}

export default BLEContext;
