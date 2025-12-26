// components/BLEStatus.tsx
// BLE Connection Status Component for LowLife BLE Buddy

import React, { useState, useEffect } from 'react';
import bleConnection, { BLEStatus as BLEStatusType, DartThrowData } from '../utils/ble/bleConnection';

interface BLEStatusProps {
  onThrowDetected?: (throwData: DartThrowData) => void;
  className?: string;
}

export default function BLEStatus({ onThrowDetected, className = '' }: BLEStatusProps) {
  const [status, setStatus] = useState<BLEStatusType>('disconnected');
  const [deviceName, setDeviceName] = useState('');
  const [canAutoReconnect, setCanAutoReconnect] = useState(false);
  const [lastDeviceName, setLastDeviceName] = useState<string | null>(null);

  useEffect(() => {
    // Check if auto-reconnect is available
    bleConnection.canAutoReconnect().then(setCanAutoReconnect);
    setLastDeviceName(bleConnection.getLastDeviceName());

    // Subscribe to status changes
    const handleStatusChange = (newStatus: BLEStatusType) => {
      setStatus(newStatus);
    };

    bleConnection.onStatusChange(handleStatusChange);

    // Subscribe to throw events
    if (onThrowDetected) {
      bleConnection.onThrow(onThrowDetected);
    }

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
      if (onThrowDetected) {
        bleConnection.offThrow(onThrowDetected);
      }
    };
  }, [onThrowDetected]);

  const handleConnect = async () => {
    const result = await bleConnection.connect();
    if (result.success && result.device) {
      setDeviceName(result.device.name || 'Granboard');
      setCanAutoReconnect(true);
    }
  };

  const handleAutoReconnect = async () => {
    const result = await bleConnection.autoReconnect();
    if (result.success && result.device) {
      setDeviceName(result.device.name || 'Granboard');
    } else {
      // Fall back to manual connect if auto-reconnect fails
      console.log('Auto-reconnect failed, trying manual connect');
      await handleConnect();
    }
  };

  const handleDisconnect = async () => {
    await bleConnection.disconnect();
    setDeviceName('');
  };

  const handleTestThrow = () => {
    bleConnection.simulateThrow('T20', 60);
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'scanning': return '#3b82f6';
      case 'disconnected': return '#ef4444';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'connected': return `Connected to ${deviceName}`;
      case 'connecting': return 'Connecting...';
      case 'scanning': return 'Scanning for boards...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection failed';
      default: return 'Ready';
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm rounded-xl border border-purple-500/30">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full transition-all duration-300"
            style={{
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 12px ${getStatusColor()}`
            }}
          />
          <span className="text-white font-medium">{getStatusText()}</span>
        </div>

        <div className="flex gap-2">
          {status === 'connected' ? (
            <>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Disconnect
              </button>
              {import.meta.env.DEV && (
                <button
                  onClick={handleTestThrow}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Test Throw
                </button>
              )}
            </>
          ) : (
            <>
              {canAutoReconnect && lastDeviceName && (
                <button
                  onClick={handleAutoReconnect}
                  disabled={status === 'connecting' || status === 'scanning'}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Reconnect {lastDeviceName}
                </button>
              )}
              <button
                onClick={handleConnect}
                disabled={status === 'connecting' || status === 'scanning'}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm"
              >
                {status === 'scanning' ? 'Scanning...' : canAutoReconnect ? 'New Board' : 'Connect Board'}
              </button>
            </>
          )}
        </div>
      </div>

      {!bleConnection.constructor.isSupported() && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
          <p className="text-yellow-200 font-medium">⚠️ Web Bluetooth not supported</p>
          <p className="text-yellow-200/70 text-sm mt-1">Use Chrome on Android or Bluefy on iOS</p>
        </div>
      )}
    </div>
  );
}
