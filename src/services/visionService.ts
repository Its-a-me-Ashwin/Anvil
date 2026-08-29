const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export interface PrinterVisionResult {
  isBedEmpty: boolean | null;
  isSpaghetti: boolean | null;
  isPrinting: boolean | null;
}

export async function checkPrinterVision(): Promise<PrinterVisionResult> {
  const res = await fetch(`${API_BASE}/vision/monitor`, { method: 'POST' });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Vision check failed (${res.status})`);
  }
  return res.json();
}
