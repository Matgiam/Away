import { createClient } from "@/lib/supabase/client";

export type RecordingState = "idle" | "countdown" | "recording";

export async function uploadRecording(
  userId: string,
  blob: Blob,
  duration: number,
): Promise<string | null> {
  const supabase = createClient();
  const fileName = `${userId}/${Date.now()}.webm`;
  const { error: uploadError } = await supabase.storage
    .from("recordings")
    .upload(fileName, blob);

  if (uploadError) {
    console.error("Upload failed", uploadError);
    return null;
  }

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

export async function getUserRecordings(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch recordings failed", error);
    return [];
  }

  const withUrls = await Promise.all(
    (data ?? []).map(async (r) => {
      const { data: urlData } = await supabase.storage
        .from("recordings")
        .createSignedUrl(r.storage_path, 3600);
      return { ...r, url: urlData?.signedUrl ?? null };
    }),
  );

  return withUrls;
}

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
