"use client";

import { useEffect } from "react";

/** Auto-triggers window.print() after the page renders */
export default function PrintTrigger() {
  useEffect(() => {
    // Small delay so the page fully renders before the print dialog opens
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);

  return null;
}
