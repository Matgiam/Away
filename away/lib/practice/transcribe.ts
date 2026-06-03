// ============================================================================
// practice/transcribe.ts
// ----------------------------------------------------------------------------
// Audio → MIDI transcription dispatcher.
//
// Two engines are available:
//
//   1. **Transkun (server)** — high-quality transformer + semi-CRF model
//      running on Hugging Face Spaces. Activated when
//      NEXT_PUBLIC_TRANSCRIBE_API_URL is set in .env.local.
//
//   2. **Basic Pitch (browser fallback)** — Spotify's small CNN running in
//      TensorFlow.js. Model files live in public/models/basic-pitch/.
//
// The exported `transcribeAudioToMidi` picks the right engine based on
// configuration and the explicit `engine` arg, then reports progress via the
// supplied callback. Same return shape (MIDI ArrayBuffer) either way so
// callers don't care which one ran.
// ============================================================================

import { transcribeAudioToMidiServer } from "./transcribeServer";

// Allowed audio extensions. The upload UI also enforces this client-side so
// the user can't even pick a bogus file in the picker.
export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff"] as const;
// 50 MB cap — covers most pop songs without letting someone upload a movie.
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

// Local path to the Basic Pitch model files (copied into public/ at install
// time by scripts/sync-basic-pitch-model.mjs).
const MODEL_URL = "/models/basic-pitch/model.json";

export type TranscribeEngine = "transkun" | "basic-pitch";

// Progress event surfaced to the UI. `phase` distinguishes setup (loading
// the model) from the actual work (transcribing) from output rendering.
export type TranscribeProgress = {
	phase: "model" | "decode" | "transcribe" | "midi" | "done";
	progress: number;     // 0-100
	message: string;
};

export type TranscribeProgressCallback = (event: TranscribeProgress) => void;

// Cheap filename-based audio check — also used by the upload UI to gate the
// file picker accept list.
export function isAudioFileName(name: string): boolean {
	const lower = name.toLowerCase();
	return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Configuration read once at module load. Env values get trimmed so extra
// whitespace in .env.local doesn't poison the request.
const TRANSKUN_URL = (process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL ?? "").trim();
const TRANSKUN_KEY = (process.env.NEXT_PUBLIC_TRANSCRIBE_API_KEY ?? "").trim() || undefined;

// True when the Transkun server URL is configured in .env.local. When false,
// the UI hides / disables the high-quality option.
export function isTranskunAvailable(): boolean {
	return TRANSKUN_URL.length > 0;
}

// The engine that will be used when the caller doesn't specify one. Prefers
// Transkun if it's configured.
export function getDefaultTranscribeEngine(): TranscribeEngine {
	return isTranskunAvailable() ? "transkun" : "basic-pitch";
}

// Backwards-compat alias for code that still asks for the "active" engine.
export const getActiveTranscribeEngine = getDefaultTranscribeEngine;

// Main entry. Returns a MIDI ArrayBuffer ready to feed to `parseMidi`.
// `signal` allows the caller to cancel an in-flight transcription (e.g. when
// the user closes the upload modal mid-way).
export async function transcribeAudioToMidi(
	file: File,
	onProgress: TranscribeProgressCallback,
	signal?: AbortSignal,
	engine?: TranscribeEngine,
): Promise<ArrayBuffer> {
	const chosen = engine ?? getDefaultTranscribeEngine();

	if (chosen === "transkun") {
		// Defensive — caller shouldn't be able to request transkun if it isn't
		// configured, but throw a clear error if they do anyway.
		if (!TRANSKUN_URL) {
			throw new Error(
				"High-quality transcription is not configured. Set NEXT_PUBLIC_TRANSCRIBE_API_URL in .env.local.",
			);
		}
		return transcribeAudioToMidiServer(file, TRANSKUN_URL, TRANSKUN_KEY, onProgress, signal);
	}
	// In-browser fallback.
	return transcribeBasicPitchInBrowser(file, onProgress);
}

// Spotify Basic Pitch path. Loads the TFJS model + @tonejs/midi on demand,
// decodes the audio file to a mono Float32 buffer at 22.05 kHz (Basic Pitch's
// expected sample rate), runs the model, then converts the polyphonic note
// events to a standard MIDI file.
async function transcribeBasicPitchInBrowser(
	file: File,
	onProgress: TranscribeProgressCallback,
): Promise<ArrayBuffer> {
	onProgress({ phase: "model", progress: 0, message: "Loading model…" });

	// Dynamic imports keep both libs out of the main bundle — they only load
	// when the user actually transcribes something.
	const [basicPitchModule, midiModule] = await Promise.all([
		import("@spotify/basic-pitch"),
		import("@tonejs/midi"),
	]);

	const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } =
		basicPitchModule;
	const { Midi } = midiModule;

	onProgress({ phase: "model", progress: 5, message: "Initializing model…" });
	const basicPitch = new BasicPitch(MODEL_URL);

	onProgress({ phase: "decode", progress: 8, message: "Decoding audio…" });
	const audioBuffer = await decodeAudio(file);

	onProgress({ phase: "transcribe", progress: 10, message: "Transcribing audio…" });

	// The model emits three parallel arrays. We collect them as the model
	// streams chunks so the progress callback can advance smoothly.
	const frames: number[][] = [];
	const onsets: number[][] = [];
	const contours: number[][] = [];

	await basicPitch.evaluateModel(
		audioBuffer,
		(f: number[][], o: number[][], c: number[][]) => {
			frames.push(...f);
			onsets.push(...o);
			contours.push(...c);
		},
		(percent: number) => {
			// Scale model progress (0..1) into the 10..92 range of our overall bar.
			const overall = 10 + Math.max(0, Math.min(1, percent)) * 82;
			onProgress({
				phase: "transcribe",
				progress: overall,
				message: `Transcribing audio… ${Math.round(percent * 100)}%`,
			});
		},
	);

	onProgress({ phase: "midi", progress: 94, message: "Building MIDI…" });

	// Post-processing: assemble a polyphonic note list with pitch bends, then
	// convert tick events to seconds.
	// Args: onsetThreshold, frameThreshold, minNoteLength (frames).
	const polyOutput = outputToNotesPoly(frames, onsets, 0.5, 0.3, 11);
	const polyWithBends = addPitchBendsToNoteEvents(contours, polyOutput);
	const notes = noteFramesToTime(polyWithBends);

	// Single-track output. Velocity is clamped to [0.2, 1.0] so very quiet
	// passages still sound (Basic Pitch tends to underestimate amplitudes).
	const midi = new Midi();
	const track = midi.addTrack();
	for (const note of notes) {
		track.addNote({
			midi: note.pitchMidi,
			time: note.startTimeSeconds,
			duration: Math.max(0.05, note.durationSeconds),
			velocity: Math.min(1, Math.max(0.2, note.amplitude ?? 0.7)),
		});
	}

	// Slice the underlying ArrayBuffer to the exact byte range — @tonejs/midi
	// returns a Uint8Array view, but the consumer wants a tight ArrayBuffer.
	const out = midi.toArray();
	const buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;

	onProgress({ phase: "done", progress: 100, message: "Done" });
	return buffer;
}

// Decode the user's audio file to an AudioBuffer at 22.05 kHz (Basic Pitch's
// training sample rate). Closing the temporary AudioContext is best-effort —
// some browsers refuse to close one that's still resampling.
async function decodeAudio(file: File): Promise<AudioBuffer> {
	const Ctor =
		typeof window !== "undefined"
			? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			: undefined;
	if (!Ctor) throw new Error("Web Audio API is not available in this browser.");

	// Fresh context per call so the resample rate is honored — you can't change
	// `sampleRate` on a live context.
	const audioContext = new Ctor({ sampleRate: 22050 });
	try {
		const arrayBuffer = await file.arrayBuffer();
		// `.slice(0)` makes a copy — some implementations of decodeAudioData
		// detach the original buffer, which breaks subsequent reads.
		const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
		return toMonoBuffer(audioContext, decoded);
	} finally {
		audioContext.close().catch(() => {});
	}
}

// Downmix any multi-channel buffer to mono by averaging the channels. Basic
// Pitch is a mono model.
function toMonoBuffer(audioContext: AudioContext, source: AudioBuffer): AudioBuffer {
	if (source.numberOfChannels === 1) return source;

	const mono = audioContext.createBuffer(1, source.length, source.sampleRate);
	const out = mono.getChannelData(0);
	const channels: Float32Array[] = [];
	for (let c = 0; c < source.numberOfChannels; c++) {
		channels.push(source.getChannelData(c));
	}

	const channelCount = channels.length;
	for (let i = 0; i < source.length; i++) {
		let sum = 0;
		for (let c = 0; c < channelCount; c++) {
			sum += channels[c][i];
		}
		out[i] = sum / channelCount;
	}

	return mono;
}
