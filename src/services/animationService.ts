const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export function animationUrl(projectId: string, filename: string): string {
  return `${API_BASE}/projects/${projectId}/animation/${filename}`;
}
