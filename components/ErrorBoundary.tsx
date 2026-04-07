import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloading: boolean;
}

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  const name = error.name ?? '';
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('dynamically imported module') ||
    msg.includes('Unable to preload CSS') ||
    /Loading chunk \d+ failed/.test(msg)
  );
}

const RELOAD_KEY = 'piobyte_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 15_000;

function clearCachesAndReload(): void {
  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .finally(() => window.location.reload());
  } else {
    window.location.reload();
  }
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, reloading: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidUpdate(_: Props, prev: State): void {
    const { hasError, error, reloading } = this.state;
    if (!hasError || reloading || prev.hasError) return;
    if (!isChunkLoadError(error)) return;

    const lastReload = Number(sessionStorage.getItem(RELOAD_KEY) ?? '0');
    if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) return;

    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    this.setState({ reloading: true }, clearCachesAndReload);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack ?? '');
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, reloading: false });
    window.location.hash = '#/';
  };

  private handleForceReload = (): void => {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    clearCachesAndReload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.state.reloading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
            <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Updating app… please wait</p>
          </div>
        );
      }

      const isChunk = isChunkLoadError(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96L13.75 4a2 2 0 00-3.5 0L3.25 16.04A2 2 0 005.07 19z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
            {isChunk
              ? 'The app was updated. Tap below to reload the latest version.'
              : 'This page ran into an unexpected error. Try refreshing or go back home.'}
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            {isChunk ? (
              <button
                onClick={this.handleForceReload}
                className="px-6 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-colors uppercase text-sm tracking-widest"
              >
                Reload App
              </button>
            ) : (
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-colors uppercase text-sm tracking-widest"
              >
                Go Home
              </button>
            )}
          </div>
          {this.state.error && !isChunk && (
            <details className="mt-4 text-left max-w-md">
              <summary className="text-xs text-slate-400 cursor-pointer">Error details</summary>
              <pre className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
