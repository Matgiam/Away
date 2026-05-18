import { createClient } from "@/lib/supabase/client";

export type ServerStats = {
  notesPlayed: number;
  timePlayedSeconds: number;
  connexions: number;
};

export async function getServerStats(userId: string): Promise<ServerStats | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_stats")
    .select("notes_played, time_played_seconds, connexions")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    notesPlayed: data.notes_played ?? 0,
    timePlayedSeconds: data.time_played_seconds ?? 0,
    connexions: data.connexions ?? 0,
  };
}

export async function saveSessionStats(
  userId: string,
  sessionSeconds: number,
  notesThisSession: number,
): Promise<void> {
  if (sessionSeconds <= 0 && notesThisSession <= 0) return;

  const supabase = createClient();

  const { data: existing } = await supabase
    .from("user_stats")
    .select("time_played_seconds, notes_played")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_stats")
      .update({
        time_played_seconds: existing.time_played_seconds + sessionSeconds,
        notes_played: existing.notes_played + notesThisSession,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await supabase.from("user_stats").insert({
      user_id: userId,
      time_played_seconds: sessionSeconds,
      notes_played: notesThisSession,
    });
  }
}

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
    await supabase.from("user_stats").insert({
      user_id: userId,
      connexions: 1,
    });
  }
}
