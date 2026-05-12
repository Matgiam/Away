import type { Instrument, SoundfontCategory } from "./types";
import { SOUNDFONT_CATEGORIES } from "./types";

type ApiSoundfont = {
	key: string;
	name: string;
	baseUrl: string;
	urls: Record<string, string>;
	release: number;
	category?: string;
};

function normalizeCategory(raw?: string): SoundfontCategory {
	if (!raw) return "Other";
	const match = SOUNDFONT_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
	return match ?? "Other";
}

export async function fetchDynamicSoundfonts(): Promise<Record<string, Instrument>> {
	try {
		const res = await fetch("/api/soundfonts");
		if (!res.ok) return {};
		const list = (await res.json()) as ApiSoundfont[];
		const map: Record<string, Instrument> = {};
		for (const f of list) {
			map[f.key] = {
				name: f.name,
				baseUrl: f.baseUrl,
				urls: f.urls,
				release: f.release,
				category: normalizeCategory(f.category),
			};
		}
		return map;
	} catch {
		return {};
	}
}
