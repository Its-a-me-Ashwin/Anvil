import { create } from 'zustand';
import { getProjectState, type ProjectState as ProjectStateData, type ToolCall } from '../services/agentService';

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
  tool_calls?: ToolCall[];
}

interface ProjectStoreState {
  projects: Project[];
  currentProject: Project | null;
  messages: ChatMessage[];
  projectState: ProjectStateData | null;
  setCurrentProject: (project: Project | null, messages?: ChatMessage[]) => void;
  addMessage: (role: ChatMessage['role'], text: string, tool_calls?: ToolCall[]) => void;
  loadProjects: () => Promise<void>;
  clearCurrentProject: () => void;
  refreshProjectState: (projectId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  projects: [],
  currentProject: null,
  messages: [],
  projectState: null,

  setCurrentProject: (project, messages) =>
    set((state) => ({
      currentProject: project,
      messages: messages !== undefined ? messages : state.messages,
      // Project state (objective/constraints/inventory/etc.) is always
      // server-derived, never optimistically written locally, so there's
      // no "preserve" case to worry about the way there is for messages —
      // just clear it and let refreshProjectState repopulate it.
      projectState: null,
    })),

  addMessage: (role, text, tool_calls) =>
    set((state) => ({
      messages: [...state.messages, tool_calls?.length ? { role, text, tool_calls } : { role, text }],
    })),

  loadProjects: async () => {
    const { listProjects } = await import('../services/agentService');
    const data = await listProjects();
    set({ projects: data.projects || [] });
  },

  clearCurrentProject: () => set({ currentProject: null, messages: [], projectState: null }),

  refreshProjectState: async (projectId) => {
    try {
      const data = await getProjectState(projectId);
      set({ projectState: data });
    } catch {
      // Leave the previous projectState in place if the fetch fails —
      // better a stale panel than a blank one on a transient error.
    }
  },
}));
