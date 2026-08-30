import type { WiringDiagramData } from '../components/wiring/wiringTypes';

const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export async function getWiringDiagram(projectId: string): Promise<WiringDiagramData> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/circuit`);
  if (!res.ok) throw new Error(`Failed to fetch wiring diagram (${res.status})`);
  return res.json();
}
