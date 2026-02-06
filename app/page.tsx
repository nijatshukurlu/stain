/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */
// Purity is achieved when the essential remains and shadows fade.
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import HexViewer from "../components/ui/HexViewer";
import VitruvianLoader from "../components/ui/VitruvianLoader";
import { RemovedRange, MAX_FILE_SIZE } from "../lib/engine/Purifier";

type Metrics = {
  beforeEntropy: number;
  afterEntropy: number;
  type?: "jpeg" | "png";
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  // const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [purifiedBytes, setPurifiedBytes] = useState<Uint8Array | null>(null);
  const [removed, setRemoved] = useState<RemovedRange[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [downUrl, setDownUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleText, setConsoleText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const keyBuffer = useRef<string>("");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "~") {
        setConsoleOpen((o) => !o);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        keyBuffer.current = (keyBuffer.current + e.key).slice(-6);
        if (keyBuffer.current.toLowerCase() === "mirror") {
          setMirrored((m) => !m);
          keyBuffer.current = "";
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const processFile = useCallback(async (f: File) => {
    try {
      setFile(f);
      const buf = await f.arrayBuffer();
      const orig = new Uint8Array(buf);
      setOriginalBytes(orig);
      setProgress(0);
      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL("../lib/workers/purifyWorker.ts", import.meta.url),
          { type: "module" }
        );
      }
      const w = workerRef.current;
      w.onmessage = (e: MessageEvent) => {
        const { kind } = e.data;
        if (kind === "progress") {
          setProgress(e.data.value);
        } else if (kind === "result") {
          const res = e.data.result as {
            type: "jpeg" | "png";
            beforeEntropy: number;
            afterEntropy: number;
            removed: RemovedRange[];
            purifiedBytes: Uint8Array;
          };
          setRemoved(res.removed);
          setPurifiedBytes(res.purifiedBytes);
          setMetrics({
            beforeEntropy: res.beforeEntropy,
            afterEntropy: res.afterEntropy,
            type: res.type,
          });
          if (downUrl) URL.revokeObjectURL(downUrl);
          const mime = res.type === "jpeg" ? "image/jpeg" : "image/png";
          const ext = res.type === "jpeg" ? "jpg" : "png";
          const outAb = new ArrayBuffer(res.purifiedBytes.length);
          new Uint8Array(outAb).set(res.purifiedBytes);
          const blob = new Blob([outAb], { type: mime });
          const filename = `purified_file_${Date.now()}.${ext}`;
          const fileObj = new File([blob], filename, { type: mime, lastModified: 0 });
          const url = URL.createObjectURL(fileObj);
          setDownUrl(url);
          const lines = res.removed.map(
            (r) => `Stripped ${r.label} @ [${r.start}-${r.end})`
          );
          let text = "[STATUS] Stealth Mode Active. Zero footprints generated.";
          for (const line of lines) {
            text += "\n" + line;
          }
          setConsoleText(text);
        } else if (kind === "error") {
          setErrorText(e.data.message);
        }
      };
      w.postMessage({ name: f.name, buffer: buf }, [buf]);
    } catch (e: unknown) {
      let message: string | null = null;
      if (typeof e === "object" && e && "message" in e) {
        const m = (e as { message?: unknown }).message;
        if (typeof m === "string") message = m;
      }
      setErrorText(message || "Error: Malformed binary structure detected.");
    }
  }, [downUrl]);

  const onSelect = useCallback(async (f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      setShowSizeModal(true);
      setErrorText("Surgical Safety: File exceeds 100MB hard limit.");
      return;
    }
    processFile(f);
  }, [processFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onSelect(f);
  }, [onSelect]);
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onSelect(f);
  }, [onSelect]);

  const wrapperStyle = useMemo(
    () => ({ transform: mirrored ? "scaleX(-1)" : "none" }),
    [mirrored]
  );

  return (
    <motion.div
      className="min-h-screen text-zinc-200"
      style={wrapperStyle}
    >
      <main className="mx-auto max-w-4xl p-13">
        <h1 className="font-serif text-4xl mb-5">The Stain</h1>
        <div className="text-xs text-zinc-500 mb-8">By Nijat Shukurlu</div>
        <p className="text-sm text-zinc-400 mb-5">
          Zero-knowledge metadata purification for JPEG and PNG.
        </p>

        <div
          className="border-thin border-zinc-800 rounded p-8 bg-black/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <div className="flex items-center gap-13">
            <input
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="text-sm"
              onChange={onChange}
            />
            <button
              disabled={!downUrl}
              onClick={() => {
                if (downUrl && file) {
                  const a = document.createElement("a");
                  a.href = downUrl;
                  a.download = file.name;
                  a.click();
                }
              }}
              className="px-5 py-2 border-thin rounded border-zinc-800 hover:bg-zinc-900"
            >
              Download Purified
            </button>
          </div>
        </div>

        <div className="mt-8 grid-phi gap-13">
          <div>
            <h2 className="font-serif text-xl mb-5">Progress</h2>
            <VitruvianLoader progress={progress} />
            {metrics && (
              <div className="mt-5 text-xs text-zinc-400">
                <div>Type: {metrics.type}</div>
                <div>Entropy (before): {metrics.beforeEntropy.toFixed(4)} bits</div>
                <div>Entropy (after): {metrics.afterEntropy.toFixed(4)} bits</div>
              </div>
            )}
          </div>
          <div>
            <h2 className="font-serif text-xl mb-5">Hex Viewer</h2>
            {purifiedBytes ? (
              <HexViewer data={purifiedBytes} removed={removed} />
            ) : originalBytes ? (
              <HexViewer data={originalBytes} />
            ) : (
              <div className="text-zinc-500 text-sm">Load a file to view hex.</div>
            )}
          </div>
        </div>
      </main>

      {consoleOpen && (
        <div className="fixed bottom-5 right-5 w-[40vw] max-w-xl rounded border-thin border-zinc-800 bg-black/70 p-5">
          <div className="font-serif mb-3">Analyst Console</div>
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap">{consoleText}</pre>
        </div>
      )}
      {showSizeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="rounded border-thin border-zinc-800 bg-black p-13 max-w-md text-center">
            <div className="text-sm text-zinc-200 mb-8">
              Surgical Safety: File exceeds 100MB hard limit.
            </div>
            <button
              className="px-5 py-2 border-thin rounded border-zinc-800 hover:bg-zinc-900"
              onClick={() => setShowSizeModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {errorText && (
        <div className="fixed bottom-5 left-5 rounded border-thin border-red-800 bg-red-900/30 p-8 text-red-100">
          {errorText}
        </div>
      )}
      <footer className="mt-21 text-center text-[11px] text-zinc-500">
        © 2024-2026 Nijat Shukurlu. All rights reserved.
      </footer>
    </motion.div>
  );
}
