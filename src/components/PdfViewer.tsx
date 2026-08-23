import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

// pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfViewerProps {
  file?: File;
  url?: string;
}

export default function PdfViewer({ file, url }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const source = file ? URL.createObjectURL(file) : url;
        if (!source) return;
        const loaded = await pdfjsLib.getDocument(source).promise;
        setPdf(loaded);
        setTotalPages(loaded.numPages);
        setPageNum(1);
      } catch (err) {
        console.error('Failed to load PDF', err);
      }
    };
    load();
  }, [file, url]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const render = async () => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    };
    render();
  }, [pdf, pageNum, scale]);

  return (
    <div className="h-full w-full flex flex-col bg-anvil-bg">
      <div className="h-9 flex items-center justify-between px-3 bg-anvil-panel border-b border-anvil-border shrink-0">
        <div className="flex items-center gap-2 text-xs text-anvil-text">
          <button onClick={() => setPageNum((n) => Math.max(1, n - 1))} disabled={pageNum <= 1}>
            <ChevronLeft className="w-4 h-4 text-anvil-muted hover:text-white disabled:opacity-30" />
          </button>
          <span>
            {pageNum} / {totalPages || '?'}
          </span>
          <button onClick={() => setPageNum((n) => Math.min(totalPages || n, n + 1))} disabled={pageNum >= totalPages}>
            <ChevronRight className="w-4 h-4 text-anvil-muted hover:text-white disabled:opacity-30" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="w-4 h-4 text-anvil-muted hover:text-white" />
          </button>
          <span className="text-xs text-anvil-muted">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => s + 0.2)}>
            <ZoomIn className="w-4 h-4 text-anvil-muted hover:text-white" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
