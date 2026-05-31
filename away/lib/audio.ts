import * as Tone from "tone";
import type { AudioLatency } from "./settings";

// Map user-facing latency preset to the AudioContext `latencyHint` value
// the spec defines. Anything outside the known presets falls back to
// "interactive" (the most responsive — matches the historical default).
type LatencyHint = AudioContextLatencyCategory;

function hintFor(latency: AudioLatency | undefined): LatencyHint {
	if (latency === "balanced") return "balanced";
	if (latency === "stable") return "playback";
	return "interactive";
}

// Reads the persisted audioLatency preset directly from localStorage so the
// engine can pick it up at boot time — the AudioEngineProvider's React state
// isn't yet available when this runs. Falls back to "low" on first launch or
// when storage is unreadable (private mode, quota errors, etc.).
function readPersistedLatency(): AudioLatency {
	if (typeof window === "undefined") return "low";
	try {
		const raw = window.localStorage.getItem("away:appSettings");
		if (!raw) return "low";
		const parsed = JSON.parse(raw) as { audioLatency?: AudioLatency };
		const value = parsed.audioLatency;
		if (value === "low" || value === "balanced" || value === "stable") return value;
		return "low";
	} catch {
		return "low";
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
	const native = new AudioContext({ latencyHint: hint });
	const context = new Tone.Context({ context: native, latencyHint: hint });
	Tone.setContext(context);
	Tone.context.lookAhead = 0;
	return native;
};

export const createMasterVolume = (db: number): Tone.Volume => {
	return new Tone.Volume(db).toDestination();
};

// Tone.Reverb is a ConvolverNode under the hood — heavy on the audio thread.
// A shorter impulse response cuts that cost ~3× with no perceptible loss
// for the casual practice/multiplayer use case. Decay was 3.5s previously
// (concert-hall-ish); 1.8s reads as "small room" while halving CPU load.
const REVERB_DECAY_SECONDS = 1.8;

export const createReverb = (wet: number, output?: Tone.ToneAudioNode): Tone.Reverb => {
	const reverb = new Tone.Reverb({ decay: REVERB_DECAY_SECONDS, wet });
	if (output) {
		reverb.connect(output);
	} else {
		reverb.toDestination();
	}
	return reverb;
};
