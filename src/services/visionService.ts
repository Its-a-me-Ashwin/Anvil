const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

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

export async function checkPrinterVision(): Promise<PrinterVisionResult> {
  const res = await fetch(`${API_BASE}/vision/monitor`, { method: 'POST' });
  if (!res.ok) throw new Error(`Vision check failed (${res.status})`);
  return res.json();
}
