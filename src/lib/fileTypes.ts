import type { TabType } from '../store/workspaceStore';

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rs', 'go', 'java', 'kt', 'swift',
  'cpp', 'c', 'h', 'hpp', 'ino',
  'html', 'css', 'scss', 'json', 'yaml', 'yml',
  'md', 'txt', 'xml', 'sh', 'bat', 'ps1',
  'vue', 'svelte', 'php', 'rb',
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov']);
const PDF_EXTENSIONS = new Set(['pdf']);

export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot + 1).toLowerCase();
}

export function detectTypeFromName(fileName: string): TabType {
  const ext = getFileExtension(fileName);
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'unknown';
}

export function getLanguageFromFileName(fileName: string): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
    swift: 'swift', cpp: 'cpp', c: 'c', h: 'cpp', hpp: 'cpp',
    ino: 'cpp', html: 'html', css: 'css', scss: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    xml: 'xml', sh: 'shell', bat: 'batch', ps1: 'powershell',
    vue: 'vue', svelte: 'svelte', php: 'php', rb: 'ruby',
  };
  return map[getFileExtension(fileName)] || 'plaintext';
}
