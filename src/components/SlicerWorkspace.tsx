import { useState, useRef, useEffect } from 'react';
import { Box, Settings, Send, Layers, Triangle, GripHorizontal, Upload, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { sliceModel, sendToPrinter, loadPrinterConfig, checkBridgeHealth, type SlicerParams, type PrinterConfig } from '../services/slicerService';
import { getCadMeta, fetchCadModel } from '../services/cadService';
import { useProjectStore } from '../store/projectStore';
import StlViewer from './StlViewer';

const CAD_POLL_MS = 2000;

interface SlicerWorkspaceProps {
  file?: File;
}

export default function SlicerWorkspace({ file: initialFile }: SlicerWorkspaceProps) {
  const { currentProject } = useProjectStore();
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [previewData, setPreviewData] = useState<ArrayBuffer | null>(null);
  const [cadAvailable, setCadAvailable] = useState(false);
  const [params, setParams] = useState<SlicerParams>({
    bedAdhesion: 'Cool Plate',
    infill: 20,
    support: false,
  });
  const [slicing, setSlicing] = useState(false);
  const [sending, setSending] = useState(false);
  const [slicedPath, setSlicedPath] = useState<string | null>(null);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [printer, setPrinter] = useState<PrinterConfig | null>(() => loadPrinterConfig());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCadMtimeRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => setPrinter(loadPrinterConfig());
    window.addEventListener('anvil-printer-config-changed', refresh);
    return () => window.removeEventListener('anvil-printer-config-changed', refresh);
  }, []);

  useEffect(() => {
    checkBridgeHealth()
      .then((h) => setBridgeOk(h.ok && h.bambuStudio && h.bambuCli))
      .catch(() => setBridgeOk(false));
  }, []);

  useEffect(() => {
    if (initialFile) setFile(initialFile);
  }, [initialFile]);

  // A manually chosen file always wins over the live CAD model — read its
  // bytes once so the viewer can show it (no hot-reload for these, since
  // there's nothing on the backend tracking edits to them).
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    file.arrayBuffer().then((buf) => {
      if (!cancelled) setPreviewData(buf);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // With no manually chosen file, follow the project's live CAD assembly:
  // poll the cheap mtime endpoint, and only re-fetch/re-render the mesh when
  // it actually changed (i.e. the agent edited the design).
  useEffect(() => {
    if (file || !currentProject) {
      setCadAvailable(false);
      return;
    }

    let cancelled = false;
    lastCadMtimeRef.current = null;

    const poll = async () => {
      try {
        const meta = await getCadMeta(currentProject.id);
        if (cancelled) return;
        if (!meta.part_count) {
          setCadAvailable(false);
          setPreviewData(null);
          lastCadMtimeRef.current = null;
          return;
        }
        setCadAvailable(true);
        if (meta.mtime !== lastCadMtimeRef.current) {
          lastCadMtimeRef.current = meta.mtime;
          const buf = await fetchCadModel(currentProject.id);
          if (!cancelled) setPreviewData(buf);
        }
      } catch {
        // Bridge/backend may be briefly unreachable — keep the last good preview.
      }
    };

    poll();
    const interval = setInterval(poll, CAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [file, currentProject]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setSlicedPath(null);
      setStatus(null);
    }
  };

  const getModelFile = (): File | null => {
    if (file) return file;
    if (previewData && cadAvailable) {
      return new File([previewData], `${currentProject?.name || currentProject?.id || 'model'}.stl`, { type: 'model/stl' });
    }
    return null;
  };

  const handleSlice = async () => {
    const modelFile = getModelFile();
    if (!modelFile || !printer) return;
    setSlicing(true);
    setStatus(null);
    try {
      const result = await sliceModel(modelFile, params, printer.model);
      setSlicedPath(result.outputPath || null);
      setStatus({ type: 'success', message: `Sliced to ${result.outputName || result.outputPath}` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Slicing failed' });
    } finally {
      setSlicing(false);
    }
  };

  const handleSend = async () => {
    if (!slicedPath || !printer) return;
    setSending(true);
    setStatus(null);
    try {
      await sendToPrinter(slicedPath, printer);
      setStatus({ type: 'success', message: `Sent to ${printer.name}` });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Failed to send print' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-anvil-bg">
      <div className="h-10 flex items-center px-3 bg-anvil-panel border-b border-anvil-border shrink-0 justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-anvil-accent mr-2" />
          <span className="text-sm font-medium text-anvil-text">Bambu Slicer</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-anvil-muted">
          <Activity className={`w-3 h-3 ${bridgeOk ? 'text-anvil-success' : bridgeOk === false ? 'text-red-400' : 'text-anvil-muted'}`} />
          {bridgeOk === null ? 'Checking bridge…' : bridgeOk ? 'Bridge ready' : 'Bridge down'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* 3D preview — hot-reloads from the project's live CAD assembly
              when no file has been manually chosen below. */}
          <div className="h-72 rounded-lg border border-anvil-border overflow-hidden relative">
            <StlViewer
              data={previewData}
              emptyLabel={
                file
                  ? 'Reading model…'
                  : cadAvailable
                    ? 'Waiting for a model…'
                    : 'No CAD model yet — ask the agent to design one, or drop a file below'
              }
            />
            {!file && cadAvailable && (
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/50 text-[10px] text-anvil-success">
                <span className="w-1.5 h-1.5 rounded-full bg-anvil-success animate-pulse" />
                Live from CAD
              </div>
            )}
          </div>

          {/* Model selection */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-lg border-2 border-dashed border-anvil-border hover:border-anvil-accent transition cursor-pointer text-center"
          >
            <input type="file" ref={fileInputRef} onChange={handleFile} accept=".stl,.3mf" className="hidden" />
            <Upload className="w-8 h-8 mx-auto mb-2 text-anvil-muted" />
            {file ? (
              <>
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-anvil-muted">Click to change model</p>
              </>
            ) : cadAvailable ? (
              <>
                <p className="text-sm font-medium text-white">Using live CAD model from this project</p>
                <p className="text-xs text-anvil-muted">Click to slice a different .stl or .3mf instead</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white">Drop or select an STL / 3MF</p>
                <p className="text-xs text-anvil-muted">.stl or .3mf file</p>
              </>
            )}
          </div>

          {/* Parameters */}
          <div className="p-4 rounded-lg bg-anvil-panel border border-anvil-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-anvil-muted uppercase tracking-wider">
              <Settings className="w-4 h-4" />
              Print Settings
            </div>

            <div>
              <label className="block text-xs text-anvil-muted mb-1.5">Bed Adhesion</label>
              <select
                value={params.bedAdhesion}
                onChange={(e) => setParams((p) => ({ ...p, bedAdhesion: e.target.value as SlicerParams['bedAdhesion'] }))}
                className="w-full px-3 py-2 rounded bg-anvil-bg border border-anvil-border text-sm text-anvil-text outline-none focus:border-anvil-accent"
              >
                <option>Cool Plate</option>
                <option>Engineering Plate</option>
                <option>Textured PEI</option>
                <option>Textured Cool Plate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-anvil-muted mb-1.5">Infill Density: {params.infill}%</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={params.infill}
                onChange={(e) => setParams((p) => ({ ...p, infill: parseInt(e.target.value) }))}
                className="w-full accent-anvil-accent"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-anvil-text">
                <Triangle className="w-4 h-4 text-anvil-muted" />
                Supports
              </div>
              <button
                onClick={() => setParams((p) => ({ ...p, support: !p.support }))}
                className={`w-10 h-5 rounded-full transition relative ${params.support ? 'bg-anvil-accent' : 'bg-anvil-border'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${params.support ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSlice}
              disabled={!getModelFile() || !printer || slicing || bridgeOk !== true}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-anvil-accent hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition"
            >
              <Box className="w-4 h-4" />
              {slicing ? 'Slicing…' : 'Slice Model'}
            </button>
            <button
              onClick={handleSend}
              disabled={!slicedPath || !printer || sending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-anvil-success hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium transition"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send to Printer'}
            </button>
          </div>

          {/* Status */}
          {status && (
            <div
              className={`p-3 rounded-lg flex items-center gap-2 text-xs ${
                status.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-anvil-success'
                  : status.type === 'info'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-anvil-accent'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {status.message}
            </div>
          )}

          {/* Printer connection hint */}
          {!printer && (
            <div className="p-3 rounded-lg bg-anvil-panel border border-anvil-border text-xs text-anvil-muted">
              <div className="flex items-center gap-2 mb-1">
                <GripHorizontal className="w-4 h-4" />
                <span className="font-medium text-anvil-text">No printer configured</span>
              </div>
              Open the settings in the top bar to add your Bambu printer (IP, serial, access code, model).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
