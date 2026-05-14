// Audio → MIDI transcription, running entirely in the user's browser via
// Spotify's open-source Basic Pitch model. No backend required.
//
// The model files live in public/models/basic-pitch/ and are kept in sync with
// the @spotify/basic-pitch npm package by the "sync:basic-pitch-model" script
// (see package.json — runs automatically as a postinstall step).

export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".aiff"] as const;
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const MODEL_URL = "/models/basic-pitch/model.json";

export type TranscribeProgress = {
	phase: "model" | "decode" | "transcribe" | "midi" | "done";
	progress: number;
	message: string;
};

export type TranscribeProgressCallback = (event: TranscribeProgress) => void;

export function isAudioFileName(name: string): boolean {
	const lower = name.toLowerCase();
	return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function transcribeAudioToMidi(
	file: File,
	onProgress: TranscribeProgressCallback,
): Promise<ArrayBuffer> {
	onProgress({ phase: "model", progress: 0, message: "Loading model…" });

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
			const overall = 10 + Math.max(0, Math.min(1, percent)) * 82;
			onProgress({
				phase: "transcribe",
				progress: overall,
				message: `Transcribing audio… ${Math.round(percent * 100)}%`,
			});
		},
	);

	onProgress({ phase: "midi", progress: 94, message: "Building MIDI…" });

	const polyOutput = outputToNotesPoly(frames, onsets, 0.5, 0.3, 11);
	const polyWithBends = addPitchBendsToNoteEvents(contours, polyOutput);
	const notes = noteFramesToTime(polyWithBends);

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

	const out = midi.toArray();
	const buffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;

	onProgress({ phase: "done", progress: 100, message: "Done" });
	return buffer;
}

async function decodeAudio(file: File): Promise<AudioBuffer> {
	const Ctor =
		typeof window !== "undefined"
			? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			: undefined;
	if (!Ctor) throw new Error("Web Audio API is not available in this browser.");

	const audioContext = new Ctor({ sampleRate: 22050 });
	try {
		const arrayBuffer = await file.arrayBuffer();
		const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
		return toMonoBuffer(audioContext, decoded);
	} finally {
		audioContext.close().catch(() => {});
	}
}

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
