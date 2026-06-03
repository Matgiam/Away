// ============================================================================
// achievements/AchievementBannerHost.tsx
// ----------------------------------------------------------------------------
// Sits in the root layout, listens for ACHIEVEMENT_UNLOCK_EVENT from anywhere
// in the app, and renders one AchievementBanner at a time. When the current
// banner dismisses, the host drops it from the queue and the next one (if
// any) renders automatically.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { AchievementBanner } from "./AchievementBanner";
import { ACHIEVEMENT_UNLOCK_EVENT, type Achievement } from "@/lib/achievements";

// Listens for achievement unlock events anywhere in the app and shows a banner per unlock.
// Multiple unlocks queue up and play one after the other.
export function AchievementBannerHost() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnlock = (e: Event) => {
      const detail = (e as CustomEvent<Achievement>).detail;
      if (!detail) return;
      setQueue((prev) => [...prev, detail]);
    };
    window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock);
  }, []);

  if (!current) return null;

  return (
    <AchievementBanner
      key={current.id}
      achievement={current}
      onDismiss={() => setQueue((prev) => prev.slice(1))}
    />
  );
}
