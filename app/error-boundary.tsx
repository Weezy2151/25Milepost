"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches render errors so a single bad event or a malformed feed field cannot
 * blank the whole page. React only supports error boundaries as class
 * components, which is why this one is not a hook.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("The 25-Mile Post hit a render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <div className="crash-card">
          <span className="crash-mark" aria-hidden="true">
            25
          </span>
          <h1>This page stopped loading</h1>
          <p>
            Something went wrong while rendering today&rsquo;s edition. Reloading usually clears it — the event calendars
            themselves are unaffected.
          </p>
          <div className="crash-actions">
            <button type="button" className="btn-solid" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <a className="btn-ghost" href="https://www.orchardparkny.gov/events/" target="_blank" rel="noreferrer">
              Town calendar instead
            </a>
          </div>
          <details className="crash-detail">
            <summary>Technical detail</summary>
            <code>{this.state.error.message}</code>
          </details>
        </div>
      </div>
    );
  }
}
