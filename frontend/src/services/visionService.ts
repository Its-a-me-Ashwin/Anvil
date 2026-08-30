const BRIDGE_URL = import.meta.env.VITE_WORKSHOP_BRIDGE_URL || 'http://localhost:3001';

export interface PrinterVisionResult {
  ok: boolean;
  isBedEmpty?: boolean | null;
  isSpaghetti?: boolean | null;
  isPrinting?: boolean | null;
  // Only present when ok is false — lets the caller tell "Gemma/Ollama is
  // offline" apart from a camera/network failure instead of parsing a raw
  // error string.
  reason?: 'camera' | 'ollama' | 'parse';
  error?: string;
}

export async function checkPrinterVision(printerName?: string): Promise<PrinterVisionResult> {
  const params = printerName ? `?printer=${encodeURIComponent(printerName)}` : '';
  const res = await fetch(`${BRIDGE_URL}/vision/monitor${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Vision check failed (${res.status})`);
  return res.json();
}
