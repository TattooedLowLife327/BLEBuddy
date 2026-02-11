// ErrorBoundary.tsx
// Catches runtime errors (e.g. on Bluefy/iOS when opening in-house CR/01) and shows
// a friendly message instead of a wall of code or React's error overlay.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log for debugging only - never render to UI (avoids "wall of code" on Bluefy/iOS)
    console.error('[ErrorBoundary]', error?.message, errorInfo?.componentStack);
  }

  handleBack = (): void => {
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
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
          }}
        >
          <p
            style={{
              color: '#fff',
              fontSize: 18,
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            Something went wrong.
          </p>
          <button
            type="button"
            onClick={this.handleBack}
            style={{
              padding: '12px 24px',
              background: '#a855f7',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
