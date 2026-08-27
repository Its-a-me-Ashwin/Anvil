import { create } from 'zustand';

export type TabType = 'web' | 'code' | 'codeserver' | 'search' | 'pdf' | 'image' | 'video' | 'youtube' | 'slicer' | 'wiring' | 'unknown';

export interface WorkspaceTab {
  id: string;
  title: string;
  type: TabType;
  url?: string;
  content?: string;
  fileName?: string;
  fileHandle?: FileSystemFileHandle;
  file?: File;
}

interface WorkspaceState {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  addTab: (tab: Omit<WorkspaceTab, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<WorkspaceTab>) => void;
}

let counter = 0;

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) => {
    const id = `tab-${++counter}-${Date.now()}`;
    const newTab: WorkspaceTab = { ...tab, id };
    set((state) => ({ tabs: [...state.tabs, newTab], activeTabId: id }));
  },

  closeTab: (id) => {
    set((state) => {
      const filtered = state.tabs.filter((t) => t.id !== id);
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        const idx = state.tabs.findIndex((t) => t.id === id);
        activeTabId = filtered[idx - 1]?.id || filtered[idx]?.id || null;
      }
      return { tabs: filtered, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));
