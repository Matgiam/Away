// ============================================================================
// userPreferences.ts
// ----------------------------------------------------------------------------
// Cross-device visual preferences (background colour, note colour) backed by
// the `profiles` table in Supabase.
//
// In contrast with most settings — which live in localStorage and stay
// per-device — these two are intentionally synced so the user's "look"
// follows them between browsers. Settings panel writes through this module,
// AudioEngineProvider reads on boot.
//
// Hex values are normalised via `normalizeHex` on both read and write so the
// DB only ever stores canonical "#rrggbb" strings.
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { normalizeHex } from "@/lib/color";

// Two-key preferences shape. `null` means "user hasn't set this" — the
// caller falls back to the local default.
export type UserPreferences = {
	backgroundColor: string | null;
	noteColor: string | null;
};

// Fetch the current user's preferences. Returns null if there is no logged-in
// user; returns `{ backgroundColor: null, noteColor: null }` if logged in but
// preferences haven't been saved yet.
export async function fetchUserPreferences(): Promise<UserPreferences | null> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return null; // anonymous → no prefs to fetch

	const { data, error } = await supabase
		.from("profiles")
		.select("background_color, note_color")
		.eq("id", userData.user.id)
		.maybeSingle();

	if (error || !data) return { backgroundColor: null, noteColor: null };

	const row = data as { background_color: string | null; note_color: string | null };
	return {
		// Normalise on read in case a legacy row has uppercase / hashless hex.
		backgroundColor: row.background_color ? normalizeHex(row.background_color) : null,
		noteColor: row.note_color ? normalizeHex(row.note_color) : null,
	};
}

// Partial update — only sends the fields the caller specifies. Returns false
// on auth failure or DB error; true on success (or no-op).
export async function updateUserPreferences(prefs: Partial<UserPreferences>): Promise<boolean> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return false;

	// Build the DB-shaped update object. Invalid hex values are silently
	// dropped (normalizeHex returns null) so a malformed input can't poison
	// the row.
	const update: { background_color?: string; note_color?: string } = {};
	if (prefs.backgroundColor !== undefined) {
		const hex = prefs.backgroundColor ? normalizeHex(prefs.backgroundColor) : null;
		if (hex) update.background_color = hex;
	}
	if (prefs.noteColor !== undefined) {
		const hex = prefs.noteColor ? normalizeHex(prefs.noteColor) : null;
		if (hex) update.note_color = hex;
	}
	if (Object.keys(update).length === 0) return true; // nothing to send → success

	const { error } = await supabase.from("profiles").update(update).eq("id", userData.user.id);
	return !error;
}
