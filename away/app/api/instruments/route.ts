import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type InstrumentEntry = {
	key: string;
	name: string;
	url: string;
	category: string;
	format: "sf2" | "sf3";
};

// Maps the top-level folder name under public/instruments to the UI category.
// Anything not in this map falls through to "Other".
const FOLDER_TO_CATEGORY: Record<string, string> = {
	keyboards: "Piano",
	guitars: "Guitar",
	bass: "Bass",
	strings: "Strings",
	choirs: "Choirs",
	percussion: "Percussion",
	winds: "Winds",
	"synth pads": "Synth",
};

const ROOT = path.join(process.cwd(), "public", "instruments");
const MAX_DEPTH = 4;

async function walk(dir: string, depth: number): Promise<string[]> {
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
			out.push(...(await walk(full, depth + 1)));
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase();
			if (ext === ".sf2" || ext === ".sf3") out.push(full);
		}
	}
	return out;
}

function categoryFromPath(absoluteFile: string): string {
	const rel = path.relative(ROOT, absoluteFile).split(path.sep);
	if (rel.length < 2) return "Other";
	const top = rel[0].toLowerCase();
	return FOLDER_TO_CATEGORY[top] ?? "Other";
}

function keyFromPath(absoluteFile: string): string {
	const rel = path.relative(ROOT, absoluteFile);
	const withoutExt = rel.replace(/\.[^.]+$/, "");
	return withoutExt
		.split(path.sep)
		.join("_")
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

function toPublicUrl(absoluteFile: string): string {
	const publicDir = path.join(process.cwd(), "public");
	const rel = path.relative(publicDir, absoluteFile).split(path.sep).join("/");
	return "/" + rel.split("/").map(encodeURIComponent).join("/");
}

export async function GET() {
	const files = await walk(ROOT, 0);
	const fonts: InstrumentEntry[] = files.map((file) => {
		const ext = path.extname(file).toLowerCase();
		return {
			key: keyFromPath(file),
			name: path.basename(file).replace(/\.[^.]+$/, ""),
			url: toPublicUrl(file),
			category: categoryFromPath(file),
			format: ext === ".sf3" ? "sf3" : "sf2",
		};
	});
	fonts.sort((a, b) => a.name.localeCompare(b.name));
	return NextResponse.json(fonts);
}
