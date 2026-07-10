import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { logger } from "../lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.critical("GlobalErrorBoundary", "Fatal Exception caught in App scope", { 
      message: error.message, 
      stack: error.stack, 
      componentStack: errorInfo.componentStack 
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={40} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Exception Detected</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                PrecisionQA encountered a runtime error while rendering this module. Our telemetry has logged the incident.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Error Signature</p>
                <p className="text-xs font-mono text-rose-500 dark:text-rose-400 break-words leading-normal">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Reload System
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="flex-1 px-6 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Home size={18} />
                Dashboard
              </button>
            </div>

            <p className="text-[10px] text-slate-400 font-medium">
              Enterprise Quality Management System | PrecisionQA v4.0.0
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export class RouteErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("RouteErrorBoundary", "Exception occurred rendering nested route path", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 bg-slate-50 dark:bg-[#000000] p-8 flex items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-xl">
            <AlertCircle size={40} className="mx-auto text-amber-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Route Rendering Interrupted</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The page you are trying to view failed to load correctly. This may be due to an temporary session state sync.
            </p>
            {this.state.error && (
              <pre className="text-left text-xs bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-amber-600 dark:text-amber-400 overflow-auto max-h-40 font-mono">
                {this.state.error.stack || this.state.error.message}
              </pre>
            )}
            <div className="flex gap-2">
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all"
              >
                Recover View
              </button>
              <button 
                onClick={() => window.location.href = "/"}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export class ComponentErrorBoundary extends React.Component<{ children: ReactNode; name?: string }, State> {
  constructor(props: { children: ReactNode; name?: string }) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.warn("ComponentErrorBoundary", `Localized exception in subcomponent: ${this.props.name || "Anonymous"}`, {
      name: this.props.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50/50 dark:bg-rose-950/5 border border-rose-100 dark:border-rose-950/25 rounded-2xl text-center space-y-3">
          <AlertCircle size={32} className="mx-auto text-rose-500" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Failed to render {this.props.name || "component"}</h4>
          <p className="text-xs text-rose-600 dark:text-rose-400 max-w-sm mx-auto font-mono">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Retry Loading
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
