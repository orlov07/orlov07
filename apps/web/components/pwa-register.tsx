"use client";

import { useEffect } from "react";
import { removeLegacyDemoMatches } from "@/lib/local-match-store";

export function PwaRegister() {
  useEffect(() => {
    void removeLegacyDemoMatches().catch(() => undefined);
    const pending = localStorage.getItem("setra-match");
    if (pending) {
      try {
        const data = JSON.parse(pending) as { teamA?: string; teamB?: string };
        const names = [data.teamA, data.teamB].map(value => value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()).sort();
        if (names[0] === "julia & ana" && names[1] === "lara & bia") localStorage.removeItem("setra-match");
      } catch {
        localStorage.removeItem("setra-match");
      }
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
