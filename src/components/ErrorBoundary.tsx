import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import GlassPanel from './GlassPanel';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: Date.now().toString(36).toUpperCase()
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorId: Date.now().toString(36).toUpperCase()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error details
    console.error('🚨 Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId
    });
    
    // Try to save current state before crash
    try {
      const currentState = {
        tournaments: localStorage.getItem('tournaments'),
        teams: localStorage.getItem('teams'),
        matches: localStorage.getItem('matches'),
        timestamp: Date.now()
      };
      localStorage.setItem('crash_backup', JSON.stringify(currentState));
      console.log('💾 State backed up before crash');
    } catch (backupError) {
      console.error('❌ Failed to backup state:', backupError);
    }
  }

  handleReload = () => {
    // Clear any corrupted data
    try {
      const keysToCheck = ['tournaments', 'teams', 'matches', 'pendingSubmissions', 'scoreAdjustments'];
      keysToCheck.forEach(key => {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            JSON.parse(data);
          } catch (parseError) {
            console.warn(`🧹 Clearing corrupted data for ${key}`);
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
    
    window.location.reload();
  };

  handleGoHome = () => {
    // Clear all data and go to home
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
          <GlassPanel className="w-full max-w-2xl p-6 sm:p-8 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 mb-4 relative">
                <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
                <div className="absolute inset-0 rounded-full bg-red-400/10 animate-ping" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 font-mono">
                ERRORE SISTEMA
              </h1>
              <p className="text-red-400/80 font-mono text-sm sm:text-base">
                Si è verificato un errore nell'applicazione
              </p>
            </div>

            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-left">
              <h3 className="text-red-400 font-mono font-bold mb-2 text-sm sm:text-base">
                Dettagli Errore:
              </h3>
              <div className="text-red-400/80 font-mono text-xs sm:text-sm break-all">
                {this.state.error?.message || 'Errore sconosciuto'}
              </div>
              <div className="text-red-400/60 font-mono text-xs mt-2">
                Error ID: {this.state.errorId}
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={this.handleReload}
                className="w-full py-3 sm:py-4 bg-gradient-to-r from-ice-blue to-ice-blue-dark text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(161,224,255,0.5)] hover:scale-105 transition-all duration-300 font-mono text-sm sm:text-base"
              >
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>RICARICA APPLICAZIONE</span>
                </div>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full py-3 sm:py-4 bg-gray-500/20 border border-gray-500/50 text-gray-400 rounded-xl hover:bg-gray-500/30 transition-colors font-mono text-sm sm:text-base"
              >
                <div className="flex items-center justify-center space-x-2">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>RESET COMPLETO</span>
                </div>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-red-500/20">
              <p className="text-red-400/60 text-xs sm:text-sm font-mono">
                Se il problema persiste, prova a cancellare i dati del browser
              </p>
            </div>
          </GlassPanel>
        </div>
      );
    }

    return this.props.children;
  }
}