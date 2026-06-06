/**
 * ErrorBoundary — generisk fallback-wrapper.
 *
 * Embedder DirectorPanel inni CreativeEditorView gjør at en feil
 * der ville krasje hele Creative Editor uten en boundary. Denne
 * fanger render-feil + viser en pen retry-melding så brukeren ikke
 * mister jobben sin.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Vist når ingen feil. */
  children: ReactNode;
  /** Hvem rapporten skal merkes med (vises i UI for debug). */
  label?: string;
  /** Egen fallback. Hvis utelatt: standard error-box. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log til konsoll så Daniel ser stacken under devtools. I prod
    // kan vi hooke til Sentry her senere.
    console.error(
      `[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          data-testid="error-boundary-fallback"
          style={{
            background: "#3f1d1d",
            border: "1px solid #5a2a2a",
            borderRadius: 8,
            padding: 12,
            color: "#fda4af",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            ⚠ {this.props.label ?? "Komponent"} krasjet
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              opacity: 0.85,
              wordBreak: "break-word",
              marginBottom: 10,
            }}
          >
            {this.state.error.message}
          </div>
          <button
            onClick={this.reset}
            style={{
              background: "#5a2a2a",
              border: "1px solid #7a3a3a",
              color: "#fda4af",
              fontSize: 11,
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Prøv på nytt
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
