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

export const SONG_CATEGORIES: SongCategoryGroup[] = [
	{ key: "video_games", label: "Video Game" },
	{ key: "anime", label: "Anime" },
	{ key: "popular", label: "Pop" },
	{ key: "classical", label: "Classical" },
	{ key: "films", label: "Films" },
	{ key: "tv_shows", label: "TV Shows" },
];

export type BuiltInSong = {
	id: string;
	title: string;
	artist: string | null;
	category: SongCategoryKey;
	subcategory: string | null;
	subcategoryLabel: string | null;
	filePath: string;
	fileName: string;
};

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

export function labelForSubcategory(key: string): string {
	if (SUBCATEGORY_LABELS[key]) return SUBCATEGORY_LABELS[key];
	return key
		.split("_")
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join(" ");
}

const COMMON_NOISE = /\b(easy_piano|piano_solo|piano_version|piano|midi|draft|cover|arrangement|tutorial)\b/gi;

export function prettifyFileName(fileName: string): {
	title: string;
	artist: string | null;
} {
	let base = fileName.replace(/\.midi?$/i, "");

	base = base.replace(/_/g, " ");
	base = base.replace(/\s+/g, " ").trim();

	const cleaned = base.replace(COMMON_NOISE, " ").replace(/\s+/g, " ").trim();
	const source = cleaned.length > 0 ? cleaned : base;

	if (source.includes(" - ")) {
		const parts = source.split(" - ").map((p) => p.trim()).filter(Boolean);
		if (parts.length >= 2) {
			const titleCandidate = parts[0];
			const artistCandidate = parts.slice(1).join(" - ");
			return {
				title: trimPunctuation(titleCandidate),
				artist: trimPunctuation(artistCandidate),
			};
		}
	}

	return { title: trimPunctuation(source), artist: null };
}

function trimPunctuation(s: string): string {
	return s.replace(/^[\s_\-]+|[\s_\-]+$/g, "").trim();
}

export function songIdFromPath(filePath: string): string {
	return Buffer.from(filePath, "utf-8").toString("base64url");
}

export function pathFromSongId(id: string): string {
	return Buffer.from(id, "base64url").toString("utf-8");
}
