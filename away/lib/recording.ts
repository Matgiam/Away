// ============================================================================
// recording.ts
// ----------------------------------------------------------------------------
// Supabase data-access for screen recordings.
//
// Each recording is a WebM blob produced by `hooks/useRecording.ts` (which
// merges getDisplayMedia + getUserMedia → MediaRecorder). This module handles
// the persistence side:
//
//   * `uploadRecording`  — uploads the blob to the `recordings` bucket and
//                          inserts a row in the `recordings` table.
//   * `getUserRecordings` — list of recordings for a user, each with a 1-hour
//                          signed URL so the playback `<video>` can load them.
//   * `deleteRecording`   — removes both the storage file and the DB row.
//
// The on-disk path is `${userId}/${timestamp}.webm` — user-scoped folders
// make storage RLS policies trivial ("can read anything under your own id").
// ============================================================================

import { createClient } from "@/lib/supabase/client";

// Used by the recording UI to track its three states.
//   idle      — nothing happening
//   countdown — 3-2-1 before recording actually starts
//   recording — MediaRecorder is active
export type RecordingState = "idle" | "countdown" | "recording";

// Window event fired by `useRecording` after a recording has been successfully
// uploaded to Supabase. The root-layout-mounted RecordingSavedBannerHost
// listens for these and pops a toast pointing the user at Profile → Recordings.
// Mirrors the ACHIEVEMENT_UNLOCK_EVENT pattern so the two banners share
// behaviour (queueing, GSAP entry, auto-dismiss).
export const RECORDING_SAVED_EVENT = "away:recording-saved";

// Upload `blob` to storage AND insert a metadata row. Returns the storage
// path on success or null on any failure.
export async function uploadRecording(
  userId: string,
  blob: Blob,
  duration: number,
): Promise<string | null> {
  const supabase = createClient();
  // Per-user folder + timestamp ensures uniqueness without a UUID lookup.
  const fileName = `${userId}/${Date.now()}.webm`;

  // Step 1: upload the blob into the `recordings` bucket.
  const { error: uploadError } = await supabase.storage
    .from("recordings")
    .upload(fileName, blob);

  if (uploadError) {
    console.error("Upload failed", uploadError);
    return null;
  }

  // Step 2: create the matching row so we can list it later.
  // Duration is rounded — sub-second precision isn't useful for the UI.
  const { error: dbError } = await supabase.from("recordings").insert({
    user_id: userId,
    storage_path: fileName,
    duration: Math.round(duration),
  });

  if (dbError) {
    console.error("DB insert failed", dbError);
    return null;
  }

  return fileName;
}

// List a user's recordings, newest first, with playback URLs attached.
// Storage URLs are signed (private bucket); the 3600s TTL is fine for a
// session — by the time it expires the user has either watched the recording
// or moved on.
export async function getUserRecordings(userId: string) {
  const supabase = createClient();
  // Pull metadata rows first — light query.
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch recordings failed", error);
    return [];
  }

  // Attach a signed URL to each row. Parallel so the round-trips stack.
  const withUrls = await Promise.all(
    (data ?? []).map(async (r) => {
      const { data: urlData } = await supabase.storage
        .from("recordings")
        .createSignedUrl(r.storage_path, 3600); // 1 hour
      return { ...r, url: urlData?.signedUrl ?? null };
    }),
  );

  return withUrls;
}

// Delete both halves of a recording — storage file then DB row. We delete
// storage first because if the bucket op fails we want to keep the row
// (otherwise the user would lose the record without freeing the storage).
export async function deleteRecording(
  recordingId: string,
  storagePath: string,
): Promise<boolean> {
  const supabase = createClient();
  const { error: storageError } = await supabase.storage
    .from("recordings")
    .remove([storagePath]);

  if (storageError) {
    console.error("Storage delete failed", storageError);
    return false;
  }

  const { error: dbError } = await supabase
    .from("recordings")
    .delete()
    .eq("id", recordingId);

  if (dbError) {
    console.error("DB delete failed", dbError);
    return false;
  }

  return true;
}
