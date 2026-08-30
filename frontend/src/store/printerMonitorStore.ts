import { create } from 'zustand';
import type { PrinterVisionResult } from '../services/visionService';

interface PrinterMonitorState {
  // Gemma monitoring only ever runs once this is true (set by Send to
  // Printer) *and* the Printer Camera tab is open — merely opening the tab
  // by hand does not start it.
  monitoringArmed: boolean;
  isBedEmpty: boolean | null;
  isSpaghetti: boolean;
  isPrinting: boolean | null;
  ollamaOffline: boolean;
  lastChecked: string | null;
  error: string | null;
  armMonitoring: () => void;
  setResult: (result: PrinterVisionResult) => void;
  setError: (error: string) => void;
  dismissSpaghetti: () => void;
}

export const usePrinterMonitorStore = create<PrinterMonitorState>((set) => ({
  monitoringArmed: false,
  isBedEmpty: null,
  isSpaghetti: false,
  isPrinting: null,
  ollamaOffline: false,
  lastChecked: null,
  error: null,

  armMonitoring: () => set({ monitoringArmed: true }),

  setResult: (result) => {
    if (!result.ok) {
      set({
        ollamaOffline: result.reason === 'ollama',
        error: result.error || null,
        lastChecked: new Date().toISOString(),
      });
      return;
    }
    set({
      isBedEmpty: result.isBedEmpty ?? null,
      isSpaghetti: !!result.isSpaghetti,
      isPrinting: result.isPrinting ?? null,
      ollamaOffline: false,
      error: null,
      lastChecked: new Date().toISOString(),
    });
  },

  setError: (error) => set({ error }),

  dismissSpaghetti: () => set({ isSpaghetti: false }),
}));
