// ============================================================================
// practice/community.ts
// ----------------------------------------------------------------------------
// Community MIDI library (the "Community" tab in the practice menu).
//
// Three flows live here:
//   1. **Submission** — users publish one of their private uploads to the
//      community pool. Goes into `community_midis` with status="pending".
//   2. **Browsing**   — any signed-in user can list approved community MIDIs,
//      search, preview, and add them to their personal collection.
//   3. **Admin**      — admins (profiles.is_admin = true) approve or reject
//      pending submissions.
//
// Public ids are prefixed with "c:" — same scheme as `uploads.ts` uses "u:" —
// so the router can dispatch on the prefix without a DB hit.
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import {
	downloadUploadedAudio,
	downloadUploadedMidi,
	setUploadCommunitySubmission,
	type UploadDifficulty,
	type UploadedSongMeta,
} from "./uploads";
import type { SongCategoryKey } from "./songs";

// Review state machine: submissions land as "pending" and get one of the
// other two states after admin review.
export type CommunityStatus = "pending" | "approved" | "rejected";

// Raw row from `community_midis`.
export type CommunityMidiRow = {
	id: string;
	submitter_id: string;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	storage_path: string;
	file_name: string;
	duration_seconds: number;
	bpm: number;
	status: CommunityStatus;
	reviewed_by: string | null;
	reviewed_at: string | null;
	review_note: string | null;
	play_count: number;
	created_at: string;
	// Carried over from the source private upload at publish time so the
	// community library can be sub-categorized the same way as built-ins.
	// Null = "Uncategorized".
	category: SongCategoryKey | null;
	// Source audio file (from transcription) — stored in the community bucket
	// so anyone can hear the original recording alongside the MIDI playback.
	audio_storage_path: string | null;
	audio_file_name: string | null;
};

// UI shape — camelCase + a resolved submitter username.
export type CommunityMidi = {
	id: string;
	submitterId: string;
	submitterUsername: string | null;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	fileName: string;
	durationSeconds: number;
	bpm: number;
	storagePath: string;
	status: CommunityStatus;
	reviewNote: string | null;
	playCount: number;
	createdAt: string;
	reviewedAt: string | null;
	category: SongCategoryKey | null;
	audioStoragePath: string | null;
	audioFileName: string | null;
};

const BUCKET = "community_midis";
const TABLE = "community_midis";
// Separate table for "I added this community MIDI to my collection" links.
const ADDITIONS_TABLE = "community_midi_additions";
const COMMUNITY_ID_PREFIX = "c:";

// Public id ↔ row id helpers, same scheme as uploads.ts.
export function communityIdFromRowId(rowId: string): string {
	return `${COMMUNITY_ID_PREFIX}${rowId}`;
}

export function rowIdFromCommunityId(id: string): string {
	return id.startsWith(COMMUNITY_ID_PREFIX) ? id.slice(COMMUNITY_ID_PREFIX.length) : id;
}

export function isCommunityId(id: string): boolean {
	return id.startsWith(COMMUNITY_ID_PREFIX);
}

// Row → UI shape. `submitterUsername` is filled in by `attachUsernames`.
function rowToMidi(row: CommunityMidiRow, submitterUsername: string | null = null): CommunityMidi {
	return {
		id: communityIdFromRowId(row.id),
		submitterId: row.submitter_id,
		submitterUsername,
		title: row.title,
		artist: row.artist,
		difficulty: row.difficulty,
		fileName: row.file_name,
		durationSeconds: Number(row.duration_seconds),
		bpm: row.bpm,
		storagePath: row.storage_path,
		status: row.status,
		reviewNote: row.review_note,
		playCount: row.play_count,
		createdAt: row.created_at,
		reviewedAt: row.reviewed_at,
		category: row.category ?? null,
		audioStoragePath: row.audio_storage_path ?? null,
		audioFileName: row.audio_file_name ?? null,
	};
}

// Batch-resolve submitter ids → usernames so a list of N rows costs 1 extra
// query rather than N. Mirrors the friends.ts pattern.
async function attachUsernames(rows: CommunityMidiRow[]): Promise<CommunityMidi[]> {
	if (rows.length === 0) return [];
	const supabase = createClient();
	const ids = Array.from(new Set(rows.map((r) => r.submitter_id)));
	const { data } = await supabase.from("profiles").select("id, username").in("id", ids);
	const nameById = new Map<string, string>();
	for (const p of (data as { id: string; username: string | null }[] | null) ?? []) {
		if (p.username) nameById.set(p.id, p.username);
	}
	return rows.map((row) => rowToMidi(row, nameById.get(row.submitter_id) ?? null));
}

// -----------------------------------------------------------------------------
// Admin check
// -----------------------------------------------------------------------------

// True if the logged-in user has profiles.is_admin = true. Used to gate the
// /admin/midi-review route and the admin actions below.
export async function isCurrentUserAdmin(): Promise<boolean> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return false;
	const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
	return !!(data as { is_admin: boolean } | null)?.is_admin;
}

// -----------------------------------------------------------------------------
// Submission flow (user-facing)
// -----------------------------------------------------------------------------

// Inputs for `submitCommunityMidi`.
export type SubmitParams = {
	file: File;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	durationSeconds: number;
	bpm: number;
	category?: SongCategoryKey | null;
	audioFile?: File;
};

// Upload to the community bucket + create the pending row. Same orphan-cleanup
// pattern as uploads.saveUploadedSong.
export async function submitCommunityMidi(params: SubmitParams): Promise<CommunityMidi> {
	const supabase = createClient();
	const { data: { user }, error: authError } = await supabase.auth.getUser();
	if (authError) throw authError;
	if (!user) throw new Error("You need to sign in to publish a MIDI.");

	const fileId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

	const extMatch = params.file.name.match(/\.midi?$/i);
	const ext = extMatch ? extMatch[0].toLowerCase() : ".mid";
	const storagePath = `${user.id}/${fileId}${ext}`;

	const { error: storageError } = await supabase.storage
		.from(BUCKET)
		.upload(storagePath, params.file, { contentType: "audio/midi", upsert: false });
	if (storageError) throw storageError;

	let audioStoragePath: string | null = null;
	if (params.audioFile) {
		const audioExt = (params.audioFile.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".mp3").toLowerCase();
		audioStoragePath = `${user.id}/${fileId}${audioExt}`;
		const { error: audioError } = await supabase.storage
			.from(BUCKET)
			.upload(audioStoragePath, params.audioFile, {
				contentType: params.audioFile.type || "audio/mpeg",
				upsert: false,
			});
		if (audioError) {
			await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
			throw audioError;
		}
	}

	const { data, error: insertError } = await supabase
		.from(TABLE)
		.insert({
			submitter_id: user.id,
			title: params.title.trim() || "Untitled",
			artist: params.artist.trim(),
			difficulty: params.difficulty,
			storage_path: storagePath,
			file_name: params.file.name,
			duration_seconds: params.durationSeconds,
			bpm: params.bpm,
			status: "pending",
			category: params.category ?? null,
			audio_storage_path: audioStoragePath,
			audio_file_name: params.audioFile?.name ?? null,
		})
		.select("*")
		.single();

	if (insertError) {
		await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
		if (audioStoragePath) {
			await supabase.storage.from(BUCKET).remove([audioStoragePath]).catch(() => {});
		}
		throw insertError;
	}

	return rowToMidi(data as CommunityMidiRow);
}

// Submit using an already-uploaded private file: we re-upload its bytes into the
// community bucket. We don't move the existing private file because the user might
// want to keep their personal copy. After insert, we write the new community row id
// back onto the private upload so the UI can show "Pending" / "Approved" badges.
export async function submitFromExistingUpload(
	upload: UploadedSongMeta,
	overrides: { title?: string; artist?: string; difficulty?: UploadDifficulty; category?: SongCategoryKey | null },
): Promise<CommunityMidi> {
	// Pull the original MIDI bytes from the private bucket.
	const buffer = await downloadUploadedMidi(upload.storagePath);
	const blob = new Blob([buffer], { type: "audio/midi" });
	const file = new File([blob], upload.fileName, { type: "audio/midi" });

	// Pull the source audio too if it exists.
	let audioFile: File | undefined;
	if (upload.audioStoragePath) {
		const audioBuffer = await downloadUploadedAudio(upload.audioStoragePath);
		const audioBlob = new Blob([audioBuffer]);
		audioFile = new File([audioBlob], upload.audioFileName || "audio.mp3");
	}

	const result = await submitCommunityMidi({
		file,
		title: overrides.title ?? upload.title,
		artist: overrides.artist ?? upload.artist,
		difficulty: overrides.difficulty ?? upload.difficulty,
		durationSeconds: upload.durationSeconds,
		bpm: upload.bpm,
		// Carry the upload's category through unless the publisher explicitly
		// overrides it in the publish dialog (e.g. correcting before public release).
		category: "category" in overrides ? overrides.category : upload.category,
		audioFile,
	});

	// Best-effort link back to the private upload — failure is non-fatal.
	await setUploadCommunitySubmission(upload.id, rowIdFromCommunityId(result.id)).catch(() => {});
	return result;
}

// List the current user's submissions across all statuses (so they can see
// pending + approved + rejected in one place).
export async function listMyCommunitySubmissions(): Promise<CommunityMidi[]> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from(TABLE)
		.select("*")
		.eq("submitter_id", user.id)
		.order("created_at", { ascending: false });
	if (error) throw error;
	return attachUsernames((data as CommunityMidiRow[]) ?? []);
}

// Withdraw / delete a submission. Removes storage file + DB row.
export async function withdrawCommunitySubmission(communityId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);

	const { data: row } = await supabase
		.from(TABLE)
		.select("storage_path, audio_storage_path, status")
		.eq("id", rowId)
		.maybeSingle();
	if (!row) return;

	const r = row as { storage_path: string; audio_storage_path: string | null; status: CommunityStatus };
	const paths = [r.storage_path];
	if (r.audio_storage_path) paths.push(r.audio_storage_path);
	await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
	const { error } = await supabase.from(TABLE).delete().eq("id", rowId);
	if (error) throw error;
}

// -----------------------------------------------------------------------------
// Public library (any signed-in user)
// -----------------------------------------------------------------------------

export const COMMUNITY_PAGE_SIZE = 50;

export type CommunityListParams = {
	offset?: number;
	limit?: number;
	// When set, search is server-side via ilike on title and artist. Searching
	// returns up to `limit` rows in one shot; pagination is disabled for searches
	// because users expect to see *all* matches at once.
	search?: string;
	// Sub-category filter for the per-category tabs in the Community view.
	// "uncategorized" means rows whose `category` column is null; any
	// SongCategoryKey filters by an exact match; undefined means no filter.
	category?: SongCategoryKey | "uncategorized";
};

export type CommunityListPage = {
	items: CommunityMidi[];
	hasMore: boolean;
};

// Strip ilike wildcards from user input so a search for "10%" doesn't become a
// pattern. Also strip the characters PostgREST uses as separators inside .or().
function sanitizeIlike(term: string): string {
	return term.replace(/[%_,()*]/g, "").trim();
}

// Paginated list of approved community MIDIs. `search` switches to a single-
// page filtered view (see comment on CommunityListParams).
export async function listApprovedCommunityMidis(
	params: CommunityListParams = {},
): Promise<CommunityListPage> {
	const supabase = createClient();
	const limit = params.limit ?? COMMUNITY_PAGE_SIZE;
	const offset = params.offset ?? 0;
	const term = params.search ? sanitizeIlike(params.search) : "";

	let query = supabase.from(TABLE).select("*").eq("status", "approved");

	if (term) {
		// PostgREST .or(): "title.ilike.%foo%,artist.ilike.%foo%" → title OR artist.
		query = query.or(`title.ilike.%${term}%,artist.ilike.%${term}%`);
	}

	if (params.category === "uncategorized") {
		query = query.is("category", null);
	} else if (params.category) {
		query = query.eq("category", params.category);
	}

	query = query
		.order("created_at", { ascending: false })
		.range(offset, offset + limit - 1);

	const { data, error } = await query;
	if (error) throw error;

	const rows = (data as CommunityMidiRow[]) ?? [];
	const items = await attachUsernames(rows);
	// We can't cheaply know total count without a separate query, so use the
	// "got a full page" heuristic. Search results don't paginate.
	const hasMore = !term && rows.length === limit;
	return { items, hasMore };
}

// Fetch one community MIDI by public id (used by /practice/play/[songId]).
export async function getCommunityMidi(communityId: string): Promise<CommunityMidi | null> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);
	const { data, error } = await supabase
		.from(TABLE)
		.select("*")
		.eq("id", rowId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	const list = await attachUsernames([data as CommunityMidiRow]);
	return list[0] ?? null;
}

// Approved bucket is public, so we can use the CDN URL directly — no signed URL
// round-trip on every preview hover.
export function getCommunityMidiPublicUrl(storagePath: string): string {
	const supabase = createClient();
	const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
	return data.publicUrl;
}

export function getCommunityAudioPublicUrl(storagePath: string): string {
	const supabase = createClient();
	const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
	return data.publicUrl;
}

// Pull the MIDI bytes for actual playback.
export async function downloadCommunityMidi(storagePath: string): Promise<ArrayBuffer> {
	const supabase = createClient();
	const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
	if (error) throw error;
	return await data.arrayBuffer();
}

// Bump the play counter via an RPC so the increment is atomic — multiple
// users opening the same song at once won't lose increments to last-writer-wins.
export async function incrementCommunityPlayCount(communityId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);
	// Atomic SECURITY DEFINER function (see SQL migration).
	await supabase.rpc("increment_community_midi_play_count", { midi_id: rowId });
}

// -----------------------------------------------------------------------------
// "Add to Custom"
// -----------------------------------------------------------------------------

// Returns just the ids of community MIDIs the current user has added. Used to
// decorate "Add" buttons on browse rows ("Added" / "Add").
export async function listMyAddedCommunityIds(): Promise<string[]> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from(ADDITIONS_TABLE)
		.select("community_midi_id")
		.eq("user_id", user.id);
	if (error) throw error;
	return ((data as { community_midi_id: string }[]) ?? []).map((row) =>
		communityIdFromRowId(row.community_midi_id),
	);
}

// Full list of added community MIDIs — used by the "My Custom" tab. Performs
// a join so we can return the MIDI metadata in one round-trip.
export async function listMyAddedCommunityMidis(): Promise<CommunityMidi[]> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return [];

	const { data, error } = await supabase
		.from(ADDITIONS_TABLE)
		.select("community_midi_id, added_at, community_midis(*)")
		.eq("user_id", user.id)
		.order("added_at", { ascending: false });
	if (error) throw error;

	// Supabase's TS types treat the joined relation as an array even when
	// there's only one row per FK — normalise to a single row here.
	type JoinedRow = {
		community_midi_id: string;
		added_at: string;
		// Supabase types this as an array even though we're joining via the FK.
		community_midis: CommunityMidiRow[] | CommunityMidiRow | null;
	};
	const rows: CommunityMidiRow[] = [];
	for (const raw of ((data as unknown) as JoinedRow[] | null) ?? []) {
		const joined = Array.isArray(raw.community_midis)
			? raw.community_midis[0] ?? null
			: raw.community_midis;
		// Filter out anything that's no longer approved (got rejected post-add).
		if (joined && joined.status === "approved") rows.push(joined);
	}

	return attachUsernames(rows);
}

// Idempotent: upsert on (user_id, community_midi_id) so repeated adds are no-ops.
export async function addCommunityToCustom(communityId: string): Promise<void> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Sign in to add this song to your custom collection.");

	const rowId = rowIdFromCommunityId(communityId);
	const { error } = await supabase
		.from(ADDITIONS_TABLE)
		.upsert({ user_id: user.id, community_midi_id: rowId }, { onConflict: "user_id,community_midi_id" });
	if (error) throw error;
}

// Remove from the user's custom collection. No-op if the row doesn't exist.
export async function removeCommunityFromCustom(communityId: string): Promise<void> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;
	const rowId = rowIdFromCommunityId(communityId);
	const { error } = await supabase
		.from(ADDITIONS_TABLE)
		.delete()
		.eq("user_id", user.id)
		.eq("community_midi_id", rowId);
	if (error) throw error;
}

// -----------------------------------------------------------------------------
// Admin flow
// -----------------------------------------------------------------------------

// All pending submissions, oldest first (FIFO review queue).
export async function listPendingSubmissions(): Promise<CommunityMidi[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from(TABLE)
		.select("*")
		.eq("status", "pending")
		.order("created_at", { ascending: true });
	if (error) throw error;
	return attachUsernames((data as CommunityMidiRow[]) ?? []);
}

// Recently reviewed (approved + rejected), newest first — feeds the admin
// "Recent decisions" panel.
export async function listRecentlyReviewed(limit = 20): Promise<CommunityMidi[]> {
	const supabase = createClient();
	const { data, error } = await supabase
		.from(TABLE)
		.select("*")
		.in("status", ["approved", "rejected"])
		.order("reviewed_at", { ascending: false, nullsFirst: false })
		.limit(limit);
	if (error) throw error;
	return attachUsernames((data as CommunityMidiRow[]) ?? []);
}

// Count-only query for the nav-bar badge ("3 submissions waiting").
export async function countPendingSubmissions(): Promise<number> {
	const supabase = createClient();
	const { count, error } = await supabase
		.from(TABLE)
		.select("*", { count: "exact", head: true })
		.eq("status", "pending");
	if (error) return 0;
	return count ?? 0;
}

// Approve a pending submission. Stamps `reviewed_by` and clears any old review note.
export async function approveSubmission(communityId: string): Promise<void> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Sign in required.");

	const rowId = rowIdFromCommunityId(communityId);
	const { error } = await supabase
		.from(TABLE)
		.update({
			status: "approved",
			reviewed_by: user.id,
			reviewed_at: new Date().toISOString(),
			review_note: null,
		})
		.eq("id", rowId);
	if (error) throw error;
}

// Reject a pending submission. `note` lets the admin record a reason that the
// submitter sees on their "My submissions" list.
export async function rejectSubmission(communityId: string, note: string | null): Promise<void> {
	const supabase = createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) throw new Error("Sign in required.");

	const rowId = rowIdFromCommunityId(communityId);
	const { error } = await supabase
		.from(TABLE)
		.update({
			status: "rejected",
			reviewed_by: user.id,
			reviewed_at: new Date().toISOString(),
			review_note: note?.trim() || null,
		})
		.eq("id", rowId);
	if (error) throw error;
}

// Hard-delete an entry (storage + row). Used by admins for take-downs.
export async function adminDeleteSubmission(communityId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);

	const { data: row } = await supabase
		.from(TABLE)
		.select("storage_path, audio_storage_path")
		.eq("id", rowId)
		.maybeSingle();
	if (row) {
		const r = row as { storage_path: string; audio_storage_path: string | null };
		const paths = [r.storage_path];
		if (r.audio_storage_path) paths.push(r.audio_storage_path);
		await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
	}

	const { error } = await supabase.from(TABLE).delete().eq("id", rowId);
	if (error) throw error;
}
