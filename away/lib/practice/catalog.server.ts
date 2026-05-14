import "server-only";
import { readdir } from "fs/promises";
import path from "path";
import {
	BuiltInSong,
	SONG_CATEGORIES,
	SongCategoryKey,
	labelForSubcategory,
	prettifyFileName,
	songIdFromPath,
} from "./songs";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MIDI_ROOT = path.join(PUBLIC_DIR, "midi");
const MAX_DEPTH = 3;

const CATEGORY_KEYS: Set<SongCategoryKey> = new Set(SONG_CATEGORIES.map((c) => c.key));

async function collectMidi(
	dir: string,
	depth: number,
	category: SongCategoryKey,
	subcategory: string | null,
): Promise<BuiltInSong[]> {
	if (depth > MAX_DEPTH) return [];
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const songs: BuiltInSong[] = [];

	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const nextSubcategory = subcategory ?? entry.name.toLowerCase();
			songs.push(...(await collectMidi(full, depth + 1, category, nextSubcategory)));
			continue;
		}
		if (!entry.isFile()) continue;
		if (!/\.midi?$/i.test(entry.name)) continue;

		const relative = path.relative(PUBLIC_DIR, full).split(path.sep).join("/");
		const filePath = "/" + relative;
		const { title, artist } = prettifyFileName(entry.name);

		songs.push({
			id: songIdFromPath(filePath),
			title,
			artist,
			category,
			subcategory,
			subcategoryLabel: subcategory ? labelForSubcategory(subcategory) : null,
			filePath,
			fileName: entry.name,
		});
	}

	return songs;
}

export async function getAllBuiltInSongs(): Promise<BuiltInSong[]> {
	const all: BuiltInSong[] = [];

	for (const cat of SONG_CATEGORIES) {
		if (!CATEGORY_KEYS.has(cat.key)) continue;
		const dir = path.join(MIDI_ROOT, cat.key);
		const songs = await collectMidi(dir, 0, cat.key, null);
		all.push(...songs);
	}

	all.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
	return all;
}
