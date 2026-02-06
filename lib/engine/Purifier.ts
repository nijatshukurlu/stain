/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */
// To achieve the pure state, one must remove the unnecessary.
export type RemovedRange = { start: number; end: number; label: string };
export type PurifyResult = {
  original: Uint8Array;
  purified: Uint8Array;
  removed: RemovedRange[];
};

export const MAX_FILE_SIZE = 100 * 1024 * 1024;

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isJPEG(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
function isPNG(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function validateMagicBytes(bytes: Uint8Array, name: string): "jpeg" | "png" {
  const ext = getExtension(name);
  const jpegExt = ext === "jpg" || ext === "jpeg";
  const pngExt = ext === "png";
  if (jpegExt && !isJPEG(bytes)) throw new Error("Header does not match .jpg/.jpeg");
  if (pngExt && !isPNG(bytes)) throw new Error("Header does not match .png");
  if (!jpegExt && !pngExt) throw new Error("Unsupported extension");
  return jpegExt ? "jpeg" : "png";
}

function purifyJPEG(input: Uint8Array, onProgress?: (p: number) => void): PurifyResult {
  const removed: RemovedRange[] = [];
  let pos = 0;
  if (!isJPEG(input)) throw new Error("Invalid JPEG header");
  const outParts: { start: number; end: number }[] = [];
  // SOI
  outParts.push({ start: 0, end: 2 });
  pos = 2;
  const total = input.length;
  while (pos < total) {
    if (onProgress) onProgress(Math.min(1, pos / total));
    if (input[pos] !== 0xff) {
      // inside compressed scan data; seek to EOI
      const eoi = findEOI(input, pos);
      if (eoi < 0) {
        outParts.push({ start: pos, end: total });
        break;
      } else {
        outParts.push({ start: pos, end: eoi });
        outParts.push({ start: eoi, end: eoi + 2 });
        pos = eoi + 2;
        break;
      }
    }
    const marker = input[pos + 1];
    // Standalone markers without length
    if (marker === 0xd9) {
      // EOI
      outParts.push({ start: pos, end: pos + 2 });
      pos += 2;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      outParts.push({ start: pos, end: pos + 2 });
      pos += 2;
      continue;
    }
    // Length-prefixed segment: big-endian length includes length bytes themselves
    if (pos + 4 > total) throw new Error("Error: Malformed binary structure detected.");
    const view = new DataView(input.buffer, input.byteOffset + pos);
    const segLen = view.getUint16(2, false);
    const segStart = pos;
    const segEnd = pos + 2 + segLen;
    if (segEnd > total) throw new Error("Error: Malformed binary structure detected.");
    const isAPPn = marker >= 0xe0 && marker <= 0xef;
    const isCOM = marker === 0xfe;
    if (isAPPn || isCOM) {
      removed.push({
        start: segStart,
        end: segEnd,
        label: isAPPn ? `APP${(marker - 0xe0)}` : "COM",
      });
      pos = segEnd;
      continue;
    }
    outParts.push({ start: segStart, end: segEnd });
    pos = segEnd;
    if (marker === 0xda) {
      // SOS: following is compressed image data until EOI
      const eoi = findEOI(input, pos);
      if (eoi < 0) {
        outParts.push({ start: pos, end: total });
        pos = total;
      } else {
        outParts.push({ start: pos, end: eoi + 2 });
        pos = eoi + 2;
      }
      break;
    }
  }
  const purified = joinParts(input, outParts);
  return { original: input, purified, removed };
}

function findEOI(input: Uint8Array, start: number): number {
  for (let i = start; i + 1 < input.length; i++) {
    if (input[i] === 0xff && input[i + 1] === 0xd9) return i;
  }
  return -1;
}

function joinParts(input: Uint8Array, parts: { start: number; end: number }[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + (p.end - p.start), 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(input.subarray(p.start, p.end), o);
    o += p.end - p.start;
  }
  return out;
}

function purifyPNG(input: Uint8Array, onProgress?: (p: number) => void): PurifyResult {
  const removed: RemovedRange[] = [];
  if (!isPNG(input)) throw new Error("Invalid PNG header");
  // PNG signature
  const parts: { start: number; end: number }[] = [{ start: 0, end: 8 }];
  let pos = 8;
  const total = input.length;
  while (pos + 12 <= total) {
    if (onProgress) onProgress(Math.min(1, pos / total));
    const view = new DataView(input.buffer, input.byteOffset + pos);
    const len = view.getUint32(0, false);
    const type = String.fromCharCode(
      input[pos + 4],
      input[pos + 5],
      input[pos + 6],
      input[pos + 7]
    );
    const chunkStart = pos;
    const chunkEnd = pos + 12 + len;
    if (chunkEnd > total) throw new Error("Error: Malformed binary structure detected.");
    // Validate CRC of the chunk (type + data)
    const crcExpected =
      (input[chunkEnd - 4] << 24) |
      (input[chunkEnd - 3] << 16) |
      (input[chunkEnd - 2] << 8) |
      input[chunkEnd - 1];
    const crcComputed = pngCRC32(input, pos + 4, len + 4);
    if (crcComputed !== crcExpected) throw new Error("Error: Malformed binary structure detected.");
    const isText =
      type === "tEXt" || type === "zTXt" || type === "iTXt";
    if (isText) {
      removed.push({ start: chunkStart, end: chunkEnd, label: type });
    } else {
      parts.push({ start: chunkStart, end: chunkEnd });
    }
    pos = chunkEnd;
    if (type === "IEND") break;
  }
  const purified = joinParts(input, parts);
  return { original: input, purified, removed };
}

export async function purifyFile(
  file: File,
  onProgress?: (p: number) => void
): Promise<{
  type: "jpeg" | "png";
  beforeEntropy: number;
  afterEntropy: number;
  removed: RemovedRange[];
  purifiedFile: File;
  purifiedBytes: Uint8Array;
}> {
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const result = purifyFromBytes(file.name, bytes, onProgress);
    const outAb = new ArrayBuffer(result.purifiedBytes.length);
    new Uint8Array(outAb).set(result.purifiedBytes);
    const mime = result.type === "jpeg" ? "image/jpeg" : "image/png";
    const blob = new Blob([outAb], { type: mime });
    const ext = result.type === "jpeg" ? "jpg" : "png";
    const sanitized = `purified_file_${Date.now()}.${ext}`;
    const purifiedFile = new File([blob], sanitized, { type: mime, lastModified: 0 });
    return { ...result, purifiedFile, purifiedBytes: result.purifiedBytes };
  } catch {
    throw new Error("Error: Malformed binary structure detected.");
  }
}

export function purifyFromBytes(
  name: string,
  bytes: Uint8Array,
  onProgress?: (p: number) => void
): {
  type: "jpeg" | "png";
  beforeEntropy: number;
  afterEntropy: number;
  removed: RemovedRange[];
  purifiedBytes: Uint8Array;
} {
  const type = validateMagicBytes(bytes, name);
  const beforeEntropy = computeEntropy(bytes);
  let result: PurifyResult;
  if (type === "jpeg") {
    result = purifyJPEG(bytes, onProgress);
  } else {
    result = purifyPNG(bytes, onProgress);
  }
  const afterEntropy = computeEntropy(result.purified);
  return {
    type,
    beforeEntropy,
    afterEntropy,
    removed: result.removed,
    purifiedBytes: result.purified,
  };
}

function pngCRC32(buf: Uint8Array, offset: number, length: number): number {
  let c = 0xffffffff;
  for (let i = 0; i < length; i++) {
    c = crcTable[(c ^ buf[offset + i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

import { computeEntropy } from "../utils/Entropy";
