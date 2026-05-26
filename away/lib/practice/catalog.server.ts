import "server-only";
import { readdir, readFile } from "fs/promises";
import path from "path";
import {
	BuiltInSong,
	SONG_CATEGORIES,
	SongCategoryKey,
	labelForSubcategory,
	prettifyFileName,
	songIdFromPath,
} from "./songs";
import { parseMidi } from "./midiParser";
import { estimateDifficulty } from "./difficulty";

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

		// Parse the MIDI on the server so the song list can show difficulty,
		// duration and BPM up-front without each row having to fetch + parse the
		// file from the browser. Failures here aren't fatal — we still surface
		// the song without metadata so it can be played as before.
		let durationSeconds: number | undefined;
		let bpm: number | undefined;
		let difficulty: BuiltInSong["difficulty"];
		try {
			const buffer = await readFile(full);
			const parsed = parseMidi(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
			durationSeconds = parsed.durationSeconds;
			bpm = parsed.initialTempoBpm;
			difficulty = estimateDifficulty(parsed);
		} catch (err) {
			console.warn(`[practice catalog] failed to parse ${relative}:`, err);
		}

		songs.push({
			id: songIdFromPath(filePath),
			title,
			artist,
			category,
			subcategory,
			subcategoryLabel: subcategory ? labelForSubcategory(subcategory) : null,
			filePath,
			fileName: entry.name,
			durationSeconds,
			bpm,
			difficulty,
		});
	}

	return songs;
}

// Cache the catalog at module scope. Built-in MIDIs are bundled with the deploy
// and don't change between requests, so we only need to walk the filesystem and
// parse ~all songs once per server process. Without this, every visit to
// /practice would re-parse every MIDI (a noticeable cold-start cost).
let cached: Promise<BuiltInSong[]> | null = null;

export async function getAllBuiltInSongs(): Promise<BuiltInSong[]> {
	if (!cached) {
		cached = (async () => {
			const all: BuiltInSong[] = [];
			for (const cat of SONG_CATEGORIES) {
				if (!CATEGORY_KEYS.has(cat.key)) continue;
				const dir = path.join(MIDI_ROOT, cat.key);
				const songs = await collectMidi(dir, 0, cat.key, null);
				all.push(...songs);
			}
			all.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
			return all;
		})().catch((err) => {
			// If the walk fails, throw away the cached rejection so the next call
			// can retry instead of being permanently broken.
			cached = null;
			throw err;
		});
	}
	return cached;
}
