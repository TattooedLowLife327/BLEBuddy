// utils/webrtc/peerConnection.ts
// WebRTC Peer Connection for video chat between players

import { createClient } from '../supabase/client';
const supabase = createClient();

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  to: string;
  gameId: string;
}

class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalChannel: ReturnType<typeof supabase.channel> | null = null;
  
  private onRemoteStreamCallbacks: ((stream: MediaStream) => void)[] = [];
  private onConnectionStateCallbacks: ((state: RTCPeerConnectionState) => void)[] = [];
  
  private localPlayerId: string = '';
  private remotePlayerId: string = '';
  private gameId: string = '';
  
  private readonly ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallbacks.push(callback);
    if (this.remoteStream) callback(this.remoteStream);
  }

  offRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallbacks = this.onRemoteStreamCallbacks.filter(cb => cb !== callback);
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateCallbacks.push(callback);
  }

  async getLocalStream(): Promise<MediaStream | null> {
    // If we already have a stream, stop it first to release the camera
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    try {
      // Try with preferred constraints first
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      return this.localStream;
    } catch (err: any) {
      console.error('Failed to get camera with constraints:', err);

      // If NotReadableError, try with minimal constraints as fallback
      if (err.name === 'NotReadableError' || err.name === 'AbortError') {
        console.log('Retrying with minimal video constraints...');
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          return this.localStream;
        } catch (fallbackErr) {
          console.error('Fallback camera access also failed:', fallbackErr);
        }
      }

      return null;
    }
  }

  getLastError(): string | null {
    return this._lastError;
  }

  private _lastError: string | null = null;

  async initialize(gameId: string, localPlayerId: string, remotePlayerId: string): Promise<boolean> {
    // Clean up any existing connection first
    await this.disconnect();

    this.gameId = gameId;
    this.localPlayerId = localPlayerId;
    this.remotePlayerId = remotePlayerId;
    this._lastError = null;

    const stream = await this.getLocalStream();
    if (!stream) {
      this._lastError = 'Camera unavailable - close other apps using camera';
      return false;
    }

    this.peerConnection = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });

    stream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, stream);
    });

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.onRemoteStreamCallbacks.forEach(cb => cb(this.remoteStream!));
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: 'ice-candidate', payload: event.candidate.toJSON(), from: this.localPlayerId, to: this.remotePlayerId, gameId: this.gameId });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'closed';
      this.onConnectionStateCallbacks.forEach(cb => cb(state as RTCPeerConnectionState));
    };

    await this.subscribeToSignaling();
    return true;
  }

  private async subscribeToSignaling(): Promise<void> {
    this.signalChannel = supabase.channel(`webrtc:${this.gameId}`, { config: { broadcast: { self: false } } });

    this.signalChannel
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const message = payload as SignalMessage;
        if (message.to !== this.localPlayerId) return;
        await this.handleSignal(message);
      })
      .subscribe();
  }

  private async sendSignal(message: SignalMessage): Promise<void> {
    if (!this.signalChannel) return;
    await this.signalChannel.send({ type: 'broadcast', event: 'signal', payload: message });
  }

  private async handleSignal(message: SignalMessage): Promise<void> {
    if (!this.peerConnection) return;

    if (message.type === 'offer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.sendSignal({ type: 'answer', payload: answer, from: this.localPlayerId, to: this.remotePlayerId, gameId: this.gameId });
    } else if (message.type === 'answer') {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
    } else if (message.type === 'ice-candidate') {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
      } catch (err) {
        console.error('ICE error:', err);
      }
    }
  }

  async startCall(): Promise<void> {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.sendSignal({ type: 'offer', payload: offer, from: this.localPlayerId, to: this.remotePlayerId, gameId: this.gameId });
  }

  getLocalMediaStream(): MediaStream | null { return this.localStream; }
  getRemoteMediaStream(): MediaStream | null { return this.remoteStream; }

  async disconnect(): Promise<void> {
    if (this.localStream) { this.localStream.getTracks().forEach(track => track.stop()); this.localStream = null; }
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    if (this.signalChannel) { await this.signalChannel.unsubscribe(); this.signalChannel = null; }
    this.remoteStream = null;
  }
}

export const webRTCManager = new WebRTCManager();
export default webRTCManager;
