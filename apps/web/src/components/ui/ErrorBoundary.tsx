'use client'

import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * H-21: React Error Boundary — catches render errors and shows a fallback UI
 * instead of a blank white screen. Wraps critical pages (POS, dashboard, etc.)
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-ink mb-1">Terjadi Kesalahan</h2>
          <p className="text-sm text-ink-muted mb-4 max-w-md">
            Halaman mengalami error. Coba muat ulang halaman.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-sm font-medium text-brand bg-brand/10 rounded-lg hover:bg-brand/20 transition-colors"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-ink-muted bg-surface-subtle rounded-lg hover:bg-surface-raised transition-colors"
            >
              Muat Ulang
            </button>
          </div>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="mt-4 p-3 bg-surface-subtle rounded-lg text-xs text-left text-red-600 max-w-lg overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
