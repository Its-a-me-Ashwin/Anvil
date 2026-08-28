const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export interface CadMeta {
  part_count: number;
  mtime: number | null;
}

export async function getCadMeta(projectId: string): Promise<CadMeta> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/cad/meta`);
  if (!res.ok) throw new Error(`Failed to fetch CAD meta (${res.status})`);
  return res.json();
}

export async function fetchCadModel(projectId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/cad/model.stl`);
  if (!res.ok) throw new Error(`Failed to fetch CAD model (${res.status})`);
  return res.arrayBuffer();
}
