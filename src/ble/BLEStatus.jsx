// components/BLEStatus.jsx
// BLE Connection Status Component for LowLife BLE Buddy

import React, { useState, useEffect } from 'react';
import bleConnection from './bleConnection';

export default function BLEStatus({ onThrowDetected }) {
  const [status, setStatus] = useState('disconnected');
  const [deviceName, setDeviceName] = useState('');

  useEffect(() => {
    // Subscribe to status changes
    bleConnection.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Subscribe to throw events
    if (onThrowDetected) {
      bleConnection.onThrow((throwData) => {
        onThrowDetected(throwData);
      });
    }

    // Check if already connected
    if (bleConnection.isConnected) {
      setStatus('connected');
      setDeviceName(bleConnection.device?.name || 'Granboard');
    }
  }, [onThrowDetected]);

  const handleConnect = async () => {
    const result = await bleConnection.connect();
    if (result.success) {
      setDeviceName(result.device.name || 'Granboard');
    }
  };

  const handleDisconnect = async () => {
    await bleConnection.disconnect();
    setDeviceName('');
  };

  const handleTestThrow = () => {
    bleConnection.simulateThrow('T20', 60);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'scanning': return '#3b82f6';
      case 'disconnected': return '#ef4444';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
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
    <div className="ble-status-container">
      <div className="ble-status-card">
        <div className="status-indicator">
          <div 
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>

        <div className="ble-actions">
          {status === 'connected' ? (
            <>
              <button 
                onClick={handleDisconnect}
                className="btn btn-danger"
              >
                Disconnect
              </button>
              {process.env.NODE_ENV === 'development' && (
                <button 
                  onClick={handleTestThrow}
                  className="btn btn-secondary"
                >
                  Test Throw
                </button>
              )}
            </>
          ) : (
            <button 
              onClick={handleConnect}
              disabled={status === 'connecting' || status === 'scanning'}
              className="btn btn-primary"
            >
              {status === 'scanning' ? 'Scanning...' : 'Connect Board'}
            </button>
          )}
        </div>
      </div>

      {!bleConnection.constructor.isSupported() && (
        <div className="ble-warning">
          <p>⚠️ Web Bluetooth not supported</p>
          <p className="text-sm">Use Chrome on Android or Bluefy on iOS</p>
        </div>
      )}
    </div>
  );
}
