/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */

self.onmessage = async (e: MessageEvent) => {
  const { name, buffer } = e.data as { name: string; buffer: ArrayBuffer };
  try {
    const bytes = new Uint8Array(buffer);
    // Progress messaging is coarse in worker for simplicity
    (self as unknown as Worker).postMessage({ kind: "progress", value: 0.1 });
    const { purifyFromBytes } = await import("../engine/Purifier");
    const result = purifyFromBytes(name, bytes, (p) => {
      (self as unknown as Worker).postMessage({ kind: "progress", value: p });
    });
    (self as unknown as Worker).postMessage({ kind: "result", result });
  } catch {
    (self as unknown as Worker).postMessage({
      kind: "error",
      message: "Error: Malformed binary structure detected.",
    });
  }
};
