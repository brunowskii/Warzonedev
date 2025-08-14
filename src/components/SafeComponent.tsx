import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SafeComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
}

interface SafeComponentState {
  hasError: boolean;
  error?: Error;
}

export default class SafeComponent extends React.Component<SafeComponentProps, SafeComponentState> {
  constructor(props: SafeComponentProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SafeComponentState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`🚨 SafeComponent error in ${this.props.componentName || 'Unknown'}:`, {
      error: error.message,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
          <p className="text-red-400 font-mono text-sm">
            Errore nel componente {this.props.componentName || 'sconosciuto'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-2 px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 rounded text-xs font-mono hover:bg-red-500/30 transition-colors"
          >
            RIPROVA
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}