import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card p-6 text-center">
        <div className="font-medium">Something went wrong on this screen.</div>
        <div className="mt-1 text-sm text-mute">{this.state.error.message}</div>
        <button className="btn-primary mt-4" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
