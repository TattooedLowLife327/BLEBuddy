/**
 * Shown when the app is opened inside Messenger/Facebook/Instagram in-app browser.
 * Tells users to open in Chrome (Android) or Bluefy (Apple) so BLE and the app work correctly.
 */
export function InAppBrowserBlock() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'Helvetica, Arial, sans-serif',
        textAlign: 'center',
        zIndex: 9999,
      }}
    >
      <h1
        style={{
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        Open in a supported browser
      </h1>
      <p
        style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: 16,
          lineHeight: 1.5,
          marginBottom: 24,
          maxWidth: 340,
        }}
      >
        BLE Buddy doesn’t work properly inside the Messenger or Facebook app browser.
      </p>
      <p
        style={{
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Please open this link in:
      </p>
      <ul
        style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: 15,
          lineHeight: 1.8,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        <li><strong>Android:</strong> Chrome</li>
        <li><strong>iPhone/iPad:</strong> Bluefy</li>
      </ul>
      <p
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 13,
          marginTop: 20,
          maxWidth: 320,
        }}
      >
        Tap the menu (⋮) or “Open in…” and choose Chrome or Bluefy to continue.
      </p>
    </div>
  );
}
