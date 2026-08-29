import { create } from 'zustand';

interface PrinterVisionResult {
  isBedEmpty: boolean | null;
  isSpaghetti: boolean | null;
  isPrinting: boolean | null;
}

interface PrinterMonitorState {
  isBedEmpty: boolean | null;
  isSpaghetti: boolean;
  isPrinting: boolean | null;
  lastChecked: string | null;
  error: string | null;
  setResult: (result: PrinterVisionResult) => void;
  setError: (error: string) => void;
  dismissSpaghetti: () => void;
}

export const usePrinterMonitorStore = create<PrinterMonitorState>((set) => ({
  isBedEmpty: null,
  isSpaghetti: false,
  isPrinting: null,
  lastChecked: null,
  error: null,

  setResult: (result) =>
    set({
      isBedEmpty: result.isBedEmpty ?? null,
      isSpaghetti: !!result.isSpaghetti,
      isPrinting: result.isPrinting ?? null,
      lastChecked: new Date().toISOString(),
      error: null,
    }),

  setError: (error) => set({ error }),

  dismissSpaghetti: () => set({ isSpaghetti: false }),
}));
