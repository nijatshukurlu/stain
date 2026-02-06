/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */
// Progress emerges as geometry approaches completion.
import React from "react";
import { motion } from "framer-motion";

export type VitruvianLoaderProps = {
  progress: number; // 0..1
};

export default function VitruvianLoader({ progress }: VitruvianLoaderProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const length = 400;
  const dashOffset = length * (1 - clamped);
  return (
    <div className="flex items-center justify-center p-5">
      <svg
        viewBox="0 0 200 200"
        width="200"
        height="200"
        className="text-zinc-200"
      >
        <defs>
          <radialGradient id="parchment" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#111" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="200" height="200" fill="url(#parchment)" />
        <motion.circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          initial={{ rotate: 0 }}
          animate={{ rotate: clamped * 360 }}
          transition={{ type: "tween", duration: 0.4 }}
        />
        <motion.path
          d="M 20 180 C 55 145, 145 55, 180 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray={length}
          strokeDashoffset={dashOffset}
        />
      </svg>
    </div>
  );
}
