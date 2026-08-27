import { create } from 'zustand';

export interface Project {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  session_id?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | string;
  text: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  messages: ChatMessage[];
  setCurrentProject: (project: Project | null, messages?: ChatMessage[]) => void;
  addMessage: (role: ChatMessage['role'], text: string) => void;
  loadProjects: () => Promise<void>;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  messages: [],

  setCurrentProject: (project, messages) =>
    set((state) => ({
      currentProject: project,
      messages: messages !== undefined ? messages : state.messages,
    })),

  addMessage: (role, text) =>
    set((state) => ({
      messages: [...state.messages, { role, text }],
    })),

  loadProjects: async () => {
    const { listProjects } = await import('../services/agentService');
    const data = await listProjects();
    set({ projects: data.projects || [] });
  },

  clearCurrentProject: () => set({ currentProject: null, messages: [] }),
}));
