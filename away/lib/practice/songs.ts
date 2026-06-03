// ============================================================================
// practice/songs.ts
// ----------------------------------------------------------------------------
// Catalog metadata helpers for the built-in MIDI library.
//
// Defines:
//   * `SONG_CATEGORIES` — the top-level buckets shown in the practice menu.
//   * `BuiltInSong`     — the shape served by `catalog.server.ts`.
//   * `SUBCATEGORY_LABELS` — pretty names for the per-folder sub-buckets
//     (Zelda, Naruto, Beethoven, …). Adding a new folder under
//     public/midi/<category>/<subcategory>/ just needs a label entry here.
//   * `prettifyFileName` — turns "Believer_-_Imagine_Dragons_Easy_Piano.mid"
//     into { title: "Believer", artist: "Imagine Dragons" }.
//   * `songIdFromPath` / `pathFromSongId` — base64url round-trip so the
//     URL-safe song id can be embedded in /practice/play/[songId].
// ============================================================================

// Top-level categories — these are the folder names directly under public/midi/.
export type SongCategoryKey =
	| "video_games"
	| "anime"
	| "popular"
	| "classical"
	| "films"
	| "tv_shows";

export type SongCategoryGroup = {
	key: SongCategoryKey;
	label: string;
	subcategoryLabel?: string;
};

// Display order in the practice menu. `key` matches the folder name; `label`
// is what the user sees on the tab.
export const SONG_CATEGORIES: SongCategoryGroup[] = [
	{ key: "video_games", label: "Video Game" },
	{ key: "anime", label: "Anime" },
	{ key: "popular", label: "Pop" },
	{ key: "classical", label: "Classical" },
	{ key: "films", label: "Films" },
	{ key: "tv_shows", label: "TV Shows" },
];

// One entry per built-in MIDI. Returned by `getAllBuiltInSongs` and consumed
// by the practice menu rows.
export type BuiltInSong = {
	id: string;                    // base64url of filePath — URL-safe
	title: string;
	artist: string | null;
	category: SongCategoryKey;
	subcategory: string | null;    // e.g. "zelda", "chopin"
	subcategoryLabel: string | null;
	filePath: string;
	fileName: string;
	// Metadata derived from the MIDI file on the server (catalog.server.ts).
	// Optional because parsing can fail on a malformed file — we still want the
	// song to appear in the list, just without the badge / timestamp.
	durationSeconds?: number;
	bpm?: number;
	difficulty?: "easy" | "medium" | "hard";
};

// Human-readable labels for subcategory folder names. Anything not listed
// here falls through to a generic underscore-to-spaces, title-case transform.
const SUBCATEGORY_LABELS: Record<string, string> = {
	zelda: "Zelda",
	super_mario: "Super Mario",
	minecraft: "Minecraft",
	undertale: "Undertale",
	silent_hill: "Silent Hill",
	final_fantasy: "Final Fantasy",
	castlevania: "Castlevania",
	five_nights_at_freddys: "Five Nights at Freddy's",
	plants_vs_zombies: "Plants vs. Zombies",
	pokemon: "Pokemon",
	wii: "Wii",
	tetris: "Tetris",
	attack_on_titan: "Attack on Titan",
	demon_slayer: "Demon Slayer",
	jujutsu_kaisen: "Jujutsu Kaisen",
	naruto: "Naruto",
	code_geass: "Code Geass",
	evangelion: "Evangelion",
	sword_art_online: "Sword Art Online",
	tokyo_ghoul: "Tokyo Ghoul",
	your_name: "Your Name",
	bleach: "Bleach",
	darling_in_the_franxx: "Darling in the FranXX",
	hunter_x_hunter: "Hunter x Hunter",
	tokyo_revengers: "Tokyo Revengers",
	bunny_girl_senpai: "Bunny Girl Senpai",
	bakemonogatari: "Bakemonogatari",
	studio_ghibli: "Studio Ghibli",
	beethoven: "Beethoven",
	chopin: "Chopin",
	liszt: "Liszt",
	scott_joplin: "Scott Joplin",
	pachelbel: "Pachelbel",
};

// Returns the prettified subcategory label. Falls back to "snake_case" →
// "Title Case" so unlisted folders still render reasonably.
export function labelForSubcategory(key: string): string {
	if (SUBCATEGORY_LABELS[key]) return SUBCATEGORY_LABELS[key];
	return key
		.split("_")
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(" ");
}

// Patterns common in user-submitted MIDI file names that aren't actually part
// of the song's title. Stripped during `prettifyFileName`.
const COMMON_NOISE = /\b(easy_piano|piano_solo|piano_version|piano|midi|draft|cover|arrangement|tutorial)\b/gi;

// Best-effort title + artist split. Strategy:
//   1. Strip extension.
//   2. Replace underscores with spaces.
//   3. Remove "noise" keywords (piano_solo, easy_piano, midi, …).
//   4. If a " - " separator survives, split on it (title before, artist after).
export function prettifyFileName(fileName: string): {
	title: string;
	artist: string | null;
} {
	let base = fileName.replace(/\.midi?$/i, "");

	base = base.replace(/_/g, " ");
	base = base.replace(/\s+/g, " ").trim();

	// Try the cleaned version first — but fall back to the raw form if the
	// cleaner stripped everything (which would happen for "piano.mid").
	const cleaned = base.replace(COMMON_NOISE, " ").replace(/\s+/g, " ").trim();
	const source = cleaned.length > 0 ? cleaned : base;

	if (source.includes(" - ")) {
		const parts = source.split(" - ").map((p) => p.trim()).filter(Boolean);
		if (parts.length >= 2) {
			const titleCandidate = parts[0];
			// Rejoin the rest with the original separator in case the artist
			// has a hyphen in their name.
			const artistCandidate = parts.slice(1).join(" - ");
			return {
				title: trimPunctuation(titleCandidate),
				artist: trimPunctuation(artistCandidate),
			};
		}
	}

	return { title: trimPunctuation(source), artist: null };
}

// Trim leading/trailing whitespace, underscores and hyphens (which the
// cleaning steps above can leave dangling).
function trimPunctuation(s: string): string {
	return s.replace(/^[\s_\-]+|[\s_\-]+$/g, "").trim();
}

// File path → URL-safe id. base64url so the result is safe to drop into a
// pathname without further encoding.
export function songIdFromPath(filePath: string): string {
	return Buffer.from(filePath, "utf-8").toString("base64url");
}

// Inverse of the above — turns the id back into the original `/midi/...` path.
export function pathFromSongId(id: string): string {
	return Buffer.from(id, "base64url").toString("utf-8");
}
