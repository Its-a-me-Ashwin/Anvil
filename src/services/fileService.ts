const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export interface ResolvedPath {
  path: string;
  abs_path: string;
}

export async function resolveWorkspacePath(path: string): Promise<ResolvedPath> {
  const res = await fetch(`${API_BASE}/workspace/resolve?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Failed to resolve ${path} (${res.status})`);
  return res.json();
}
