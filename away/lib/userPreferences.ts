import { createClient } from "@/lib/supabase/client";
import { normalizeHex } from "@/lib/color";

export type UserPreferences = {
	backgroundColor: string | null;
	noteColor: string | null;
};

export async function fetchUserPreferences(): Promise<UserPreferences | null> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return null;

	const { data, error } = await supabase
		.from("profiles")
		.select("background_color, note_color")
		.eq("id", userData.user.id)
		.maybeSingle();

	if (error || !data) return { backgroundColor: null, noteColor: null };

	const row = data as { background_color: string | null; note_color: string | null };
	return {
		backgroundColor: row.background_color ? normalizeHex(row.background_color) : null,
		noteColor: row.note_color ? normalizeHex(row.note_color) : null,
	};
}

export async function updateUserPreferences(prefs: Partial<UserPreferences>): Promise<boolean> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return false;

	const update: { background_color?: string; note_color?: string } = {};
	if (prefs.backgroundColor !== undefined) {
		const hex = prefs.backgroundColor ? normalizeHex(prefs.backgroundColor) : null;
		if (hex) update.background_color = hex;
	}
	if (prefs.noteColor !== undefined) {
		const hex = prefs.noteColor ? normalizeHex(prefs.noteColor) : null;
		if (hex) update.note_color = hex;
	}
	if (Object.keys(update).length === 0) return true;

	const { error } = await supabase.from("profiles").update(update).eq("id", userData.user.id);
	return !error;
}
