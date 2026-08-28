import { useEffect } from 'react';
import { Video, FileText, Image as ImageIcon, Plus, Radio, Globe, Code, Box, CircuitBoard } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';

const typeIcons: Record<string, React.ElementType> = {
  web: Globe,
  youtube: Video,
  pdf: FileText,
  image: ImageIcon,
  video: Video,
  code: Code,
  slicer: Box,
  wiring: CircuitBoard,
  live: Radio,
};

function extractYouTubeVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.split('/')[2] || null;
      }
      return u.searchParams.get('v');
    }
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1) || null;
    }
  } catch {
    // fall through to regex fallback
  }
  const match = url.match(/(?:youtube\.com\/embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function BottomDataStrip() {
  const { currentProject, sources, loadSources } = useProjectStore();

  useEffect(() => {
    if (currentProject?.id) {
      loadSources(currentProject.id);
    }
  }, [currentProject?.id, loadSources]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 h-8 flex items-center justify-between border-b border-anvil-border shrink-0">
        <span className="text-xs font-semibold text-anvil-muted uppercase tracking-wider">Open Data Sources</span>
        <button className="text-anvil-muted hover:text-white">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-3 flex items-stretch gap-3">
        {!currentProject || sources.length === 0 ? (
          <div className="flex items-center justify-center w-full text-anvil-muted text-xs">
            No open data sources
          </div>
        ) : (
          sources.map((s, idx) => {
            const videoId = s.type === 'youtube' ? extractYouTubeVideoId(s.url) : null;
            const Icon = typeIcons[s.type] || Globe;
            return (
              <div
                key={`${s.title}-${idx}`}
                className="w-56 shrink-0 flex flex-col rounded-lg bg-anvil-bg border border-anvil-border overflow-hidden cursor-pointer hover:border-anvil-accent transition"
              >
                <div className="px-2.5 py-1.5 border-b border-anvil-border flex items-center justify-between">
                  <span className="text-xs font-medium text-anvil-text flex items-center gap-1.5 truncate pr-2">
                    {s.title}
                  </span>
                  <span className="text-[10px] text-anvil-muted uppercase shrink-0">{s.type}</span>
                </div>
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  {videoId ? (
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                      alt={s.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="w-8 h-8 text-anvil-muted" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
