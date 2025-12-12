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
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
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
    console.log(`[WebRTC] Initializing - gameId: ${gameId}, local: ${localPlayerId}, remote: ${remotePlayerId}`);

    // Clean up any existing connection first
    await this.disconnect();

    this.gameId = gameId;
    this.localPlayerId = localPlayerId;
    this.remotePlayerId = remotePlayerId;
    this._lastError = null;

    console.log('[WebRTC] Getting local stream...');
    const stream = await this.getLocalStream();
    if (!stream) {
      this._lastError = 'Camera unavailable - close other apps using camera';
      console.error('[WebRTC] Failed to get local stream');
      return false;
    }
    console.log(`[WebRTC] Got local stream with ${stream.getTracks().length} tracks`);

    this.peerConnection = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });
    console.log('[WebRTC] Created peer connection');

    stream.getTracks().forEach(track => {
      console.log(`[WebRTC] Adding track to peer connection: ${track.kind}`);
      this.peerConnection!.addTrack(track, stream);
    });

    this.peerConnection.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track! streams: ${event.streams.length}`);
      this.remoteStream = event.streams[0];
      this.onRemoteStreamCallbacks.forEach(cb => cb(this.remoteStream!));
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Got ICE candidate, sending...');
        this.sendSignal({ type: 'ice-candidate', payload: event.candidate.toJSON(), from: this.localPlayerId, to: this.remotePlayerId, gameId: this.gameId });
      } else {
        console.log('[WebRTC] ICE gathering complete');
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'closed';
      console.log(`[WebRTC] Connection state changed: ${state}`);
      this.onConnectionStateCallbacks.forEach(cb => cb(state as RTCPeerConnectionState));
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state: ${this.peerConnection?.iceConnectionState}`);
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log(`[WebRTC] ICE gathering state: ${this.peerConnection?.iceGatheringState}`);
    };

    await this.subscribeToSignaling();
    console.log('[WebRTC] Initialization complete');
    return true;
  }

  private async subscribeToSignaling(): Promise<void> {
    const channelName = `webrtc:${this.gameId}`;
    console.log(`[WebRTC] Subscribing to channel: ${channelName}`);

    this.signalChannel = supabase.channel(channelName, { config: { broadcast: { self: false } } });

    return new Promise((resolve) => {
      this.signalChannel!
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          const message = payload as SignalMessage;
          console.log(`[WebRTC] Received signal: ${message.type} from ${message.from} to ${message.to}`);
          if (message.to !== this.localPlayerId) {
            console.log(`[WebRTC] Ignoring signal - not for me (I am ${this.localPlayerId})`);
            return;
          }
          await this.handleSignal(message);
        })
        .subscribe((status) => {
          console.log(`[WebRTC] Channel subscription status: ${status}`);
          if (status === 'SUBSCRIBED') {
            console.log(`[WebRTC] Successfully subscribed to ${channelName}`);
            resolve();
          }
        });
    });
  }

  private async sendSignal(message: SignalMessage): Promise<void> {
    if (!this.signalChannel) {
      console.error('[WebRTC] Cannot send signal - no channel');
      return;
    }
    console.log(`[WebRTC] Sending signal: ${message.type} from ${message.from} to ${message.to}`);
    const result = await this.signalChannel.send({ type: 'broadcast', event: 'signal', payload: message });
    console.log(`[WebRTC] Signal send result:`, result);
  }

  private async handleSignal(message: SignalMessage): Promise<void> {
    if (!this.peerConnection) {
      console.error('[WebRTC] Cannot handle signal - no peer connection');
      return;
    }

    console.log(`[WebRTC] Handling signal: ${message.type}`);

    if (message.type === 'offer') {
      console.log('[WebRTC] Setting remote description from offer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      console.log('[WebRTC] Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('[WebRTC] Sending answer...');
      await this.sendSignal({ type: 'answer', payload: answer, from: this.localPlayerId, to: this.remotePlayerId, gameId: this.gameId });
    } else if (message.type === 'answer') {
      console.log('[WebRTC] Setting remote description from answer...');
      this.clearOfferRetry(); // Got answer, stop retrying
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      console.log('[WebRTC] Remote description set from answer');
    } else if (message.type === 'ice-candidate') {
      try {
        console.log('[WebRTC] Adding ICE candidate...');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
      } catch (err) {
        console.error('[WebRTC] ICE error:', err);
      }
    }
  }

  private offerRetryCount = 0;
  private maxOfferRetries = 5;
  private offerRetryTimeout: NodeJS.Timeout | null = null;

  async startCall(): Promise<void> {
    if (!this.peerConnection) {
      console.error('[WebRTC] Cannot start call - no peer connection');
      return;
    }

    this.offerRetryCount = 0;
    await this.sendOffer();
  }

  private async sendOffer(): Promise<void> {
    if (!this.peerConnection) return;

    this.offerRetryCount++;
    console.log(`[WebRTC] Sending offer (attempt ${this.offerRetryCount}/${this.maxOfferRetries})...`);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await this.sendSignal({ type: 'offer', payload: offer, from: this.localPlayerId, to: this.remotePlayerId, gameId: this.gameId });
    console.log('[WebRTC] Offer sent, waiting for answer...');

    // Set up retry if no connection established
    if (this.offerRetryCount < this.maxOfferRetries) {
      this.offerRetryTimeout = setTimeout(() => {
        if (this.peerConnection?.connectionState !== 'connected' &&
            this.peerConnection?.connectionState !== 'connecting' &&
            this.peerConnection?.iceConnectionState !== 'connected' &&
            this.peerConnection?.iceConnectionState !== 'checking') {
          console.log('[WebRTC] No response, retrying offer...');
          this.sendOffer();
        }
      }, 3000);
    }
  }

  private clearOfferRetry(): void {
    if (this.offerRetryTimeout) {
      clearTimeout(this.offerRetryTimeout);
      this.offerRetryTimeout = null;
    }
  }

  getLocalMediaStream(): MediaStream | null { return this.localStream; }
  getRemoteMediaStream(): MediaStream | null { return this.remoteStream; }

  async disconnect(): Promise<void> {
    this.clearOfferRetry();
    if (this.localStream) { this.localStream.getTracks().forEach(track => track.stop()); this.localStream = null; }
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
    if (this.signalChannel) { await this.signalChannel.unsubscribe(); this.signalChannel = null; }
    this.remoteStream = null;
  }
}

export const webRTCManager = new WebRTCManager();
export default webRTCManager;
