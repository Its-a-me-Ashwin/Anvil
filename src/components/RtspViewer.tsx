import { useEffect, useRef, useState } from 'react';
import { Camera, ExternalLink, RefreshCw } from 'lucide-react';

const BRIDGE_URL = import.meta.env.VITE_WORKSHOP_BRIDGE_URL || 'http://localhost:3001';

interface RtspViewerProps {
  url: string;
  onUrlChange?: (url: string) => void;
}

export default function RtspViewer({ url, onUrlChange }: RtspViewerProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [reloadKey, setReloadKey] = useState(0);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [loadingRelay, setLoadingRelay] = useState(!url);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (currentUrl) return;
    let cancelled = false;
    setLoadingRelay(true);
    fetch(`${BRIDGE_URL}/camera`)
      .then(async (response) => {
        if (!response.ok) throw new Error('No configured printer camera.');
        return response.json();
      })
      .then((data: { url?: string }) => {
        if (cancelled || !data.url) return;
        setCurrentUrl(data.url);
        setInputUrl(data.url);
        onUrlChange?.(data.url);
      })
      .catch(() => {
        if (!cancelled) setPlaybackFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingRelay(false);
      });
    return () => { cancelled = true; };
  }, [currentUrl, onUrlChange]);

  useEffect(() => {
    if (!currentUrl) return;
    setPlaybackFailed(false);
    videoRef.current?.play().catch(() => setPlaybackFailed(true));
  }, [currentUrl, reloadKey]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextUrl = inputUrl.trim();
    if (!nextUrl) return;
    setCurrentUrl(nextUrl);
    setPlaybackFailed(false);
    onUrlChange?.(nextUrl);
  };

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <form onSubmit={handleSubmit} className="h-9 flex items-center gap-2 px-3 bg-anvil-panel border-b border-anvil-border shrink-0">
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="text-anvil-muted hover:text-white" title="Refresh stream">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 flex items-center px-2 py-1 rounded bg-anvil-bg border border-anvil-border focus-within:border-anvil-accent">
          <Camera className="w-3.5 h-3.5 text-anvil-muted mr-2" />
          <input
            type="text"
            value={inputUrl}
            onChange={(event) => setInputUrl(event.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs text-anvil-text"
            placeholder="Enter RTSP or browser-compatible stream URL..."
          />
        </div>
        <button type="button" onClick={() => window.open(currentUrl, '_blank', 'noopener,noreferrer')} disabled={!currentUrl} className="text-anvil-muted hover:text-white disabled:opacity-40" title="Open stream in browser">
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="flex-1 relative">
        {loadingRelay ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-anvil-muted p-6">
            <Camera className="w-10 h-10 mb-3 animate-pulse" />
            <p className="text-sm font-medium text-white">Connecting to printer camera...</p>
          </div>
        ) : currentUrl ? (
          <>
            <video
              key={`${currentUrl}-${reloadKey}`}
              ref={videoRef}
              src={currentUrl}
              title="Live printer camera"
              className="w-full h-full object-contain bg-black"
              autoPlay
              muted
              playsInline
              controls
              onLoadedData={() => {
                setPlaybackFailed(false);
                videoRef.current?.play().catch(() => setPlaybackFailed(true));
              }}
              onError={() => setPlaybackFailed(true)}
            />
            {playbackFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-anvil-muted p-6 bg-black/90">
                <Camera className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-white">Stream could not be played</p>
                <p className="text-xs mt-1 max-w-md">The local camera relay could not connect. Check that the printer is online and the Workshop Bridge is running.</p>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-anvil-muted p-6">
            <Camera className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium text-white">No printer camera configured</p>
            <p className="text-xs mt-1 max-w-md">Enter an RTSP URL or a browser-compatible relay URL, such as a go2rtc stream page, then press Enter.</p>
          </div>
        )}
      </div>
    </div>
  );
}