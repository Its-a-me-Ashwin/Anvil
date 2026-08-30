const CODE_SERVER_URL = import.meta.env.VITE_CODE_SERVER_URL || 'http://localhost:8080';

// VS Code Server's web workbench accepts a `payload` query param — a JSON
// array of [command, arg] tuples — as a deep-link mechanism. `openFile`
// with a `vscode-remote://<absolute-path>` URI opens that file as an
// editor tab in the already-running workbench (verified against
// `code serve-web`, not just cdr/code-server's fork).
//
// `workspaceAbsPath`, when given, points at a .code-workspace file and is
// passed as the `workspace` query param (same `vscode-remote://` scheme) to
// re-root the workbench at that workspace instead of whatever the server's
// default is. A .code-workspace file (rather than a plain `folder` link) is
// what lets the tab display the project's actual name — the sandbox folder
// on disk is named after the stable project id, not the (renameable,
// possibly-colliding) project name, and a workspace file's `folders[].name`
// is the layer that decouples the two. Also verified against `code
// serve-web`: the tab title and explorer both switch to just that folder,
// under the given display name.
//
// `folderAbsPath` is the plain-folder equivalent, for callers that only have
// a raw directory (no .code-workspace file to point at — e.g. no backend
// access to write one there). Passing a bare folder path as `workspace`
// instead of `folder` looks like it works (no error) but silently shows
// "No Folder Opened" — `workspace` is parsed strictly as a .code-workspace
// file, not a directory. At most one of the two should be given.
export function buildVsCodeOpenUrl(absPaths: string[], workspaceAbsPath?: string, folderAbsPath?: string): string {
  const payload = absPaths.map((p) => ['openFile', `vscode-remote://${encodeURI(p)}`]);
  const params = new URLSearchParams();
  if (workspaceAbsPath) params.set('workspace', `vscode-remote://${encodeURI(workspaceAbsPath)}`);
  else if (folderAbsPath) params.set('folder', `vscode-remote://${encodeURI(folderAbsPath)}`);
  params.set('payload', JSON.stringify(payload));
  return `${CODE_SERVER_URL}/?${params.toString()}`;
}
