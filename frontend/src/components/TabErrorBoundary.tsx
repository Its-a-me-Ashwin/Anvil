import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  onClose: () => void;
}

interface State {
  error: Error | null;
}

// A crash while rendering one tab's content (e.g. a malformed wiring
// diagram) used to take down the whole app to a blank white screen, since
// nothing caught the render error. This contains it to just that tab, with
// a way back out instead of a page reload.
export default class TabErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    // Recover automatically if the tab identity changes (children key differs)
    // — handled by the parent remounting via `key`, but guard against a stale
    // error lingering if props change without a remount.
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full flex items-center justify-center text-anvil-muted p-6">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-anvil-danger" />
            <p className="text-sm font-medium text-white">This tab failed to render</p>
            <p className="text-xs mt-1 mb-4 break-words">{this.state.error.message}</p>
            <button
              onClick={this.props.onClose}
              className="px-3 py-1.5 rounded-md bg-anvil-accent hover:bg-blue-600 text-white text-xs font-medium"
            >
              Close tab
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
