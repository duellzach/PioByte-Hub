/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info.componentStack ?? '');
  }

  handleReset() {
    (this as any).setState({ hasError: false, error: null });
    window.location.hash = '#/';
  }

  render() {
    const s: State = (this as any).state;
    const p: Props = (this as any).props;
    if (s.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96L13.75 4a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
            This page ran into an unexpected error. Try refreshing or go back home.
          </p>
          <button
            onClick={() => this.handleReset()}
            className="px-6 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-colors uppercase text-sm tracking-widest"
          >
            Go Home
          </button>
          {s.error && (
            <details className="mt-4 text-left max-w-md">
              <summary className="text-xs text-slate-400 cursor-pointer">Error details</summary>
              <pre className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl overflow-auto">
                {s.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return p.children;
  }
}
