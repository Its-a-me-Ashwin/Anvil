import { AlertTriangle } from 'lucide-react';
import { usePrinterMonitorStore } from '../store/printerMonitorStore';

// Global, tab-independent — the printer camera monitor checks for spaghetti
// once a minute while the Printer Camera tab is open, but the user may well
// be looking at a different tab when it happens, so this shows up regardless
// of what's active.
export default function PrinterAlertBanner() {
  const isSpaghetti = usePrinterMonitorStore((s) => s.isSpaghetti);
  const dismissSpaghetti = usePrinterMonitorStore((s) => s.dismissSpaghetti);

  if (!isSpaghetti) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs shrink-0">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1">Possible failed print detected (spaghetti) on the printer bed.</span>
      <button onClick={dismissSpaghetti} className="underline hover:text-red-300 shrink-0">
        Dismiss
      </button>
    </div>
  );
}
