#!/usr/bin/env node
// Copies the Basic Pitch model files out of the installed @spotify/basic-pitch
// package and into public/models/basic-pitch/ so the browser can fetch them
// from the same origin (no CORS, no external CDN dependency).
//
// Runs automatically as a postinstall step. Safe to re-run by hand.

import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const src = join(projectRoot, "node_modules", "@spotify", "basic-pitch", "model");
const dest = join(projectRoot, "public", "models", "basic-pitch");

if (!existsSync(src)) {
	// @spotify/basic-pitch isn't installed yet — likely a fresh clone before
	// npm install finishes. Nothing to do.
	process.exit(0);
}

mkdirSync(dest, { recursive: true });

let copied = 0;
for (const name of readdirSync(src)) {
	const from = join(src, name);
	const to = join(dest, name);
	if (!statSync(from).isFile()) continue;
	copyFileSync(from, to);
	copied += 1;
}

console.log(`[basic-pitch] synced ${copied} model file(s) → public/models/basic-pitch/`);
