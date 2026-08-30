import type { ToolCall } from '../services/agentService';

export const FILESYSTEM_TOOLS = new Set([
  'read_text_file',
  'write_file',
  'edit_file',
  'search_files',
  'list_directory',
  'get_file_info',
]);

export function isFilesystemTool(call: ToolCall | undefined): boolean {
  return call != null && FILESYSTEM_TOOLS.has(call.name);
}

function normalizePath(path: string): string[] {
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean || clean === '.') return [];
  const parts = clean.split('/').filter(Boolean);
  if (parts.some((p) => p === '..')) {
    throw new Error('paths may not escape the project root');
  }
  return parts;
}

async function getDirectoryHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemDirectoryHandle> {
  const parts = normalizePath(path);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

export async function getFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemFileHandle> {
  const parts = normalizePath(path);
  if (parts.length === 0) {
    throw new Error('path must include a file name');
  }
  const dirParts = parts.slice(0, -1);
  const fileName = parts[parts.length - 1];
  const dir = dirParts.length ? await getDirectoryHandle(root, dirParts.join('/'), create) : root;
  return dir.getFileHandle(fileName, { create });
}

async function readTextFile(root: FileSystemDirectoryHandle, path: string): Promise<string> {
  const handle = await getFileHandle(root, path, false);
  const file = await handle.getFile();
  return file.text();
}

async function writeFile(root: FileSystemDirectoryHandle, path: string, content: string): Promise<string> {
  const handle = await getFileHandle(root, path, true);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  return `Wrote ${path}`;
}

async function editFile(
  root: FileSystemDirectoryHandle,
  path: string,
  edits: { oldText: string; newText: string }[]
): Promise<string> {
  const handle = await getFileHandle(root, path, false);
  const file = await handle.getFile();
  let text = await file.text();
  for (const edit of edits) {
    if (!text.includes(edit.oldText)) {
      throw new Error(`edit_file could not find the requested text in ${path}`);
    }
    text = text.split(edit.oldText).join(edit.newText);
  }
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  return `Edited ${path}`;
}

async function listDirectory(root: FileSystemDirectoryHandle, path: string): Promise<string> {
  const dir = await getDirectoryHandle(root, path, false);
  const entries: string[] = [];
  // @ts-ignore — FileSystemDirectoryHandle.values() is async iterable
  for await (const entry of dir.values()) {
    entries.push(entry.name);
  }
  return entries.sort().join('\n');
}

async function getFileInfo(root: FileSystemDirectoryHandle, path: string): Promise<string> {
  const handle = await getFileHandle(root, path, false);
  const file = await handle.getFile();
  return JSON.stringify({
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  });
}

async function searchFiles(root: FileSystemDirectoryHandle, path: string, pattern: string): Promise<string> {
  const matches: string[] = [];
  const re = new RegExp(pattern, 'i');

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    // @ts-ignore
    for await (const entry of dir.values()) {
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        // @ts-ignore
        await walk(await dir.getDirectoryHandle(entry.name), entryPath);
      } else {
        if (re.test(entry.name)) {
          matches.push(entryPath);
          continue;
        }
        try {
          const handle = await dir.getFileHandle(entry.name);
          const file = await handle.getFile();
          if (file.size > 1024 * 1024) continue; // skip files larger than 1MB
          const text = await file.text();
          if (re.test(text)) {
            matches.push(entryPath);
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  const start = await getDirectoryHandle(root, path, false);
  await walk(start, normalizePath(path).join('/'));
  return matches.length ? matches.join('\n') : 'No matches found';
}

export async function executeFilesystemTool(
  root: FileSystemDirectoryHandle,
  call: ToolCall
): Promise<string> {
  const { name, args } = call;
  const path = typeof args?.path === 'string' ? args.path : '';

  switch (name) {
    case 'read_text_file':
      return await readTextFile(root, path);
    case 'write_file':
      return await writeFile(root, path, String(args?.content ?? ''));
    case 'edit_file': {
      const edits = Array.isArray(args?.edits) ? args.edits : [];
      return await editFile(
        root,
        path,
        edits.map((e: any) => ({ oldText: String(e.oldText ?? ''), newText: String(e.newText ?? '') }))
      );
    }
    case 'list_directory':
      return await listDirectory(root, path);
    case 'get_file_info':
      return await getFileInfo(root, path);
    case 'search_files':
      return await searchFiles(root, path, String(args?.pattern ?? ''));
    default:
      throw new Error(`unknown filesystem tool: ${name}`);
  }
}
