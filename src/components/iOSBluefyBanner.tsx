import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function iOSBluefyBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // Check if NOT running in Bluefy (Bluefy adds specific user agent string)
    const isBluefy = /Bluefy/.test(navigator.userAgent);

    // Check if user previously dismissed this session
    const wasDismissed = sessionStorage.getItem('ios-bluefy-dismissed') === 'true';

    if (isIOS && !isBluefy && !wasDismissed) {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem('ios-bluefy-dismissed', 'true');
    setDismissed(true);
    setShow(false);
  };

  if (!show || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-purple-900 to-purple-700 text-white p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <h3 className="font-bold text-lg">iOS Users - Bluefy Required</h3>
          </div>
          <p className="text-sm text-purple-100">
            Safari doesn't support Bluetooth. Download <strong>Bluefy Browser</strong> from the App Store to connect your Granboard and play online.
          </p>
          <a
            href="https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 px-4 py-2 bg-white text-purple-900 rounded-lg font-semibold text-sm hover:bg-purple-50 transition"
          >
            Download Bluefy (Free)
          </a>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/20 rounded transition"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
