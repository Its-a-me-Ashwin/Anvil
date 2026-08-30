import { create } from 'zustand';

export interface Activity {
  id: string;
  method: string;
  url: string;
  status: number;
  timestamp: number;
}

interface ActivityState {
  activities: Activity[];
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => void;
  clearActivities: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  addActivity: (activity) =>
    set((state) => {
      const items = [
        { ...activity, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() },
        ...state.activities,
      ];
      return { activities: items.slice(0, 100) };
    }),
  clearActivities: () => set({ activities: [] }),
}));
