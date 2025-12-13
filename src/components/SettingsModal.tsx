import { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [cleared, setCleared] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h2 className="text-white text-lg font-bold">Settings</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <img src="/icons/closebutton.svg" alt="Close" className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
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
