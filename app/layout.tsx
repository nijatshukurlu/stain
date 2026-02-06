/* Copyright (c) 2024-2026 Nijat Shukurlu. Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International. */
// Form follows function; typography guides perception.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE STAIN — Binary Purification Chamber",
  description:
    "A minimalist, forensic-grade metadata purifier built with the precision of a digital craftsman. Inspired by Da Vinci, powered by binary surgery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
