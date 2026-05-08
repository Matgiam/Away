import { createClient } from "@/lib/supabase/client";

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
