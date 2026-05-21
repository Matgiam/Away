import { createClient } from "@/lib/supabase/client";
import {
	downloadUploadedMidi,
	setUploadCommunitySubmission,
	type UploadDifficulty,
	type UploadedSongMeta,
} from "./uploads";

export type CommunityStatus = "pending" | "approved" | "rejected";

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
};

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
};

const BUCKET = "community_midis";
const TABLE = "community_midis";
const ADDITIONS_TABLE = "community_midi_additions";
const COMMUNITY_ID_PREFIX = "c:";

export function communityIdFromRowId(rowId: string): string {
	return `${COMMUNITY_ID_PREFIX}${rowId}`;
}

export function rowIdFromCommunityId(id: string): string {
	return id.startsWith(COMMUNITY_ID_PREFIX) ? id.slice(COMMUNITY_ID_PREFIX.length) : id;
}

export function isCommunityId(id: string): boolean {
	return id.startsWith(COMMUNITY_ID_PREFIX);
}

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
	};
}

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

export type SubmitParams = {
	file: File;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	durationSeconds: number;
	bpm: number;
};

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
		})
		.select("*")
		.single();

	if (insertError) {
		await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
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
	overrides: { title?: string; artist?: string; difficulty?: UploadDifficulty },
): Promise<CommunityMidi> {
	const buffer = await downloadUploadedMidi(upload.storagePath);
	const blob = new Blob([buffer], { type: "audio/midi" });
	const file = new File([blob], upload.fileName, { type: "audio/midi" });

	const result = await submitCommunityMidi({
		file,
		title: overrides.title ?? upload.title,
		artist: overrides.artist ?? upload.artist,
		difficulty: overrides.difficulty ?? upload.difficulty,
		durationSeconds: upload.durationSeconds,
		bpm: upload.bpm,
	});

	await setUploadCommunitySubmission(upload.id, rowIdFromCommunityId(result.id)).catch(() => {});
	return result;
}

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

export async function withdrawCommunitySubmission(communityId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);

	const { data: row } = await supabase
		.from(TABLE)
		.select("storage_path, status")
		.eq("id", rowId)
		.maybeSingle();
	if (!row) return;

	const r = row as { storage_path: string; status: CommunityStatus };
	await supabase.storage.from(BUCKET).remove([r.storage_path]).catch(() => {});
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

export async function listApprovedCommunityMidis(
	params: CommunityListParams = {},
): Promise<CommunityListPage> {
	const supabase = createClient();
	const limit = params.limit ?? COMMUNITY_PAGE_SIZE;
	const offset = params.offset ?? 0;
	const term = params.search ? sanitizeIlike(params.search) : "";

	let query = supabase.from(TABLE).select("*").eq("status", "approved");

	if (term) {
		query = query.or(`title.ilike.%${term}%,artist.ilike.%${term}%`);
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

export async function downloadCommunityMidi(storagePath: string): Promise<ArrayBuffer> {
	const supabase = createClient();
	const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
	if (error) throw error;
	return await data.arrayBuffer();
}

export async function incrementCommunityPlayCount(communityId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);
	// Atomic SECURITY DEFINER function (see SQL migration).
	await supabase.rpc("increment_community_midi_play_count", { midi_id: rowId });
}

// -----------------------------------------------------------------------------
// "Add to Custom"
// -----------------------------------------------------------------------------

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
		if (joined && joined.status === "approved") rows.push(joined);
	}

	return attachUsernames(rows);
}

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

export async function countPendingSubmissions(): Promise<number> {
	const supabase = createClient();
	const { count, error } = await supabase
		.from(TABLE)
		.select("*", { count: "exact", head: true })
		.eq("status", "pending");
	if (error) return 0;
	return count ?? 0;
}

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

export async function adminDeleteSubmission(communityId: string): Promise<void> {
	const supabase = createClient();
	const rowId = rowIdFromCommunityId(communityId);

	const { data: row } = await supabase
		.from(TABLE)
		.select("storage_path")
		.eq("id", rowId)
		.maybeSingle();
	if (row) {
		const path = (row as { storage_path: string }).storage_path;
		await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
	}

	const { error } = await supabase.from(TABLE).delete().eq("id", rowId);
	if (error) throw error;
}
