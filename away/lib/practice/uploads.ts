// ============================================================================
// practice/uploads.ts
// ----------------------------------------------------------------------------
// Per-user MIDI uploads ("My uploads" tab in the practice menu).
//
// Each upload has two halves:
//   * The MIDI file itself — stored in the private `midi_uploads` Supabase
//     storage bucket under `${userId}/${uuid}.mid`.
//   * A `user_song_uploads` row holding the metadata the practice menu needs
//     (title, artist, difficulty, duration, BPM, …).
//
// Public ids are the row id prefixed with "u:" so the practice player can
// tell at a glance whether `[songId]` is a built-in, an upload (`u:…`), or
// a community pick (`c:…`, defined in community.ts).
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import type { SongCategoryKey } from "./songs";

export type UploadDifficulty = "easy" | "medium" | "hard";

// Raw row shape — snake_case as stored in Postgres.
export type UploadedSongRow = {
	id: string;
	user_id: string;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	storage_path: string;
	file_name: string;
	duration_seconds: number;
	bpm: number;
	is_public: boolean;
	play_count: number;
	created_at: string;
	community_submission_id: string | null;
	// Both nullable — only set when the upload came from audio transcription
	// and the user kept the source audio for sync playback.
	audio_storage_path: string | null;
	audio_file_name: string | null;
	// Sub-category within the user's Custom library. Null = "Uncategorized".
	// Constrained at the DB layer to the SongCategoryKey enum.
	category: SongCategoryKey | null;
};

// camelCase view used by the UI.
export type UploadedSongMeta = {
	id: string;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	fileName: string;
	durationSeconds: number;
	bpm: number;
	storagePath: string;
	createdAt: string;
	communitySubmissionId: string | null;
	audioStoragePath: string | null;
	audioFileName: string | null;
	category: SongCategoryKey | null;
};

const BUCKET = "midi_uploads";
const AUDIO_BUCKET = "audio_uploads";
const TABLE = "user_song_uploads";
// Public ids carry this prefix so callers can route "u:…" vs "c:…" vs
// built-in song ids through the right loader without a DB lookup.
const UPLOAD_ID_PREFIX = "u:";

// Public id ↔ row id helpers. Round-trip safe in both directions.
export function uploadIdFromRowId(rowId: string): string {
	return `${UPLOAD_ID_PREFIX}${rowId}`;
}

export function rowIdFromUploadId(uploadId: string): string {
	return uploadId.startsWith(UPLOAD_ID_PREFIX)
		? uploadId.slice(UPLOAD_ID_PREFIX.length)
		: uploadId;
}

export function isUploadId(id: string): boolean {
	return id.startsWith(UPLOAD_ID_PREFIX);
}

// Row → UI shape. Keeps snake_case out of every component.
function rowToMeta(row: UploadedSongRow): UploadedSongMeta {
	return {
		id: uploadIdFromRowId(row.id),
		title: row.title,
		artist: row.artist,
		difficulty: row.difficulty,
		fileName: row.file_name,
		durationSeconds: row.duration_seconds,
		bpm: row.bpm,
		storagePath: row.storage_path,
		createdAt: row.created_at,
		communitySubmissionId: row.community_submission_id ?? null,
		audioStoragePath: row.audio_storage_path ?? null,
		audioFileName: row.audio_file_name ?? null,
		category: row.category ?? null,
	};
}

// Link a private upload to a community submission so the upload list can show a
// "Pending" / "Published" badge. Cleared when the link goes away (set to null).
export async function setUploadCommunitySubmission(
	uploadId: string,
	communityRowId: string | null,
): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromUploadId(uploadId);
	const { error } = await supabase
		.from(TABLE)
		.update({ community_submission_id: communityRowId })
		.eq("id", rowId);
	if (error) throw error;
}

// Convenience wrapper so callers don't repeat the auth.getUser pattern.
export async function getCurrentUserId(): Promise<string | null> {
	const supabase = createClient();
	const { data } = await supabase.auth.getUser();
	return data.user?.id ?? null;
}

// List the current user's uploads, newest first. Returns [] for anonymous users.
export async function listUploadedSongs(): Promise<UploadedSongMeta[]> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from(TABLE)
		.select("*")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false });

	if (error) throw error;
	return ((data as UploadedSongRow[]) ?? []).map(rowToMeta);
}

// Single-upload fetch — used by /practice/play/[songId] when the id is an upload.
export async function getUploadedSongMeta(uploadId: string): Promise<UploadedSongMeta | null> {
	const supabase = createClient();
	const rowId = rowIdFromUploadId(uploadId);
	const { data, error } = await supabase
		.from(TABLE)
		.select("*")
		.eq("id", rowId)
		.maybeSingle();

	if (error) throw error;
	if (!data) return null;
	return rowToMeta(data as UploadedSongRow);
}

// Download the raw MIDI bytes from the private bucket. Used by the practice
// player when actually loading the file.
export async function downloadUploadedMidi(storagePath: string): Promise<ArrayBuffer> {
	const supabase = createClient();
	const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
	if (error) throw error;
	return await data.arrayBuffer();
}

// midi_uploads is a private bucket, so we can't hand the storage path to a
// raw fetch the way the community library does with its public bucket. Mint a
// short-lived signed URL instead — useMidiPreview's internal cache keys by URL,
// so each row keeps its own cache entry while previews are open.
export async function getUploadedSongSignedUrl(
	storagePath: string,
	expiresInSeconds = 120,
): Promise<string> {
	const supabase = createClient();
	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(storagePath, expiresInSeconds);
	if (error) throw error;
	if (!data?.signedUrl) throw new Error("Failed to sign upload URL");
	return data.signedUrl;
}

// Mint a short-lived signed URL for streaming the original audio (private bucket).
// Used by the practice player to drive the sync-playback HTMLAudioElement.
export async function getUploadedAudioSignedUrl(
	storagePath: string,
	expiresInSeconds = 3600,
): Promise<string> {
	const supabase = createClient();
	const { data, error } = await supabase.storage
		.from(AUDIO_BUCKET)
		.createSignedUrl(storagePath, expiresInSeconds);
	if (error) throw error;
	if (!data?.signedUrl) throw new Error("Failed to sign audio URL");
	return data.signedUrl;
}

// Args required to save a new upload (storage + DB). When the upload came from
// audio→MIDI transcription, `audioFile` carries the original source so we can
// store it alongside for sync playback.
export type SaveUploadParams = {
	file: File;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	durationSeconds: number;
	bpm: number;
	audioFile?: File;
	// Null saves the upload as "Uncategorized". Owners can change it later via
	// updateUploadedSongMeta. Validated at the DB by a CHECK constraint.
	category?: SongCategoryKey | null;
};

// Upload the MIDI (and optional source audio) to storage, then insert the
// metadata row. If anything in the chain fails we clean up the partial state
// so the user can retry without hitting "name already taken".
export async function saveUploadedSong(params: SaveUploadParams): Promise<UploadedSongMeta> {
	const supabase = createClient();
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	if (authError) throw authError;
	if (!user) throw new Error("You need to sign in to upload songs.");

	// Generate a unique storage path. Falls back to `${ts}-${rand}` on older
	// browsers / runtimes that don't have crypto.randomUUID.
	const fileId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

	const extMatch = params.file.name.match(/\.midi?$/i);
	const ext = extMatch ? extMatch[0].toLowerCase() : ".mid";
	const storagePath = `${user.id}/${fileId}${ext}`;

	// Step 1: MIDI upload.
	const { error: storageError } = await supabase.storage
		.from(BUCKET)
		.upload(storagePath, params.file, {
			contentType: "audio/midi",
			upsert: false,
		});
	if (storageError) throw storageError;

	// Step 2 (optional): source audio upload. Same fileId so the two files
	// share a stem and can be cleaned up together. Failure rolls back the
	// MIDI upload so the row never lands with a half-saved pair.
	let audioStoragePath: string | null = null;
	if (params.audioFile) {
		const audioExt = (params.audioFile.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mp3").toLowerCase();
		audioStoragePath = `${user.id}/${fileId}${audioExt}`;
		const { error: audioError } = await supabase.storage
			.from(AUDIO_BUCKET)
			.upload(audioStoragePath, params.audioFile, {
				contentType: params.audioFile.type || "audio/mpeg",
				upsert: false,
			});
		if (audioError) {
			await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
			throw audioError;
		}
	}

	// Step 3: metadata insert.
	const { data, error: insertError } = await supabase
		.from(TABLE)
		.insert({
			user_id: user.id,
			title: params.title.trim() || "Untitled",
			artist: params.artist.trim(),
			difficulty: params.difficulty,
			storage_path: storagePath,
			file_name: params.file.name,
			duration_seconds: params.durationSeconds,
			bpm: params.bpm,
			audio_storage_path: audioStoragePath,
			audio_file_name: params.audioFile?.name ?? null,
			category: params.category ?? null,
		})
		.select("*")
		.single();

	if (insertError) {
		// Roll back both storage uploads so the buckets don't accumulate orphans.
		await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
		if (audioStoragePath) {
			await supabase.storage.from(AUDIO_BUCKET).remove([audioStoragePath]).catch(() => {});
		}
		throw insertError;
	}

	return rowToMeta(data as UploadedSongRow);
}

// Delete both halves of an upload. Storage first so a row never points at a
// stale path; if the storage delete fails we don't drop the row. The source
// audio (if any) is removed best-effort — failing here doesn't block the rest
// of the delete because an orphan audio file is recoverable but a dangling row
// is the user-visible bug.
export async function deleteUploadedSong(uploadId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromUploadId(uploadId);

	const { data: row, error: fetchError } = await supabase
		.from(TABLE)
		.select("storage_path, audio_storage_path")
		.eq("id", rowId)
		.maybeSingle();
	if (fetchError) throw fetchError;
	if (!row) return; // already gone — treat as success

	const { storage_path: storagePath, audio_storage_path: audioStoragePath } =
		row as { storage_path: string; audio_storage_path: string | null };
	const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
	if (storageError) throw storageError;

	if (audioStoragePath) {
		await supabase.storage.from(AUDIO_BUCKET).remove([audioStoragePath]).catch(() => {});
	}

	const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", rowId);
	if (deleteError) throw deleteError;
}

// Partial update — only sends fields the caller specifies. No-op if `patch`
// has nothing meaningful in it (saves a round-trip). `category` accepts null
// explicitly so callers can reset a row back to "Uncategorized".
export async function updateUploadedSongMeta(
	uploadId: string,
	patch: Partial<Pick<UploadedSongMeta, "title" | "artist" | "difficulty" | "category">>,
): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromUploadId(uploadId);
	const update: Record<string, unknown> = {};
	if (typeof patch.title === "string") update.title = patch.title;
	if (typeof patch.artist === "string") update.artist = patch.artist;
	if (patch.difficulty) update.difficulty = patch.difficulty;
	// Hit the key check explicitly — `patch.category === null` is a real value
	// that means "clear it", and a truthy check would silently drop it.
	if ("category" in patch) update.category = patch.category ?? null;
	if (Object.keys(update).length === 0) return;
	const { error } = await supabase.from(TABLE).update(update).eq("id", rowId);
	if (error) throw error;
}
