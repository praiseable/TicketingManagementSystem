import React from 'react';
import { Button } from '@/components/ui/button';

type State = {
  hasError: boolean;
  message: string;
  stack?: string;
};

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected frontend error', stack: error.stack };
  }

  componentDidCatch(error: Error) {
    console.error('PM Platform section failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm">
          <h2 className="text-lg font-semibold text-destructive">Section failed to load</h2>
          <p className="mt-2 whitespace-pre-wrap text-destructive">{this.state.message}</p>
          {this.state.stack && <pre className="mt-3 max-h-72 overflow-auto rounded-lg border bg-background p-3 text-xs text-muted-foreground">{this.state.stack}</pre>}
          <div className="mt-4 flex gap-2">
            <Button onClick={() => this.setState({ hasError: false, message: '', stack: undefined })}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
