'use client';
import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * A section-level error boundary (I2). If one widget on a page throws while
 * rendering, this catches it and shows a small "this part couldn't load" card
 * with a retry — so a single broken section never takes down the whole page.
 * Wrap independent widgets in it.
 */
interface Props { children: React.ReactNode; label?: string }
interface State { error: Error | null }

export class SectionBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[section:${this.props.label ?? 'unknown'}] render failed:`, error.message);
  }

  reset = () => this.setState({ error: null });

  override render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
          <p className="font-medium">This part couldn’t load</p>
          <p className="mt-0.5 text-xs text-muted-foreground">The rest of the page is fine. You can try this section again.</p>
          <button onClick={this.reset} className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary">
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
