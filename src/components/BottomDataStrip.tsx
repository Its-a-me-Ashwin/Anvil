import { useEffect, useRef, useState } from 'react';
import { Video, FileText, Image as ImageIcon, Radio, Globe, Code, Box, CircuitBoard, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { SourceItem } from '../services/agentService';

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

function hostnameOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// A rich-link-style tile: the real page title up front (the backend
// resolves this server-side from the page's own <title>, since Gemini's
// grounding metadata only ever gives us the bare domain), with a small
// favicon + domain byline underneath for context. Real favicons vary
// wildly in native size/padding/color, so they sit in a fixed white chip
// with object-contain to read as a consistent row instead of a mismatch.
function WebSourceCard({ s }: { s: SourceItem }) {
  const [failed, setFailed] = useState(false);
  const host = s.domain || hostnameOf(s.url) || s.title;
  const isTitleJustTheDomain = s.title === host;

  return (
    <a
      href={s.url || undefined}
      target={s.url ? '_blank' : undefined}
      rel="noreferrer"
      title={s.url || s.title}
      className="group relative w-56 shrink-0 flex flex-col justify-center gap-2 px-3 py-3 rounded-lg bg-anvil-bg border border-anvil-border hover:border-anvil-accent transition"
    >
      <ExternalLink className="absolute top-2.5 right-2.5 w-3 h-3 text-anvil-muted group-hover:text-anvil-accent shrink-0" />
      {!isTitleJustTheDomain && (
        <span className="text-xs font-medium text-anvil-text line-clamp-2 leading-snug pr-4">{s.title}</span>
      )}
      <div className="flex items-center gap-1.5 min-w-0">
        {!failed ? (
          <img
            src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
            alt=""
            className="w-4 h-4 shrink-0 rounded-sm bg-white object-contain p-px"
            onError={() => setFailed(true)}
          />
        ) : (
          <Globe className="w-4 h-4 shrink-0 text-anvil-muted" />
        )}
        <span className={`truncate ${isTitleJustTheDomain ? 'text-xs font-medium text-anvil-text' : 'text-[10px] text-anvil-muted'}`}>
          {host}
        </span>
      </div>
    </a>
  );
}

// Real inline previews only for content this tab can actually render itself
// (an uploaded file's own blob URL, or a YouTube thumbnail). A live embed of
// an arbitrary third-party page isn't reliable — most sites (GitHub
// included) send X-Frame-Options/CSP headers that block being iframed.
function MediaPreview({ s }: { s: SourceItem }) {
  const [failed, setFailed] = useState(false);
  const videoId = s.type === 'youtube' ? extractYouTubeVideoId(s.url) : null;
  const Icon = typeIcons[s.type] || Globe;

  if (!failed && videoId) {
    return <img src={`https://img.youtube.com/vi/${videoId}/default.jpg`} alt={s.title} className="w-full h-full object-cover" onError={() => setFailed(true)} />;
  }
  if (!failed && s.type === 'image' && s.url) {
    return <img src={s.url} alt={s.title} className="w-full h-full object-cover" onError={() => setFailed(true)} />;
  }
  if (!failed && s.type === 'video' && s.url) {
    return <video src={s.url} className="w-full h-full object-cover" muted onError={() => setFailed(true)} />;
  }
  if (!failed && s.type === 'pdf' && s.url) {
    return <iframe src={s.url} title={s.title} className="w-full h-full pointer-events-none scale-105" onError={() => setFailed(true)} />;
  }
  return <Icon className="w-8 h-8 text-anvil-muted" />;
}

function MediaSourceCard({ s }: { s: SourceItem }) {
  return (
    <a
      href={s.url || undefined}
      target={s.url ? '_blank' : undefined}
      rel="noreferrer"
      title={s.url || s.title}
      className="w-56 shrink-0 flex flex-col rounded-lg bg-anvil-bg border border-anvil-border overflow-hidden hover:border-anvil-accent transition"
    >
      <div className="px-2.5 py-1.5 border-b border-anvil-border flex items-center justify-between">
        <span className="text-xs font-medium text-anvil-text flex items-center gap-1.5 truncate pr-2">
          {s.title}
        </span>
        <span className="text-[10px] text-anvil-muted uppercase shrink-0">{s.type}</span>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-anvil-panel">
        <MediaPreview s={s} />
      </div>
    </a>
  );
}

export default function BottomDataStrip() {
  const { currentProject, sources, loadSources } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentProject?.id) {
      loadSources(currentProject.id);
    }
  }, [currentProject?.id, loadSources]);

  const scrollBy = (delta: number) => scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 h-8 flex items-center justify-between border-b border-anvil-border shrink-0">
        <span className="text-xs font-semibold text-anvil-muted uppercase tracking-wider">Data Sources</span>
        {sources.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={() => scrollBy(-240)} className="text-anvil-muted hover:text-white" title="Scroll left">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => scrollBy(240)} className="text-anvil-muted hover:text-white" title="Scroll right">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto p-3 flex items-stretch gap-3 scroll-smooth">
        {!currentProject || sources.length === 0 ? (
          <div className="flex items-center justify-center w-full text-anvil-muted text-xs">
            No data sources yet — they'll appear here as the agent searches the web or you add files.
          </div>
        ) : (
          sources.map((s, idx) =>
            s.type === 'web' ? (
              <WebSourceCard key={`${s.title}-${idx}`} s={s} />
            ) : (
              <MediaSourceCard key={`${s.title}-${idx}`} s={s} />
            )
          )
        )}
      </div>
    </div>
  );
}
