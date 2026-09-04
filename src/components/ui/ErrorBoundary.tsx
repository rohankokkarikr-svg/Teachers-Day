import React, { Component, type ReactNode } from 'react';
import { ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import Button from './Button';
import { captureError } from '../../lib/monitoring';

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
    captureError(error, { componentStack: errorInfo.componentStack }, 'react_render');
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
    // Soft reset without clearing local voting sessions or tokens
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-surface-950 text-white">
          <div className="max-w-md w-full glass-card p-6 text-center space-y-4 border border-rose-500/30">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto text-xl">
              <AlertCircle size={24} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Something went wrong</h2>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium my-1">
                <ShieldCheck size={14} />
                <span>Your voting data is safe</span>
              </div>
              <p className="text-xs text-surface-400 pt-1">
                An interface error occurred. You can safely retry without losing your submitted votes.
              </p>
            </div>

            {this.state.error && import.meta.env.DEV && (
              <div className="p-2.5 rounded-lg bg-surface-900 border border-surface-700/60 text-[11px] text-rose-300 font-mono text-left max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex justify-center">
              <Button
                variant="primary"
                size="md"
                onClick={this.handleTryAgain}
                icon={<RefreshCw size={16} />}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

