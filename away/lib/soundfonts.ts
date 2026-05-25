import type { Instrument, SoundfontCategory } from "./types";
import { SOUNDFONT_CATEGORIES } from "./types";

type ApiInstrument = {
	key: string;
	name: string;
	url: string;
	category?: string;
	format: "sf2" | "sf3";
};

function normalizeCategory(raw?: string): SoundfontCategory {
	if (!raw) return "Other";
	const match = SOUNDFONT_CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
	return match ?? "Other";
}

export async function fetchDynamicSoundfonts(): Promise<Record<string, Instrument>> {
	try {
		const res = await fetch("/api/instruments");
		if (!res.ok) return {};
		const list = (await res.json()) as ApiInstrument[];
		const map: Record<string, Instrument> = {};
		for (const f of list) {
			map[f.key] = {
				name: f.name,
				url: f.url,
				category: normalizeCategory(f.category),
				format: f.format,
			};
		}
		return map;
	} catch {
		return {};
	}
}
