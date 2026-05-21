import { createClient } from "@/lib/supabase/client";

export type UploadDifficulty = "easy" | "medium" | "hard";

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
};

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
};

const BUCKET = "midi_uploads";
const TABLE = "user_song_uploads";
const UPLOAD_ID_PREFIX = "u:";

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

export async function getCurrentUserId(): Promise<string | null> {
	const supabase = createClient();
	const { data } = await supabase.auth.getUser();
	return data.user?.id ?? null;
}

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

export async function downloadUploadedMidi(storagePath: string): Promise<ArrayBuffer> {
	const supabase = createClient();
	const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
	if (error) throw error;
	return await data.arrayBuffer();
}

export type SaveUploadParams = {
	file: File;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	durationSeconds: number;
	bpm: number;
};

export async function saveUploadedSong(params: SaveUploadParams): Promise<UploadedSongMeta> {
	const supabase = createClient();
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	if (authError) throw authError;
	if (!user) throw new Error("You need to sign in to upload songs.");

	const fileId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

	const extMatch = params.file.name.match(/\.midi?$/i);
	const ext = extMatch ? extMatch[0].toLowerCase() : ".mid";
	const storagePath = `${user.id}/${fileId}${ext}`;

	const { error: storageError } = await supabase.storage
		.from(BUCKET)
		.upload(storagePath, params.file, {
			contentType: "audio/midi",
			upsert: false,
		});
	if (storageError) throw storageError;

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
		})
		.select("*")
		.single();

	if (insertError) {
		await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
		throw insertError;
	}

	return rowToMeta(data as UploadedSongRow);
}

export async function deleteUploadedSong(uploadId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromUploadId(uploadId);

	const { data: row, error: fetchError } = await supabase
		.from(TABLE)
		.select("storage_path")
		.eq("id", rowId)
		.maybeSingle();
	if (fetchError) throw fetchError;
	if (!row) return;

	const storagePath = (row as { storage_path: string }).storage_path;
	const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
	if (storageError) throw storageError;

	const { error: deleteError } = await supabase.from(TABLE).delete().eq("id", rowId);
	if (deleteError) throw deleteError;
}

export async function updateUploadedSongMeta(
	uploadId: string,
	patch: Partial<Pick<UploadedSongMeta, "title" | "artist" | "difficulty">>,
): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromUploadId(uploadId);
	const update: Record<string, unknown> = {};
	if (typeof patch.title === "string") update.title = patch.title;
	if (typeof patch.artist === "string") update.artist = patch.artist;
	if (patch.difficulty) update.difficulty = patch.difficulty;
	if (Object.keys(update).length === 0) return;
	const { error } = await supabase.from(TABLE).update(update).eq("id", rowId);
	if (error) throw error;
}
