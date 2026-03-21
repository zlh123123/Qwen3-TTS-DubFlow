import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown UI error' };
  }

  componentDidCatch(error, info) {
    console.error('UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-xl rounded-xl border border-red-300 bg-white p-5 text-red-700 shadow-lg dark:border-red-800 dark:bg-slate-900 dark:text-red-300">
            <div className="text-sm font-semibold">Settings UI crashed</div>
            <div className="mt-2 text-xs opacity-90">{this.state.message}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
