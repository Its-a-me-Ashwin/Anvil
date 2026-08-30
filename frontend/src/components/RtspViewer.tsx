import { useEffect, useState } from 'react';
import { Camera, AlertTriangle } from 'lucide-react';
import { loadPrinterConfig, type PrinterConfig } from '../services/slicerService';
import { checkPrinterVision } from '../services/visionService';
import { usePrinterMonitorStore } from '../store/printerMonitorStore';

const BRIDGE_URL = import.meta.env.VITE_WORKSHOP_BRIDGE_URL || 'http://localhost:3001';
const FRAME_INTERVAL_MS = 2000;
const VISION_CHECK_INTERVAL_MS = 60000;

interface RtspViewerProps {
  // Kept only for compatibility with CenterWorkspace's existing tab wiring —
  // the camera now always comes from the registered printer, not a
  // manually entered URL.
  url?: string;
  onUrlChange?: (url: string) => void;
}

export default function RtspViewer(_props: RtspViewerProps) {
  const [printer, setPrinter] = useState<PrinterConfig | null>(() => loadPrinterConfig());
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const monitoringArmed = usePrinterMonitorStore((s) => s.monitoringArmed);
  const ollamaOffline = usePrinterMonitorStore((s) => s.ollamaOffline);
  const isSpaghetti = usePrinterMonitorStore((s) => s.isSpaghetti);
  const lastChecked = usePrinterMonitorStore((s) => s.lastChecked);
  const setVisionResult = usePrinterMonitorStore((s) => s.setResult);
  const setVisionError = usePrinterMonitorStore((s) => s.setError);

  useEffect(() => {
    const refresh = () => setPrinter(loadPrinterConfig());
    window.addEventListener('anvil-printer-config-changed', refresh);
    return () => window.removeEventListener('anvil-printer-config-changed', refresh);
  }, []);

  // Grab one JPEG frame at a time from the bridge (which itself opens a
  // fresh connection to the printer's camera per frame) — no persistent
  // video relay, just a still image refreshed on an interval.
  useEffect(() => {
    if (!printer?.name) return;
    const loadFrame = () => {
      const src = `${BRIDGE_URL}/camera/frame?printer=${encodeURIComponent(printer.name)}&t=${Date.now()}`;
      const img = new Image();
      img.onload = () => {
        setFrameSrc(src);
        setError(null);
      };
      img.onerror = () => setError('Could not reach the printer camera.');
      img.src = src;
    };
    loadFrame();
    const interval = setInterval(loadFrame, FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [printer?.name]);

  // Every minute while this tab is open — but only once Send to Printer has
  // armed monitoring; just opening this tab by hand never starts it.
  useEffect(() => {
    if (!printer?.name || !monitoringArmed) return;
    const check = () => {
      checkPrinterVision(printer.name)
        .then(setVisionResult)
        .catch((err) => setVisionError(err?.message || 'Vision check failed'));
    };
    check();
    const interval = setInterval(check, VISION_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [printer?.name, monitoringArmed, setVisionResult, setVisionError]);

  // Tick the "last refreshed" counter every second.
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const tick = () => {
      if (!lastChecked) {
        setSecondsAgo(0);
        return;
      }
      setSecondsAgo(Math.floor((Date.now() - new Date(lastChecked).getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastChecked]);

  return (
    <div className="h-full w-full flex flex-col bg-black">
      <div className="h-9 flex items-center gap-2 px-3 bg-anvil-panel border-b border-anvil-border shrink-0">
        <Camera className="w-3.5 h-3.5 text-anvil-muted" />
        <span className="text-xs text-anvil-text">
          {printer?.name ? `Printer Camera — ${printer.name}` : 'Printer Camera'}
        </span>
      </div>

      {monitoringArmed && ollamaOffline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-400 text-[11px] shrink-0">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Gemma is offline — spaghetti monitoring is unavailable right now.
        </div>
      )}

      {monitoringArmed && lastChecked && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 border-b shrink-0 text-[11px] ${
            isSpaghetti
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-green-500/10 border-green-500/30 text-green-400'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isSpaghetti ? 'bg-red-400' : 'bg-green-400'}`} />
          <span className="font-medium">{isSpaghetti ? 'Spaghetti detected' : 'Gemma OK'}</span>
          <span className="ml-auto opacity-80">Refreshed {secondsAgo}s ago</span>
        </div>
      )}

      <div className="flex-1 relative">
        {!printer?.name ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-anvil-muted p-6">
            <Camera className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium text-white">No printer configured</p>
            <p className="text-xs mt-1 max-w-md">Register your Bambu printer in Settings → Printer to see its camera here.</p>
          </div>
        ) : frameSrc ? (
          <img src={frameSrc} alt="Live printer camera" className="w-full h-full object-contain bg-black" />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-anvil-muted p-6">
            <Camera className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium text-white">Stream could not be played</p>
            <p className="text-xs mt-1 max-w-md">{error} Check that the printer is online and the Workshop Bridge is running.</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-anvil-muted p-6">
            <Camera className="w-10 h-10 mb-3 animate-pulse" />
            <p className="text-sm font-medium text-white">Connecting to printer camera...</p>
          </div>
        )}
      </div>
    </div>
  );
}
