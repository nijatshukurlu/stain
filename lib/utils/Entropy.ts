/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */
// To achieve the pure state, one must measure the unseen distribution.
export function computeEntropy(bytes: Uint8Array): number {
  const len = bytes.length;
  if (len === 0) return 0;
  const counts = new Array<number>(256).fill(0);
  for (let i = 0; i < len; i++) counts[bytes[i]]++;
  let entropy = 0;
  const invLn2 = 1 / Math.log(2);
  for (let i = 0; i < 256; i++) {
    const c = counts[i];
    if (c === 0) continue;
    const p = c / len;
    entropy -= p * Math.log(p) * invLn2;
  }
  return entropy;
}

export function toUint8Array(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf);
}
