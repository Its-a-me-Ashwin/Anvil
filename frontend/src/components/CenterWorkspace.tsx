import { useState, useRef, useEffect } from 'react';
import { Plus, X, Globe, FileCode, FileText, Image as ImageIcon, Video, Play, MousePointer2, Upload, Search, Code, Box, CircuitBoard, Camera } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useProjectStore } from '../store/projectStore';
import { addSource } from '../services/agentService';
import { detectTypeFromName } from '../lib/fileTypes';
import WebViewer from './WebViewer';
import CodeEditor from './CodeEditor';
import CodeServerWorkspace from './CodeServerWorkspace';
import SearchWorkspace from './SearchWorkspace';
import PdfViewer from './PdfViewer';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import YouTubeViewer from './YouTubeViewer';
import SlicerWorkspace from './SlicerWorkspace';
import WiringDiagram from './wiring/WiringDiagram';
import type { WiringDiagramData } from './wiring/wiringTypes';
import UnknownViewer from './UnknownViewer';
import RtspViewer from './RtspViewer';
import TabErrorBoundary from './TabErrorBoundary';

const icons: Record<string, React.ElementType> = {
  web: Globe,
  code: FileCode,
  codeserver: Code,
  search: Search,
  pdf: FileText,
  image: ImageIcon,
  video: Video,
  youtube: Play,
  slicer: Box,
  wiring: CircuitBoard,
  rtsp: Camera,
  unknown: MousePointer2,
};

export default function CenterWorkspace() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTab } = useWorkspaceStore();
  const { currentProject, loadSources } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const trackSource = async (type: string, title: string, url?: string) => {
    if (!currentProject) return;
    try {
      await addSource(currentProject.id, { type, title, url, added_at: new Date().toISOString() });
      await loadSources(currentProject.id);
    } catch {
      // Ignore source tracking errors so the workspace action still works.
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await openFile(file);
    }
  };

  const openFile = async (file: File) => {
    const type = detectTypeFromName(file.name);
    if (type === 'slicer') {
      addTab({ title: file.name, type: 'slicer', file });
      await trackSource('slicer', file.name);
    } else if (type === 'code' || type === 'unknown') {
      const text = await file.text();
      addTab({ title: file.name, type: 'code', content: text, fileName: file.name, file });
      await trackSource('code', file.name);
    } else if (type === 'pdf') {
      addTab({ title: file.name, type: 'pdf', file });
      // Blob URLs only resolve in this tab for this session — the data
      // source card's preview falls back to a plain icon once it's stale
      // (e.g. after a reload), rather than persisting real file storage.
      await trackSource('pdf', file.name, URL.createObjectURL(file));
    } else if (type === 'image') {
      addTab({ title: file.name, type: 'image', file });
      await trackSource('image', file.name, URL.createObjectURL(file));
    } else if (type === 'video') {
      addTab({ title: file.name, type: 'video', file });
      await trackSource('video', file.name, URL.createObjectURL(file));
    }
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Opening a workspace tool tab isn't itself a "data source" — only the
  // real content the user or agent actually brings in (an upload, a
  // grounded search result) should ever land in the Data Sources strip.
  const newWebTab = () => {
    addTab({ title: 'Browser', type: 'web', url: 'https://example.com' });
  };

  const newCodeServerTab = () => {
    addTab({ title: 'VS Code', type: 'codeserver', url: 'http://localhost:8080' });
  };
  const newYouTubeTab = () => {
    addTab({ title: 'YouTube', type: 'youtube', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
  };
  const newSlicerTab = () => {
    addTab({ title: 'Bambu Slicer', type: 'slicer' });
  };
  const newWiringTab = () => {
    addTab({ title: 'Wiring Diagram', type: 'wiring' });
  };
  const newRtspTab = () => {
    addTab({ title: 'Printer Camera', type: 'rtsp', url: '' });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await openFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full w-full flex flex-col" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" multiple />

      {/* Tab bar */}
      <div className="h-10 flex items-center border-b border-anvil-border bg-anvil-panel px-1 overflow-visible">
        {tabs.map((tab) => {
          const Icon = icons[tab.type] || MousePointer2;
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group h-full px-3 flex items-center gap-2 border-t-2 text-xs cursor-pointer transition whitespace-nowrap ${
                isActive
                  ? 'border-anvil-accent bg-anvil-panelHover text-white'
                  : 'border-transparent text-anvil-muted hover:bg-anvil-panelHover hover:text-anvil-text'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-anvil-muted hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <div className="relative z-50" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-full px-2 text-anvil-muted hover:text-white"
            title="New tab"
          >
            <Plus className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 rounded-lg bg-anvil-panel border border-anvil-border shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-semibold text-anvil-muted uppercase tracking-wider">Open Workspace</div>
              <button
                onClick={() => { newWebTab(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-anvil-text hover:bg-anvil-panelHover flex items-center gap-2"
              >
                <Globe className="w-3.5 h-3.5 text-anvil-accent" /> Browser
              </button>
              <button
                onClick={() => { newCodeServerTab(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-anvil-text hover:bg-anvil-panelHover flex items-center gap-2"
              >
                <Code className="w-3.5 h-3.5 text-blue-400" /> VS Code
              </button>
              <button
                onClick={() => { newYouTubeTab(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-anvil-text hover:bg-anvil-panelHover flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-red-500" /> YouTube
              </button>
              <button
                onClick={() => { newSlicerTab(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-anvil-text hover:bg-anvil-panelHover flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-purple-400" /> Bambu Slicer
              </button>
              <button
                onClick={() => { newWiringTab(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-anvil-text hover:bg-anvil-panelHover flex items-center gap-2"
              >
                <CircuitBoard className="w-3.5 h-3.5 text-yellow-400" /> Wiring Diagram
              </button>
              <button
                onClick={() => { newRtspTab(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-anvil-text hover:bg-anvil-panelHover flex items-center gap-2"
              >
                <Camera className="w-3.5 h-3.5 text-green-400" /> Printer Camera
              </button>
            </div>
          )}
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="h-full px-2 text-anvil-muted hover:text-white" title="Open file">
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-anvil-accent/10 border-2 border-dashed border-anvil-accent flex flex-col items-center justify-center text-anvil-accent">
            <Upload className="w-10 h-10 mb-2" />
            <p className="text-sm font-medium">Drop files here to open</p>
            <p className="text-xs opacity-80">PDFs, code, images, videos</p>
          </div>
        )}

        {activeTab ? (
          <TabErrorBoundary key={activeTab.id} onClose={() => closeTab(activeTab.id)}>
          <div className="h-full w-full">
            {activeTab.type === 'web' && <WebViewer url={activeTab.url || 'https://example.com'} onUrlChange={(url) => updateTab(activeTab.id, { url })} />}
            {activeTab.type === 'code' && <CodeEditor content={activeTab.content} fileName={activeTab.fileName} onChange={(content) => updateTab(activeTab.id, { content })} />}
            {activeTab.type === 'codeserver' && <CodeServerWorkspace url={activeTab.url} />}
            {activeTab.type === 'search' && <SearchWorkspace />}
            {activeTab.type === 'pdf' && <PdfViewer file={activeTab.file} url={activeTab.url} />}
            {activeTab.type === 'image' && <ImageViewer file={activeTab.file} url={activeTab.url} />}
            {activeTab.type === 'video' && <VideoViewer file={activeTab.file} url={activeTab.url} />}
            {activeTab.type === 'youtube' && <YouTubeViewer url={activeTab.url} />}
            {activeTab.type === 'slicer' && <SlicerWorkspace file={activeTab.file} />}
            {activeTab.type === 'wiring' && (
              <WiringDiagram data={(activeTab.content ? JSON.parse(activeTab.content) : { modules: [], connections: [] }) as WiringDiagramData} onDelete={() => closeTab(activeTab.id)} />
            )}
            {activeTab.type === 'rtsp' && <RtspViewer url={activeTab.url || ''} onUrlChange={(url) => updateTab(activeTab.id, { url })} />}
            {activeTab.type === 'unknown' && <UnknownViewer title={activeTab.title} />}
          </div>
          </TabErrorBoundary>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-anvil-muted">
            <div className="text-center">
              <MousePointer2 className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm font-medium text-white">Center Workspace</p>
              <p className="text-xs mt-1 max-w-xs">Open a tab, enter a URL, or drop a file here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
