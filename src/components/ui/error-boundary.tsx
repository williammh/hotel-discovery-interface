"use client"

import * as React from "react"

type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback: React.ReactNode
  /** Fires once per caught error, before the fallback renders. */
  onError?: (error: Error) => void
}

type ErrorBoundaryState = {
  hasError: boolean
}

/**
 * Render errors are only catchable by a class component; React has no hook
 * equivalent. Keyed remounts reset it, since `hasError` dies with the instance.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
