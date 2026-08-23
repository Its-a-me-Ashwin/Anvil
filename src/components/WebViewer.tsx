import { useState, useEffect, useRef } from 'react';
import { Globe, ExternalLink, RefreshCw, Shield, Monitor } from 'lucide-react';

interface WebViewerProps {
  url: string;
  onUrlChange?: (url: string) => void;
}

export default function WebViewer({ url, onUrlChange }: WebViewerProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [mode, setMode] = useState<'direct' | 'proxy'>('direct');
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<number | null>(null);

  const proxyUrl = `/proxy?url=${encodeURIComponent(currentUrl)}`;
  const iframeSrc = mode === 'proxy' ? proxyUrl : currentUrl;

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    setCurrentUrl(target);
    setLoadFailed(false);
    setLoading(true);
    onUrlChange?.(target);
  };

  const openExternal = () => window.open(currentUrl, '_blank', 'noopener,noreferrer');

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    // Give the iframe a few seconds to load before showing the fallback
    timeoutRef.current = window.setTimeout(() => {
      if (loading) setLoadFailed(true);
    }, 4500);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [currentUrl, mode]);

  return (
    <div className="h-full w-full flex flex-col bg-anvil-bg">
      <form onSubmit={handleNavigate} className="h-9 flex items-center gap-2 px-3 bg-anvil-panel border-b border-anvil-border shrink-0">
        <button
          type="button"
          onClick={() => {
            setLoadFailed(false);
            setLoading(true);
          }}
          className="text-anvil-muted hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 flex items-center px-2 py-1 rounded bg-anvil-bg border border-anvil-border focus-within:border-anvil-accent">
          <Globe className="w-3.5 h-3.5 text-anvil-muted mr-2" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs text-anvil-text"
            placeholder="Enter URL..."
          />
        </div>

        <div className="flex items-center rounded bg-anvil-bg border border-anvil-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`px-2 py-1 text-[10px] ${mode === 'direct' ? 'bg-anvil-accent text-white' : 'text-anvil-muted hover:text-white'}`}
            title="Load directly (works for YouTube, Onshape, etc.)"
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setMode('proxy')}
            className={`px-2 py-1 text-[10px] flex items-center gap-1 ${mode === 'proxy' ? 'bg-anvil-accent text-white' : 'text-anvil-muted hover:text-white'}`}
            title="Load via local dev proxy (helps with Google, docs, etc.)"
          >
            <Shield className="w-3 h-3" />
            Proxy
          </button>
        </div>

        <button type="button" onClick={openExternal} className="text-anvil-muted hover:text-white" title="Open in browser">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="flex-1 relative">
        {loadFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 bg-anvil-bg">
            <Monitor className="w-10 h-10 text-anvil-muted mb-3" />
            <h3 className="text-sm font-medium text-white mb-1">
              {mode === 'direct' ? 'This site does not permit embedding' : 'Proxy could not load this page'}
            </h3>
            <p className="text-xs text-anvil-muted max-w-md mb-4">
              {mode === 'direct'
                ? 'Sites like Google block iframe embedding with X-Frame-Options / CSP. Switch to Proxy mode, or open the page in your default browser.'
                : 'The local proxy could not fetch this page. The site may block server requests or require JavaScript.'}
            </p>
            <div className="flex gap-2">
              {mode === 'direct' && (
                <button
                  onClick={() => {
                    setLoadFailed(false);
                    setMode('proxy');
                  }}
                  className="px-3 py-1.5 rounded bg-anvil-accent hover:bg-blue-600 text-xs text-white"
                >
                  Try Proxy Mode
                </button>
              )}
              <button
                onClick={() => {
                  setLoadFailed(false);
                  setLoading(true);
                }}
                className="px-3 py-1.5 rounded bg-anvil-border hover:bg-anvil-panelHover text-xs text-anvil-text"
              >
                Try Again
              </button>
              <button
                onClick={openExternal}
                className="px-3 py-1.5 rounded bg-anvil-border hover:bg-anvil-panelHover text-xs text-anvil-text"
              >
                Open in Browser
              </button>
            </div>
          </div>
        )}

        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title={currentUrl}
          className="w-full h-full border-none bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onLoad={() => {
            setLoading(false);
            setLoadFailed(false);
          }}
          onError={() => {
            setLoading(false);
            setLoadFailed(true);
          }}
        />
      </div>
    </div>
  );
}
