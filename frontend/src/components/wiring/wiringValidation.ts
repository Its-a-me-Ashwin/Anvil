import type { WiringDiagramData, WiringConnection } from './wiringTypes';

export interface WiringValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWiringData(data: WiringDiagramData): WiringValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const m of data.modules) {
    if (ids.has(m.id)) errors.push(`Duplicate module id: ${m.id}`);
    ids.add(m.id);
    const pins = new Set<string>();
    for (const p of m.pins || []) {
      if (pins.has(p)) errors.push(`Duplicate pin "${p}" in module ${m.id}`);
      pins.add(p);
    }
  }

  const modPins = new Map(data.modules.map((m) => [m.id, new Set(m.pins || [])]));
  const seen = new Set<string>();

  data.connections.forEach(([src, srcPin, tgt, tgtPin], i) => {
    const c: WiringConnection = [src, srcPin, tgt, tgtPin];
    const key = `${c[0]}.${c[1]}->${c[2]}.${c[3]}`;
    if (seen.has(key)) errors.push(`Duplicate connection: ${key}`);
    seen.add(key);

    const srcPins = modPins.get(src);
    const tgtPins = modPins.get(tgt);
    if (!srcPins) errors.push(`Connection ${i}: unknown source module ${src}`);
    else if (!srcPins.has(srcPin)) errors.push(`Connection ${i}: unknown source pin "${srcPin}" in ${src}`);
    if (!tgtPins) errors.push(`Connection ${i}: unknown target module ${tgt}`);
    else if (!tgtPins.has(tgtPin)) errors.push(`Connection ${i}: unknown target pin "${tgtPin}" in ${tgt}`);
    if (src === tgt) errors.push(`Connection ${i}: self-connection ${src} -> ${tgt}`);
  });

  return { valid: errors.length === 0, errors };
}
