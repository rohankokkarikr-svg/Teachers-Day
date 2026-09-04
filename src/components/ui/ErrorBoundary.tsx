import React, { Component, type ReactNode } from 'react';
import Button from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  handleClearAndReset = () => {
    try {
      localStorage.removeItem('td_auth_user');
      localStorage.removeItem('td_auth_profile');
    } catch {
      // Ignore
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-surface-950 text-white">
          <div className="max-w-md w-full glass-card p-6 text-center space-y-4 border border-rose-500/30">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Something went wrong</h2>
              <p className="text-xs text-surface-400">
                An unexpected interface error occurred. You can reload or reset your local session.
              </p>
            </div>
            {this.state.error && (
              <div className="p-2.5 rounded-lg bg-surface-900 border border-surface-700/60 text-[11px] text-rose-300 font-mono text-left max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="primary" size="sm" onClick={this.handleReset}>
                Reload Application
              </Button>
              <Button variant="outline" size="sm" onClick={this.handleClearAndReset}>
                Clear Cache & Restart
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
