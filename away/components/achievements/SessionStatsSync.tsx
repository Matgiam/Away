"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getServerStats, saveSessionStats } from "@/lib/stats";
import {
  getTotalNotes,
  getTotalSeconds,
  setTotalNotes,
  setTotalSeconds,
  checkAndUnlockAchievements,
} from "@/lib/achievements";

const LAST_SYNC_NOTES_KEY = "away:last_sync_notes";
const LAST_SYNC_SECONDS_KEY = "away:last_sync_seconds";
const FLUSH_INTERVAL_MS = 30_000;

function readSyncMark(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeSyncMark(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

// Keeps localStorage stats (used by achievement UI) and server user_stats (shown on the
// profile page) in lock-step:
//   1. On first mount once we know the user, bootstrap localStorage from the server so the
//      achievement hover and the profile page start at the same number.
//   2. Every 30 seconds — and again on tab hide / unload — push any local growth that hasn't
//      been sent yet as a delta to user_stats.
export function SessionStatsSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let userId: string | null = null;
    let bootstrapped = false;
    let flushing = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const flush = async () => {
      if (!userId || !bootstrapped || flushing) return;
      const currentNotes = getTotalNotes();
      const currentSeconds = getTotalSeconds();
      const lastNotes = readSyncMark(LAST_SYNC_NOTES_KEY);
      const lastSeconds = readSyncMark(LAST_SYNC_SECONDS_KEY);
      const deltaNotes = currentNotes - lastNotes;
      const deltaSeconds = currentSeconds - lastSeconds;
      if (deltaNotes <= 0 && deltaSeconds <= 0) return;
      flushing = true;
      try {
        await saveSessionStats(userId, Math.max(0, deltaSeconds), Math.max(0, deltaNotes));
        writeSyncMark(LAST_SYNC_NOTES_KEY, currentNotes);
        writeSyncMark(LAST_SYNC_SECONDS_KEY, currentSeconds);
      } catch {
        // Network issue or transient error — leave the marks alone so the next tick retries.
      } finally {
        flushing = false;
      }
    };

    // Pull authoritative totals from the server once, then promote localStorage up to that
    // baseline so the achievement counters reflect cross-device history.
    const bootstrap = async (id: string) => {
      userId = id;
      try {
        const server = await getServerStats(id);
        if (server) {
          if (server.notesPlayed > getTotalNotes()) {
            setTotalNotes(server.notesPlayed);
          }
          if (server.timePlayedSeconds > getTotalSeconds()) {
            setTotalSeconds(server.timePlayedSeconds);
          }
          // Mark everything up to the current local total as "already synced" — any growth
          // from this point is what we'll push on the next flush.
          writeSyncMark(LAST_SYNC_NOTES_KEY, getTotalNotes());
          writeSyncMark(LAST_SYNC_SECONDS_KEY, getTotalSeconds());
          // The bumped totals may have unlocked something.
          checkAndUnlockAchievements();
        } else {
          // No row yet — whatever's in localStorage will get pushed on the first flush.
          writeSyncMark(LAST_SYNC_NOTES_KEY, 0);
          writeSyncMark(LAST_SYNC_SECONDS_KEY, 0);
        }
      } catch {
        writeSyncMark(LAST_SYNC_NOTES_KEY, getTotalNotes());
        writeSyncMark(LAST_SYNC_SECONDS_KEY, getTotalSeconds());
      }
      bootstrapped = true;
    };

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void bootstrap(data.user.id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (nextUserId === userId) return;
      if (nextUserId) {
        bootstrapped = false;
        void bootstrap(nextUserId);
      } else {
        userId = null;
        bootstrapped = false;
      }
    });

    interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onBeforeUnload = () => {
      // Best-effort: this fires synchronously and the request may be aborted, but the
      // 30s interval will catch any remainder on the next session anyway.
      void flush();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onBeforeUnload);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onBeforeUnload);
      authListener?.subscription.unsubscribe();
      void flush();
    };
  }, []);

  return null;
}
