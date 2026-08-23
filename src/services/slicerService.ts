const BRIDGE_URL = import.meta.env.VITE_WORKSHOP_BRIDGE_URL || 'http://localhost:3001';

export interface SlicerParams {
  bedAdhesion: 'Cool Plate' | 'Engineering Plate' | 'Textured PEI' | 'Textured Cool Plate';
  infill: number;
  support: boolean;
}

export interface PrinterConfig {
  name: string;
  host: string;
  serialNumber: string;
  accessCode: string;
  model: 'p1p' | 'p1s' | 'x1c' | 'x1e' | 'a1' | 'a1mini' | 'h2d' | 'h2s' | 'h2c';
}

const STORAGE_KEY = 'anvil-printer-config';

export function loadPrinterConfig(): PrinterConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePrinterConfig(config: PrinterConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  notifyPrinterConfigChanged();
}

export function deletePrinterConfig() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('anvil-printer-config-changed'));
}

export function notifyPrinterConfigChanged() {
  window.dispatchEvent(new CustomEvent('anvil-printer-config-changed'));
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: 'Invalid bridge response' }));
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Bridge error ${res.status}`);
  }
  return data;
}

export async function checkBridgeHealth(): Promise<{ ok: boolean; bambuStudio: boolean; bambuCli: boolean }> {
  const res = await fetch(`${BRIDGE_URL}/health`);
  return await res.json();
}

export interface DiscoveredPrinter {
  name: string;
  host: string;
  serialNumber: string;
  model: string;
}

export async function discoverPrinters(): Promise<DiscoveredPrinter[]> {
  const res = await fetch(`${BRIDGE_URL}/printers/discover`);
  const data = await res.json().catch(() => ({ success: false, error: 'Invalid bridge response' }));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Bridge error ${res.status}`);
  }
  return data.printers || [];
}

export async function registerPrinterWithBridge(config: PrinterConfig) {
  return post('/printers', config);
}

export async function listBridgePrinters(): Promise<Pick<PrinterConfig, 'name' | 'host' | 'serialNumber' | 'model'>[]> {
  const res = await fetch(`${BRIDGE_URL}/printers`);
  const data = await res.json().catch(() => ({ success: false }));
  if (!res.ok || !data.success) return [];
  return data.printers || [];
}

export async function sliceModel(file: File, params: SlicerParams, model: PrinterConfig['model']) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return post('/slice', {
    filename: file.name,
    base64,
    params,
    model,
  });
}

export async function sendToPrinter(outputPath: string, printer: PrinterConfig) {
  return post('/print', {
    outputPath,
    printerName: printer.name,
  });
}
