import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error en el lienzo:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center bg-slate-900 text-slate-200">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Ocurrió un error en la vista del lienzo</h2>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            {this.state.error?.message || 'Error inesperado al renderizar elementos gráficos.'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restablecer Lienzo</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
