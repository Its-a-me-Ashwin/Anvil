import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const WORKSHOP_DIR = path.resolve(__dirname, '..', '.anvil-workshop');
const BAMBU_STUDIO = IS_WINDOWS
  ? 'C:/Program Files/Bambu Studio/bambu-studio.exe'
  : IS_MAC
    ? '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio'
    : 'bambu-studio';
const BAMBU_CLI = path.resolve(__dirname, '..', IS_WINDOWS ? '.venv/Scripts/bambu.exe' : '.venv/bin/bambu');
const BAMBU_PYTHON = path.resolve(__dirname, '..', IS_WINDOWS ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const DISCOVER_SCRIPT = path.resolve(__dirname, 'discoverPrinters.py');
const BAMBU_CONFIG_DIR = path.resolve(process.env.USERPROFILE || process.env.HOME, '.bambu-cli');
const BAMBU_PRINTERS_FILE = path.join(BAMBU_CONFIG_DIR, 'printers.json');
const BAMBU_PROFILE_ROOT = IS_MAC
  ? path.resolve(process.env.HOME, 'Library/Application Support/BambuStudio/system/BBL')
  : path.resolve(process.env.USERPROFILE || process.env.HOME, 'AppData/Roaming/BambuStudio/system/BBL');

const PORT = process.env.WORKSHOP_PORT || 3001;

const UI_MODEL_TO_BAMBU = {
  p1p: 'P1P',
  p1s: 'P1S',
  x1c: 'X1C',
  x1e: 'X1C',
  a1: 'A1',
  a1mini: 'A1Mini',
  h2d: 'Unknown',
  h2s: 'Unknown',
  h2c: 'Unknown',
};

const BAMBU_MODEL_TO_UI = {
  P1P: 'p1p',
  P1S: 'p1s',
  X1C: 'x1c',
  X1: 'x1c',
  A1: 'a1',
  A1Mini: 'a1mini',
  Unknown: 'p1p',
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: false, windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function bambuCameraUrl(printer) {
  return `rtsps://bblp:${encodeURIComponent(printer.access_code)}@${printer.ip_address}:322/streaming/live/1`;
}

async function getCameraPrinter() {
  const config = await readPrintersConfig();
  const printers = Object.values(config).filter((printer) => printer?.ip_address && printer?.access_code);
  for (const printer of printers) {
    if (await canReachPrinter(printer.ip_address)) return printer;
  }
  return null;
}

function canReachPrinter(host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 322 });
    const finish = (reachable) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(1200);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function streamCamera(req, res) {
  const printer = await getCameraPrinter();
  if (!printer) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'No configured printer camera.' }));
    return;
  }

  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error',
    '-rw_timeout', '10000000',
    '-rtsp_transport', 'tcp',
    '-tls_verify', '0',
    '-i', bambuCameraUrl(printer),
    '-an',
    '-c:v', 'copy',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    'pipe:1',
  ], { windowsHide: true });

  let started = false;
  const startupTimeout = setTimeout(() => {
    if (started || ffmpeg.killed) return;
    ffmpeg.kill();
  }, 12000);
  ffmpeg.stderr.on('data', (data) => {
    if (!started && data.toString().trim()) {
      console.error(`Camera relay: ${data.toString().trim()}`);
    }
  });
  ffmpeg.stdout.once('data', (data) => {
    started = true;
    clearTimeout(startupTimeout);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(data);
    ffmpeg.stdout.pipe(res);
  });
  ffmpeg.on('close', () => {
    clearTimeout(startupTimeout);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unable to connect to the printer camera.' }));
    } else if (!res.writableEnded) {
      res.end();
    }
  });
  req.on('close', () => {
    if (!ffmpeg.killed) ffmpeg.kill();
  });
}

function modelToProfileFamily(model) {
  const map = {
    p1p: 'P1P',
    p1s: 'P1P', // P1S shares P1P profiles in Bambu Studio system presets
    x1c: 'X1C',
    x1e: 'X1C',
    a1: 'A1',
    a1mini: 'A1M',
    h2d: 'H2D',
    h2s: 'H2S',
    h2c: 'H2D',
  };
  return map[model] || 'P1P';
}

async function findFirstFile(dir, predicate) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && predicate(entry.name)) return full;
      if (entry.isDirectory()) {
        const found = await findFirstFile(full, predicate);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

async function resolvePresetPaths(family) {
  const machineDir = path.join(BAMBU_PROFILE_ROOT, 'machine');
  const processDir = path.join(BAMBU_PROFILE_ROOT, 'process');
  const filamentDir = path.join(BAMBU_PROFILE_ROOT, 'filament');

  const machine = path.join(machineDir, `Bambu Lab ${family} 0.4 nozzle.json`);
  const process = path.join(processDir, `0.20mm Standard @BBL ${family}.json`);
  const filamentBasic = path.join(filamentDir, `Bambu PLA Basic @BBL ${family}.json`);

  const resolved = {
    machine: (await fileExists(machine)) ? machine : null,
    process: (await fileExists(process)) ? process : null,
    filament: (await fileExists(filamentBasic)) ? filamentBasic : null,
  };

  if (!resolved.process) {
    resolved.process = await findFirstFile(processDir, (n) => n.includes(`@BBL ${family}`) && n.includes('Standard'));
  }
  if (!resolved.filament) {
    resolved.filament = await findFirstFile(filamentDir, (n) => n.includes('PLA') && n.includes(`@BBL ${family}`));
  }

  return resolved;
}

function bedTypeFromUi(value) {
  const map = {
    'Cool Plate': 'Cool Plate',
    'Engineering Plate': 'Engineering Plate',
    'Textured PEI': 'Textured PEI Plate',
    'Textured Cool Plate': 'Cool Plate',
  };
  return map[value] || 'Cool Plate';
}

async function slice(job) {
  const { filename, base64, params, model = 'p1p' } = job;
  await ensureDir(WORKSHOP_DIR);

  const safeName = path.basename(filename);
  const inputPath = path.join(WORKSHOP_DIR, safeName);
  const ext = path.extname(safeName).toLowerCase();
  const stem = path.basename(safeName, ext);
  const outputName = `${stem}.3mf`;
  const outputPath = path.join(WORKSHOP_DIR, outputName);

  await fs.writeFile(inputPath, Buffer.from(base64, 'base64'));

  const family = modelToProfileFamily(model);
  const presets = await resolvePresetPaths(family);
  const missing = Object.entries(presets).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return { ok: false, error: `Missing Bambu Studio system presets for ${family}: ${missing.join(', ')}` };
  }

  const args = [
    '--slice', '0',
    '--load-settings', `${presets.machine};${presets.process}`,
    '--load-filaments', presets.filament,
    `--curr-bed-type=${bedTypeFromUi(params.bedAdhesion)}`,
    `--sparse-infill-density=${params.infill}`,
    `--enable-support=${params.support ? 1 : 0}`,
    '--support-type=normal(auto)',
    '--export-3mf', outputPath,
    inputPath,
  ];

  const result = await run(BAMBU_STUDIO, args);
  const outputExists = await fileExists(outputPath);

  if (!outputExists) {
    return { ok: false, error: 'Slicer did not produce output.3mf', stdout: result.stdout, stderr: result.stderr };
  }

  return { ok: true, outputPath, outputName, family, params, log: result.stdout + result.stderr };
}

async function sendPrint(outputPath, printerName) {
  if (!await fileExists(outputPath)) {
    return { ok: false, error: 'Sliced file not found on bridge.' };
  }

  const config = await readPrintersConfig();
  const key = printerName?.trim();
  const printer = config[key];
  if (!printer) {
    return { ok: false, error: `Printer '${key}' not found. Register it via Settings → Printer first.` };
  }

  const result = await run(BAMBU_PYTHON, [
    path.resolve(__dirname, 'printHelper.py'),
    outputPath,
    '--ip', printer.ip_address,
    '--serial', printer.serial_number,
    '--access-code', printer.access_code,
    '--model', printer.model || 'P1S',
    '--plate', '1',
  ]);

  if (result.code !== 0) {
    return { ok: false, error: 'Print command failed', stdout: result.stdout, stderr: result.stderr };
  }
  return { ok: true, log: result.stdout + result.stderr };
}

async function readPrintersConfig() {
  try {
    const raw = await fs.readFile(BAMBU_PRINTERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writePrintersConfig(config) {
  await ensureDir(BAMBU_CONFIG_DIR);
  await fs.writeFile(BAMBU_PRINTERS_FILE, JSON.stringify(config, null, 2));
}

async function registerPrinter(body) {
  const { name, host, serialNumber, accessCode, model = 'p1p' } = body;
  if (!name?.trim() || !host?.trim() || !serialNumber?.trim() || !accessCode?.trim()) {
    return { ok: false, error: 'name, host, serialNumber, and accessCode are required' };
  }

  const nickname = name.trim();
  const config = await readPrintersConfig();
  config[nickname] = {
    ip_address: host.trim(),
    serial_number: serialNumber.trim(),
    name: nickname,
    access_code: accessCode.trim(),
    model: UI_MODEL_TO_BAMBU[model] || 'P1P',
    account_email: null,
  };

  await writePrintersConfig(config);
  return { ok: true, name: nickname };
}

async function listPrinters() {
  const config = await readPrintersConfig();
  return Object.entries(config).map(([key, printer]) => ({
    name: printer.name || key,
    host: printer.ip_address || '',
    serialNumber: printer.serial_number || '',
    model: BAMBU_MODEL_TO_UI[printer.model] || 'p1p',
  }));
}

async function discoverPrinters() {
  if (!await fileExists(BAMBU_PYTHON)) {
    return { ok: false, error: 'Python venv not found. Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt (Windows: .venv\\Scripts\\pip)' };
  }
  const result = await run(BAMBU_PYTHON, [DISCOVER_SCRIPT]);
  if (result.code !== 0) {
    return { ok: false, error: result.stderr || 'Discovery failed', stdout: result.stdout };
  }
  try {
    const printers = JSON.parse(result.stdout.trim() || '[]');
    return { ok: true, printers };
  } catch {
    return { ok: false, error: 'Invalid discovery response', stdout: result.stdout };
  }
}

const server = http.createServer(async (req, res) => {
  corsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    if (req.url === '/health' && req.method === 'GET') {
      const studioExists = await fileExists(BAMBU_STUDIO);
      const cliExists = await fileExists(BAMBU_CLI);
      send(200, { ok: true, bambuStudio: studioExists, bambuCli: cliExists, workshopDir: WORKSHOP_DIR });
      return;
    }

    if (req.url === '/camera' && req.method === 'GET') {
      if (!await getCameraPrinter()) return send(404, { success: false, error: 'No configured printer camera.' });
      send(200, { success: true, url: `http://localhost:${PORT}/camera/stream` });
      return;
    }

    if (req.url === '/camera/stream' && req.method === 'GET') {
      await streamCamera(req, res);
      return;
    }

    if (req.url === '/slice' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.filename || !body.base64) return send(400, { success: false, error: 'filename and base64 required' });
      const result = await slice(body);
      if (!result.ok) return send(500, { success: false, ...result });
      return send(200, { success: true, ...result });
    }

    if (req.url === '/print' && req.method === 'POST') {
      const { outputPath, printerName } = await readJsonBody(req);
      if (!outputPath || !printerName) return send(400, { success: false, error: 'outputPath and printerName required' });
      const result = await sendPrint(outputPath, printerName);
      if (!result.ok) return send(500, { success: false, ...result });
      return send(200, { success: true, ...result });
    }

    if (req.url === '/printers' && req.method === 'GET') {
      const printers = await listPrinters();
      send(200, { success: true, printers });
      return;
    }

    if (req.url === '/printers' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await registerPrinter(body);
      if (!result.ok) return send(400, { success: false, ...result });
      return send(200, { success: true, ...result });
    }

    if (req.url === '/printers/discover' && req.method === 'GET') {
      const result = await discoverPrinters();
      if (!result.ok) return send(500, { success: false, ...result });
      return send(200, { success: true, printers: result.printers });
    }

    send(404, { success: false, error: 'Not found' });
  } catch (err) {
    console.error(err);
    send(500, { success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Anvil Workshop Bridge running on http://localhost:${PORT}`);
  console.log(`Workshop dir: ${WORKSHOP_DIR}`);
  console.log(`Profile root: ${BAMBU_PROFILE_ROOT}`);
});
