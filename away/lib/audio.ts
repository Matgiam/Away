// ============================================================================
// audio.ts
// ----------------------------------------------------------------------------
// Sets up the global audio graph used by every page:
//
//     [SpessaSynth worklet] → Tone.Reverb → Tone.Volume → speakers
//
// This file owns:
//   * Boot-time AudioContext creation (with the user's latency preset baked in).
//   * The master Volume node (controlled by the volume slider).
//   * The shared Reverb node (controlled by the reverb wet slider).
//
// The SpessaSynth engine itself lives in `spessaSynthEngine.ts` — this file
// just provides the surrounding Tone.js plumbing.
// ============================================================================

import * as Tone from "tone";
import type { AudioLatency } from "./settings";

// Map user-facing latency preset to the AudioContext `latencyHint` value
// the spec defines. Anything outside the known presets falls back to
// "balanced" — small enough to feel responsive for live play, large enough
// that fast passages don't underrun the audio worklet and crackle.
type LatencyHint = AudioContextLatencyCategory;

function hintFor(latency: AudioLatency | undefined): LatencyHint {
	if (latency === "low") return "interactive"; // small buffer, lowest latency
	if (latency === "stable") return "playback";  // big buffer, crackle-resistant
	return "balanced";                            // middle-of-the-road default
}

// Reads the persisted audioLatency preset directly from localStorage so the
// engine can pick it up at boot time — the AudioEngineProvider's React state
// isn't yet available when this runs. Falls back to "balanced" on first
// launch or when storage is unreadable (private mode, quota errors, etc.).
function readPersistedLatency(): AudioLatency {
	if (typeof window === "undefined") return "balanced"; // SSR guard
	try {
		const raw = window.localStorage.getItem("away:appSettings");
		if (!raw) return "balanced";
		const parsed = JSON.parse(raw) as { audioLatency?: AudioLatency };
		const value = parsed.audioLatency;
		// Whitelist check — never trust the value blindly.
		if (value === "low" || value === "balanced" || value === "stable") return value;
		return "balanced";
	} catch {
		return "balanced"; // storage disabled / quota error / malformed JSON
	}
}

// Returns the *native* AudioContext that Tone is wrapping. spessasynth_lib's
// AudioWorkletNode constructor fails the `instanceof BaseAudioContext` check
// against Tone's default standardized-audio-context wrapper, so we create the
// native context ourselves and hand it to both Tone and the spessasynth engine.
//
// The latencyHint is locked in when the AudioContext is constructed — there's
// no way to change it on a live context. So we read the user's preset from
// localStorage at boot. Changing the setting later requires a tab reload to
// apply (the SettingsPanel surfaces this).
export const initAudioContext = async (): Promise<AudioContext> => {
	const hint = hintFor(readPersistedLatency());

	// 1. Native AudioContext — what spessasynth's AudioWorkletNode needs.
	const native = new AudioContext({ latencyHint: hint });

	// 2. Tone wraps it so reverb / volume nodes work against the same context.
	const context = new Tone.Context({ context: native, latencyHint: hint });
	Tone.setContext(context);

	// `lookAhead = 0` means Tone schedules events immediately rather than
	// queueing them — important for live play where every ms counts.
	Tone.context.lookAhead = 0;
	return native;
};

// Master volume node, wired straight to the speakers. `db` is in decibels;
// 0 = unity, -Infinity = mute.
export const createMasterVolume = (db: number): Tone.Volume => {
	return new Tone.Volume(db).toDestination();
};

// Tone.Reverb is a ConvolverNode under the hood — heavy on the audio thread.
// A shorter impulse response cuts that cost ~3× with no perceptible loss
// for the casual practice/multiplayer use case. Decay was 3.5s previously
// (concert-hall-ish); 1.8s reads as "small room" while halving CPU load.
const REVERB_DECAY_SECONDS = 1.8;

// Build the shared reverb send. `wet` is in [0, 1] — 0 = dry, 1 = fully wet.
// Optional `output` lets the caller chain it (e.g. straight into the master
// volume); omitted, it goes to the speakers directly.
export const createReverb = (wet: number, output?: Tone.ToneAudioNode): Tone.Reverb => {
	const reverb = new Tone.Reverb({ decay: REVERB_DECAY_SECONDS, wet });
	if (output) {
		reverb.connect(output);
	} else {
		reverb.toDestination();
	}
	return reverb;
};
