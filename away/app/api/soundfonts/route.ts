import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type Manifest = {
	name: string;
	release?: number;
	samples: Record<string, string>;
};

type SoundfontEntry = {
	key: string;
	name: string;
	baseUrl: string;
	urls: Record<string, string>;
	release: number;
};

const ROOT = path.join(process.cwd(), "public", "soundfont");
const MAX_DEPTH = 4;

async function findManifests(dir: string, depth: number): Promise<string[]> {
	if (depth > MAX_DEPTH) return [];
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await findManifests(full, depth + 1)));
		} else if (entry.isFile() && entry.name === "manifest.json") {
			out.push(full);
		}
	}
	return out;
}

function toPublicUrl(absoluteFile: string): string {
	const publicDir = path.join(process.cwd(), "public");
	const rel = path.relative(publicDir, absoluteFile).split(path.sep).join("/");
	return "/" + rel.split("/").map(encodeURIComponent).join("/");
}

function keyFromManifestPath(manifestPath: string): string {
	const rel = path.relative(ROOT, path.dirname(manifestPath)).split(path.sep).join("_");
	return rel
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

export async function GET() {
	const manifestPaths = await findManifests(ROOT, 0);
	const fonts: SoundfontEntry[] = [];

	for (const manifestPath of manifestPaths) {
		try {
			const raw = await readFile(manifestPath, "utf-8");
			const manifest = JSON.parse(raw) as Manifest;
			if (!manifest?.samples || typeof manifest.samples !== "object") continue;

			const folderUrl = toPublicUrl(path.dirname(manifestPath)) + "/";
			fonts.push({
				key: keyFromManifestPath(manifestPath),
				name: manifest.name ?? path.basename(path.dirname(manifestPath)),
				baseUrl: folderUrl,
				urls: manifest.samples,
				release: manifest.release ?? 1.5,
			});
		} catch {
			continue;
		}
	}

	fonts.sort((a, b) => a.name.localeCompare(b.name));
	return NextResponse.json(fonts);
}
