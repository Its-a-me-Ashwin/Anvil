const rawBase = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';
const API_BASE = rawBase.replace(/\/$/, '');

export async function resolveRemoteToolCall(callId: string, result: string) {
  const res = await fetch(`${API_BASE}/tool-results/${callId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Tool result failed: ${text}`);
  }
}

export async function rejectRemoteToolCall(callId: string, error: string) {
  const res = await fetch(`${API_BASE}/tool-results/${callId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Tool rejection failed: ${text}`);
  }
}

export interface PendingRemoteCall {
  call_id: string;
  tool?: string;
  path?: string;
}

export async function getPendingRemoteCalls(): Promise<PendingRemoteCall[]> {
  const res = await fetch(`${API_BASE}/tool-results/pending`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.pending || [];
}
