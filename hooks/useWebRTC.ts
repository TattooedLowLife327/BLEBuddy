// hooks/useWebRTC.ts
// React hook for WebRTC video connections

import { useState, useEffect, useCallback } from 'react';
import webRTCManager from '../utils/webrtc/peerConnection';

interface UseWebRTCOptions {
  gameId: string;
  localPlayerId: string;
  remotePlayerId: string;
  isInitiator: boolean; // true = you create offer, false = you wait for offer
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | 'initializing' | 'idle';
  error: string | null;
  initialize: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useWebRTC(options: UseWebRTCOptions | null): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'initializing' | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (!options) return;
    
    setConnectionState('initializing');
    setError(null);

    const success = await webRTCManager.initialize(
      options.gameId,
      options.localPlayerId,
      options.remotePlayerId
    );

    if (!success) {
      setError('Failed to initialize - camera access denied?');
      setConnectionState('idle');
      return;
    }

    setLocalStream(webRTCManager.getLocalMediaStream());

    if (options.isInitiator) {
      await webRTCManager.startCall();
    }
  }, [options]);

  useEffect(() => {
    if (!options) return;

    const handleRemoteStream = (stream: MediaStream) => {
      setRemoteStream(stream);
    };

    const handleConnectionState = (state: RTCPeerConnectionState) => {
      setConnectionState(state);
    };

    webRTCManager.onRemoteStream(handleRemoteStream);
    webRTCManager.onConnectionState(handleConnectionState);

    return () => {
      webRTCManager.offRemoteStream(handleRemoteStream);
    };
  }, [options]);

  const disconnect = useCallback(async () => {
    await webRTCManager.disconnect();
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('idle');
  }, []);

  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    initialize,
    disconnect,
  };
}

export default useWebRTC;
