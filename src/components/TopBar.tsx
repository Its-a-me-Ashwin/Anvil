import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Cloud, Wifi, Settings, Printer, Save, Trash2, X, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { loadPrinterConfig, savePrinterConfig, deletePrinterConfig, registerPrinterWithBridge, discoverPrinters, type PrinterConfig } from '../services/slicerService';
import { getProject } from '../services/agentService';
import { useProjectStore } from '../store/projectStore';

const PRINTER_MODELS: PrinterConfig['model'][] = ['p1p', 'p1s', 'x1c', 'x1e', 'a1', 'a1mini', 'h2d', 'h2s', 'h2c'];

function bambuModelToUi(model: string): PrinterConfig['model'] {
  const map: Record<string, PrinterConfig['model']> = {
    P1P: 'p1p', P1S: 'p1s', X1C: 'x1c', X1: 'x1c', A1: 'a1', A1Mini: 'a1mini',
  };
  return map[model] || 'p1p';
}

export default function TopBar() {
  const [projectOpen, setProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printer, setPrinter] = useState<PrinterConfig | null>(loadPrinterConfig);
  const [saving, setSaving] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  const { projects, currentProject, loadProjects, setCurrentProject, clearCurrentProject } = useProjectStore();

  const [form, setForm] = useState<PrinterConfig>({
    name: '',
    host: '',
    serialNumber: '',
    accessCode: '',
    model: 'p1p',
  });

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (printer) setForm(printer);
    if (settingsOpen) setSaveStatus(null);
  }, [printer, settingsOpen]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.serialNumber.trim() || !form.accessCode.trim()) {
      setSaveStatus({ type: 'error', message: 'Fill in nickname, IP, serial, and access code.' });
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    const cleaned: PrinterConfig = {
      ...form,
      name: form.name.trim(),
      host: form.host.trim(),
      serialNumber: form.serialNumber.trim(),
      accessCode: form.accessCode.trim(),
    };
    try {
      await registerPrinterWithBridge(cleaned);
      savePrinterConfig(cleaned);
      setPrinter(cleaned);
      setSaveStatus({ type: 'success', message: `Registered "${cleaned.name}" with bambu CLI.` });
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err?.message || 'Failed to register printer. Is the bridge running?' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setSaveStatus(null);
    try {
      const found = await discoverPrinters();
      if (!found.length) {
        setSaveStatus({ type: 'error', message: 'No printers found on the local network.' });
        return;
      }
      const p = found[0];
      setForm((f) => ({
        ...f,
        name: f.name || p.name || '',
        host: p.host || f.host,
        serialNumber: p.serialNumber || f.serialNumber,
        model: bambuModelToUi(p.model),
      }));
      setSaveStatus({ type: 'success', message: `Found ${found.length} printer(s). Enter access code and save.` });
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err?.message || 'Discovery failed. Is the bridge running?' });
    } finally {
      setDiscovering(false);
    }
  };

  const handleDelete = () => {
    deletePrinterConfig();
    setPrinter(null);
    setForm({ name: '', host: '', serialNumber: '', accessCode: '', model: 'p1p' });
  };

  const selectProject = async (project: typeof currentProject) => {
    if (!project) return;
    try {
      const full = await getProject(project.id);
      setCurrentProject(full, []); // switching projects — clear until history loads, don't keep the old one's messages
    } catch {
      setCurrentProject(project, []);
    }
    setProjectOpen(false);
  };

  const startNewProject = () => {
    clearCurrentProject();
    setProjectOpen(false);
  };

  return (
    <div className="h-14 shrink-0 bg-anvil-panel border-b border-anvil-border flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">A</div>
          <span className="font-semibold tracking-tight text-white">ANVIL</span>
        </div>

        <div className="relative" ref={projectRef}>
          <button
            onClick={() => setProjectOpen(!projectOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-anvil-panelHover border border-anvil-border hover:border-anvil-accent transition text-sm"
          >
            <span className="text-anvil-muted">Project:</span>
            <span className="font-medium text-white">{currentProject?.name || 'New Project'}</span>
            <ChevronDown className="w-4 h-4 text-anvil-muted" />
          </button>

          {projectOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 rounded-lg bg-anvil-panelHover border border-anvil-border shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-anvil-muted uppercase tracking-wider">Recent Projects</div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-anvil-border flex items-center gap-2 text-anvil-text"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-anvil-success" />
                  {p.name}
                </button>
              ))}
              <button
                onClick={startNewProject}
                className="w-full text-left px-3 py-2 text-sm hover:bg-anvil-border text-anvil-text"
              >
                + New Project
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </div>
      </div>

      <div className="flex items-center gap-5 text-sm text-anvil-muted">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-anvil-success" />
          <span>Cloud: Google Cloud</span>
        </div>
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-anvil-success" />
          <span>Local Workshop</span>
        </div>

        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition text-sm ${
              printer ? 'bg-anvil-panelHover border-anvil-border hover:border-anvil-accent' : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
            title="Printer settings"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{printer ? printer.name : 'Printer'}</span>
            <Settings className="w-3.5 h-3.5" />
          </button>

          {settingsOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 rounded-lg bg-anvil-panelHover border border-anvil-border shadow-xl z-50 overflow-hidden p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-anvil-muted uppercase tracking-wider">Bambu Printer</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDiscover}
                    disabled={discovering}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-anvil-muted hover:text-white hover:bg-anvil-border transition disabled:opacity-50"
                    title="Scan local network for Bambu printers"
                  >
                    {discovering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Scan
                  </button>
                  <button onClick={() => setSettingsOpen(false)} className="text-anvil-muted hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-anvil-muted uppercase">Nickname</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. p1s"
                  className="w-full px-2.5 py-1.5 rounded bg-anvil-bg border border-anvil-border text-sm text-anvil-text outline-none focus:border-anvil-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-anvil-muted uppercase">IP / Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="192.168.1.42"
                  className="w-full px-2.5 py-1.5 rounded bg-anvil-bg border border-anvil-border text-sm text-anvil-text outline-none focus:border-anvil-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-anvil-muted uppercase">Serial Number</label>
                <input
                  type="text"
                  value={form.serialNumber}
                  onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                  placeholder="00M..."
                  className="w-full px-2.5 py-1.5 rounded bg-anvil-bg border border-anvil-border text-sm text-anvil-text outline-none focus:border-anvil-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-anvil-muted uppercase">Access Code</label>
                <input
                  type="password"
                  value={form.accessCode}
                  onChange={(e) => setForm((f) => ({ ...f, accessCode: e.target.value }))}
                  placeholder="From printer screen"
                  className="w-full px-2.5 py-1.5 rounded bg-anvil-bg border border-anvil-border text-sm text-anvil-text outline-none focus:border-anvil-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-anvil-muted uppercase">Model</label>
                <select
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value as PrinterConfig['model'] }))}
                  className="w-full px-2.5 py-1.5 rounded bg-anvil-bg border border-anvil-border text-sm text-anvil-text outline-none focus:border-anvil-accent"
                >
                  {PRINTER_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-anvil-accent hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {printer && (
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition"
                    title="Clear printer config"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {saveStatus && (
                <div
                  className={`p-2 rounded flex items-start gap-1.5 text-[10px] ${
                    saveStatus.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/20 text-anvil-success'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                >
                  {saveStatus.type === 'success' ? <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" /> : <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />}
                  {saveStatus.message}
                </div>
              )}

              <p className="text-[10px] text-anvil-muted leading-relaxed">
                WiFi setup: click Scan to find your printer on the LAN, enter the access code from the printer screen, then Save. The bridge registers it with <code className="text-anvil-text">bambu-cli</code> for slicing and printing.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
