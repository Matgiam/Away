"use client";

import { useEffect } from "react";
import { incrementTotalSeconds, checkAndUnlockAchievements } from "@/lib/achievements";

// Increments the cumulative "time on Away" counter once a second while the tab is visible.
// Mounted once at the root layout so every page contributes.
export function TimeTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let lastTick = Date.now();

    const start = () => {
      if (interval) return;
      lastTick = Date.now();
      interval = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        const now = Date.now();
        const deltaSeconds = Math.floor((now - lastTick) / 1000);
        if (deltaSeconds <= 0) return;
        lastTick = now;
        incrementTotalSeconds(deltaSeconds);
        checkAndUnlockAchievements();
      }, 1000);
    };

    const stop = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        lastTick = Date.now();
        start();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    if (document.visibilityState === "visible") start();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, []);

  return null;
}
