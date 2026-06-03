// ============================================================================
// stats.ts
// ----------------------------------------------------------------------------
// Cross-device user stats stored in Supabase (`user_stats` table).
//
// The localStorage counters in `achievements.ts` are per-device and feed
// the in-session unlock detection; this module is the *server-side* total
// that ProfileModal / public profiles display.
//
// The two are kept in sync by `components/achievements/SessionStatsSync.tsx`,
// which buffers local deltas and calls `saveSessionStats` periodically.
//
// Functions:
//   * `getServerStats`       — read the row
//   * `saveSessionStats`     — add a session delta (creates the row on first use)
//   * `incrementConnexions`  — +1 to the "rooms joined" counter
// ============================================================================

import { createClient } from "@/lib/supabase/client";

// User-visible totals — what gets shown on profile pages.
export type ServerStats = {
  notesPlayed: number;
  timePlayedSeconds: number;
  connexions: number;
};

// Returns null if the row doesn't exist yet (new user) OR if RLS / network
// blocks the read. Callers should treat null as "no data" rather than zero.
export async function getServerStats(userId: string): Promise<ServerStats | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_stats")
    .select("notes_played, time_played_seconds, connexions")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Surface to the console so RLS / network issues don't hide silently.
    console.warn("[stats] getServerStats failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    notesPlayed: data.notes_played ?? 0,
    timePlayedSeconds: data.time_played_seconds ?? 0,
    connexions: data.connexions ?? 0,
  };
}

// Pushes a session delta to the server's user_stats row. Returns true on success so the
// caller (SessionStatsSync.flush) only updates the sync watermark when the row actually
// landed — silent RLS failures don't poison future retries any more.
export async function saveSessionStats(
  userId: string,
  sessionSeconds: number,
  notesThisSession: number,
): Promise<boolean> {
  // Nothing to do — treat as success so the watermark advances anyway.
  if (sessionSeconds <= 0 && notesThisSession <= 0) return true;

  const supabase = createClient();

  // Read-modify-write — Postgres doesn't have an atomic upsert+increment
  // through the JS client, so we do it in two steps.
  const { data: existing, error: readErr } = await supabase
    .from("user_stats")
    .select("time_played_seconds, notes_played")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) {
    console.warn("[stats] saveSessionStats read failed:", readErr.message);
    return false;
  }

  if (existing) {
    // Row exists — add the deltas and write back.
    const { error: updErr } = await supabase
      .from("user_stats")
      .update({
        time_played_seconds: (existing.time_played_seconds ?? 0) + sessionSeconds,
        notes_played: (existing.notes_played ?? 0) + notesThisSession,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (updErr) {
      console.warn("[stats] saveSessionStats update failed:", updErr.message);
      return false;
    }
    return true;
  }

  // First-ever sync for this user — create the row.
  const { error: insErr } = await supabase.from("user_stats").insert({
    user_id: userId,
    time_played_seconds: sessionSeconds,
    notes_played: notesThisSession,
  });
  if (insErr) {
    console.warn("[stats] saveSessionStats insert failed:", insErr.message);
    return false;
  }
  return true;
}

// +1 to the "rooms joined" counter. Same read-modify-write pattern, since
// the row may not exist yet for a brand-new user.
export async function incrementConnexions(userId: string): Promise<void> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("user_stats")
    .select("connexions")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_stats")
      .update({
        connexions: existing.connexions + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    // No row yet — insert one with connexions = 1.
    await supabase.from("user_stats").insert({
      user_id: userId,
      connexions: 1,
    });
  }
}
