import type { Instrument } from "./types";

type ApiSoundfont = {
	key: string;
	name: string;
	baseUrl: string;
	urls: Record<string, string>;
	release: number;
};

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
			};
		}
		return map;
	} catch {
		return {};
	}
}
