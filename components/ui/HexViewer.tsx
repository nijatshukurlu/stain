/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */
// To reveal structure, one must see the pattern beneath symbols.
import React from "react";

export type HexViewerProps = {
  data: Uint8Array;
  removed?: { start: number; end: number; label?: string }[];
  bytesPerRow?: number;
};

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function isRemoved(index: number, ranges: { start: number; end: number }[]): boolean {
  for (const r of ranges) {
    if (index >= r.start && index < r.end) return true;
  }
  return false;
}

export default function HexViewer({
  data,
  removed = [],
  bytesPerRow = 16,
}: HexViewerProps) {
  const rows: React.ReactElement[] = [];
  const removedRanges = removed.map((r) => ({ start: r.start, end: r.end }));
  for (let i = 0; i < data.length; i += bytesPerRow) {
    const rowBytes = data.subarray(i, Math.min(i + bytesPerRow, data.length));
    const cells = [];
    for (let j = 0; j < rowBytes.length; j++) {
      const idx = i + j;
      const hex = toHex(rowBytes[j]).toUpperCase();
      const removedCell = isRemoved(idx, removedRanges);
      cells.push(
        <span
          key={j}
          className={`px-2 py-1 border border-zinc-700 text-xs font-mono ${
            removedCell ? "bg-red-900 text-red-100" : "bg-zinc-900 text-zinc-200"
          }`}
        >
          {hex}
        </span>
      );
    }
    rows.push(
      <div key={i} className="flex gap-1">
        <span className="w-16 text-zinc-500 font-mono text-xs">{i.toString(16).padStart(8, "0")}</span>
        <div className="flex flex-wrap gap-1">{cells}</div>
      </div>
    );
  }
  return (
    <div className="rounded border border-zinc-800 p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-950 to-black overflow-auto max-h-[50vh]">
      {rows}
    </div>
  );
}
