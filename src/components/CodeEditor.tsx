import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { FolderOpen, FileCode, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { getLanguageFromFileName } from '../lib/fileTypes';

interface FileNode {
  name: string;
  kind: 'file' | 'directory';
  handle?: FileSystemFileHandle;
  children?: FileNode[];
}

interface CodeEditorProps {
  content?: string;
  fileName?: string;
  onChange?: (value: string) => void;
}

export default function CodeEditor({ content: initialContent, fileName: initialFileName, onChange }: CodeEditorProps) {
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<{ name: string; content: string; handle?: FileSystemFileHandle } | null>(
    initialContent != null ? { name: initialFileName || 'untitled', content: initialContent } : null
  );

  const openFolder = async () => {
    try {
      // @ts-ignore — File System Access API may not be in all DOM lib versions
      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);
      const nodes = await buildTree(handle);
      setTree(nodes);
    } catch (err) {
      console.log('Folder picker cancelled or unsupported', err);
    }
  };

  const buildTree = async (dirHandle: FileSystemDirectoryHandle): Promise<FileNode[]> => {
    const nodes: FileNode[] = [];
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        nodes.push({ name: entry.name, kind: 'directory', children: [] });
      } else {
        nodes.push({ name: entry.name, kind: 'file', handle: entry });
      }
    }
    return nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
  };

  const loadDirectoryChildren = async (node: FileNode, path: string) => {
    if (!directoryHandle) return;
    const parts = path.split('/');
    let current: FileSystemDirectoryHandle = directoryHandle;
    for (const part of parts) {
      if (!part) continue;
      current = await current.getDirectoryHandle(part);
    }
    const children = await buildTree(current);
    node.children = children;
    setTree([...tree]);
  };

  const openFile = async (node: FileNode) => {
    if (!node.handle) return;
    const file = await node.handle.getFile();
    const text = await file.text();
    setActiveFile({ name: node.name, content: text, handle: node.handle });
    onChange?.(text);
  };

  const toggleDir = (node: FileNode, path: string) => {
    const next = new Set(openDirs);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      if (!node.children || node.children.length === 0) loadDirectoryChildren(node, path);
    }
    setOpenDirs(next);
  };

  const renderTree = (nodes: FileNode[], path = '') => (
    <ul className="pl-2">
      {nodes.map((node) => {
        const nodePath = path ? `${path}/${node.name}` : node.name;
        const isOpen = openDirs.has(nodePath);
        return (
          <li key={nodePath} className="select-none">
            <div
              className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-anvil-panelHover cursor-pointer text-xs text-anvil-text"
              onClick={() => (node.kind === 'directory' ? toggleDir(node, nodePath) : openFile(node))}
            >
              {node.kind === 'directory' ? (
                <>
                  {isOpen ? <ChevronDown className="w-3 h-3 text-anvil-muted" /> : <ChevronRight className="w-3 h-3 text-anvil-muted" />}
                  <Folder className="w-3.5 h-3.5 text-anvil-accent" />
                </>
              ) : (
                <>
                  <span className="w-3" />
                  <FileCode className="w-3.5 h-3.5 text-anvil-muted" />
                </>
              )}
              <span className="truncate">{node.name}</span>
            </div>
            {node.kind === 'directory' && isOpen && node.children && renderTree(node.children, nodePath)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="h-full w-full flex">
      {directoryHandle ? (
        <div className="w-52 bg-anvil-panel border-r border-anvil-border flex flex-col">
          <div className="h-8 flex items-center px-3 border-b border-anvil-border">
            <span className="text-xs font-semibold text-anvil-muted uppercase tracking-wider">Explorer</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">{renderTree(tree)}</div>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0">
        {!activeFile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-anvil-muted">
            <FileCode className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium text-white mb-1">No file open</p>
            <button
              onClick={openFolder}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded bg-anvil-accent hover:bg-blue-600 text-white text-xs"
            >
              <FolderOpen className="w-4 h-4" />
              Open Local Folder
            </button>
          </div>
        ) : (
          <>
            <div className="h-8 flex items-center px-3 bg-anvil-panel border-b border-anvil-border text-xs text-anvil-text">
              {activeFile.name}
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage={getLanguageFromFileName(activeFile.name)}
                value={activeFile.content}
                onChange={(value) => {
                  if (value != null) {
                    setActiveFile((prev) => (prev ? { ...prev, content: value } : prev));
                    onChange?.(value);
                  }
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 8 },
                }}
              />
            </div>
          </>
        )}

        {activeFile && !directoryHandle && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              onClick={openFolder}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-anvil-panelHover border border-anvil-border text-anvil-text text-xs hover:border-anvil-accent"
            >
              <FolderOpen className="w-4 h-4" />
              Open Local Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
