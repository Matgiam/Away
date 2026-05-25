#!/usr/bin/env node
// Copies the spessasynth AudioWorklet processor out of the installed
// spessasynth_lib package into public/spessasynth/ so the browser can fetch
// it from the same origin via audioWorklet.addModule().
//
// Runs automatically as a postinstall step. Safe to re-run by hand.

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const src = join(projectRoot, "node_modules", "spessasynth_lib", "dist", "spessasynth_processor.min.js");
const destDir = join(projectRoot, "public", "spessasynth");
const dest = join(destDir, "spessasynth_processor.min.js");

if (!existsSync(src)) {
	process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[spessasynth] synced worklet processor → public/spessasynth/spessasynth_processor.min.js");
