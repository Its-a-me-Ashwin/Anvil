const CODE_SERVER_URL = import.meta.env.VITE_CODE_SERVER_URL || 'http://localhost:8080';

// VS Code Server's web workbench accepts a `payload` query param — a JSON
// array of [command, arg] tuples — as a deep-link mechanism. `openFile`
// with a `vscode-remote://<absolute-path>` URI opens that file as an
// editor tab in the already-running workbench (verified against
// `code serve-web`, not just cdr/code-server's fork).
export function buildVsCodeOpenUrl(absPaths: string[]): string {
  const payload = absPaths.map((p) => ['openFile', `vscode-remote://${encodeURI(p)}`]);
  return `${CODE_SERVER_URL}/?payload=${encodeURIComponent(JSON.stringify(payload))}`;
}
