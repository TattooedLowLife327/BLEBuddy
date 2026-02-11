import { useState, useEffect } from 'react';
import { getCameraPreference, setCameraPreference, getAvailableCameras, type CameraDevice } from '../utils/webrtc/peerConnection';
import { createClient } from '../utils/supabase/client';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [cleared, setCleared] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>(getCameraPreference());
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  // Load available cameras when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingCameras(true);
      getAvailableCameras().then(devices => {
        setCameras(devices);
        setLoadingCameras(false);
      });
      setSelectedCamera(getCameraPreference());
    }
  }, [isOpen]);

  const handleCameraChange = (value: string) => {
    setSelectedCamera(value);
    setCameraPreference(value);
  };

  if (!isOpen) return null;

  const handleClearData = () => {
    // Clear all BLE Buddy related localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('bb-') || key.startsWith('blebuddy'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage
    sessionStorage.clear();

    setShowConfirm(false);
    setCleared(true);

    // Reset after 2 seconds
    setTimeout(() => setCleared(false), 2000);
  };

  const handleClose = () => {
    setShowConfirm(false);
    setCleared(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full relative flex flex-col max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700 flex-shrink-0">
          <h2 className="text-white text-lg font-bold">Settings</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <img src="/icons/closebutton.svg" alt="Close" className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollable on mobile */}
        <div className="p-4 space-y-4 overflow-y-auto min-h-0 flex-1">
          {/* Camera Selection Section */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-1">Camera Selection</h3>
            <p className="text-zinc-400 text-sm mb-3">
              Choose which camera to use for video calls.
            </p>

            {loadingCameras ? (
              <div className="text-zinc-400 text-sm">Loading cameras...</div>
            ) : (
              <select
                value={selectedCamera}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
              >
                {/* Mobile-friendly options */}
                <option value="user">Front Camera (Selfie)</option>
                <option value="environment">Back Camera (Rear)</option>

                {/* Specific device options for desktop */}
                {cameras.length > 0 && (
                  <optgroup label="Available Devices">
                    {cameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}

            <p className="text-zinc-500 text-xs mt-2">
              On mobile: use Front/Back. On desktop: select your webcam.
            </p>
          </div>

          {/* Revoke local access - play-only pairing, no account changes */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-1">Revoke local access</h3>
            <p className="text-zinc-400 text-sm mb-2">
              When you join a local game with your QR, the other device can only show your name and photo for that game. They cannot change your account, password, or data.
            </p>
            <p className="text-zinc-400 text-sm mb-3">
              If someone is no longer allowed to play as you on their device, revoke access below. Any game using your profile on another device will end.
            </p>
            {revoked ? (
              <div className="px-4 py-2 bg-green-600/20 border border-green-600 text-green-400 rounded-lg text-sm font-semibold text-center">
                Access revoked
              </div>
            ) : (
              <button
                onClick={async () => {
                  setRevoking(true);
                  try {
                    const supabase = createClient();
                    await (supabase as any).schema('companion').rpc('revoke_my_local_sessions');
                    setRevoked(true);
                    setTimeout(() => setRevoked(false), 3000);
                  } catch {
                    setRevoking(false);
                  }
                  setRevoking(false);
                }}
                disabled={revoking}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {revoking ? 'Revoking…' : 'Revoke access on other devices'}
              </button>
            )}
          </div>

          {/* Clear App Data Section */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-1">Clear App Data</h3>
            <p className="text-zinc-400 text-sm mb-3">
              Clears cached game data, abandoned match flags, and session data. Use this if stuck on a screen.
            </p>

            {cleared ? (
              <div className="px-4 py-2 bg-green-600/20 border border-green-600 text-green-400 rounded-lg text-sm font-semibold text-center">
                Data cleared
              </div>
            ) : showConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearData}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Clear App Data
              </button>
            )}
          </div>

          {/* App Info */}
          <div className="text-center text-zinc-500 text-xs pt-2">
            BLE Buddy v1.0.0
          </div>
        </div>
      </div>
    </div>
  );
}
