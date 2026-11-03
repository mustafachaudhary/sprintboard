import { Component } from 'react';

/**
 * Last-resort error boundary: if a rendering bug ever unmounts the whole
 * React tree, this shows what broke instead of a silent black page.
 * It catches render-time errors in the components below it.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Also log for the developer console.
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 48, maxWidth: 720, margin: '0 auto', color: 'var(--text)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something broke</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
            The interface hit an unexpected error. The details below are for debugging.
          </p>
          <pre
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 16,
              fontSize: 12,
              color: 'var(--negative)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              lineHeight: 1.5,
            }}
          >
            {String(this.state.error?.message || this.state.error)}
            {'\n\n'}
            {this.state.error?.stack || ''}
          </pre>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ marginTop: 16 }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
