import { useState } from 'react';
import { Monitor, Settings, ExternalLink } from 'lucide-react';

interface CodeServerWorkspaceProps {
  url?: string;
}

export default function CodeServerWorkspace({ url }: CodeServerWorkspaceProps) {
  const [serverUrl, setServerUrl] = useState(url || 'http://localhost:8080');
  const [inputUrl, setInputUrl] = useState(url || 'http://localhost:8080');
  const [loadError, setLoadError] = useState(false);

  const applyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setLoadError(false);
    setServerUrl(inputUrl);
  };

  const openExternal = () => window.open(serverUrl, '_blank', 'noopener,noreferrer');

  return (
    <div className="h-full w-full flex flex-col bg-anvil-bg">
      <form onSubmit={applyUrl} className="h-9 flex items-center gap-2 px-3 bg-anvil-panel border-b border-anvil-border shrink-0">
        <Monitor className="w-4 h-4 text-anvil-muted" />
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="code-server URL"
          className="flex-1 bg-transparent border-none outline-none text-xs text-anvil-text placeholder-anvil-muted"
        />
        <button
          type="submit"
          className="px-3 py-1 rounded bg-anvil-accent hover:bg-blue-600 text-white text-[11px] font-medium"
        >
          Connect
        </button>
        <button
          type="button"
          onClick={openExternal}
          className="text-anvil-muted hover:text-white"
          title="Open in browser"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </form>

      <div className="flex-1 relative">
        {loadError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-anvil-muted p-6">
            <Settings className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium text-white">VS Code Server not reachable</p>
            <p className="text-xs mt-1 max-w-sm text-center">
              Start it locally with:<br />
              <code className="bg-anvil-panel px-2 py-1 rounded text-anvil-text">code serve-web --accept-server-license-terms --port 8080 --default-folder .</code>
            </p>
            <button
              onClick={() => setLoadError(false)}
              className="mt-4 px-3 py-1.5 rounded bg-anvil-border hover:bg-anvil-panelHover text-xs text-anvil-text"
            >
              Try again
            </button>
          </div>
        ) : (
          <iframe
            key={serverUrl}
            src={serverUrl}
            title="code-server"
            className="w-full h-full border-none bg-anvil-panel"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            onError={() => setLoadError(true)}
            onLoad={() => setLoadError(false)}
          />
        )}
      </div>
    </div>
  );
}
