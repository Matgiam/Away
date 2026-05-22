"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseMidi } from "@/lib/practice/midiParser";
import { prettifyFileName } from "@/lib/practice/songs";
import { saveUploadedSong, type UploadDifficulty } from "@/lib/practice/uploads";
import { estimateDifficulty } from "@/lib/practice/difficulty";
import {
	AUDIO_EXTENSIONS,
	MAX_AUDIO_BYTES,
	getDefaultTranscribeEngine,
	isAudioFileName,
	isTranskunAvailable,
	transcribeAudioToMidi,
	type TranscribeEngine,
} from "@/lib/practice/transcribe";

interface UploadModalProps {
	open: boolean;
	onClose: () => void;
	onUploaded: (id: string) => void;
	signedIn: boolean;
}

type Stage = "drop" | "transcribing" | "form" | "saving";
type Source = "midi" | "audio";

const MAX_MIDI_BYTES = 10 * 1024 * 1024;
const AUDIO_ACCEPT = AUDIO_EXTENSIONS.join(",") + ",audio/*";

export function UploadModal({ open, onClose, onUploaded, signedIn }: UploadModalProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const [source, setSource] = useState<Source>("midi");
	const [stage, setStage] = useState<Stage>("drop");
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);

	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [pendingFileName, setPendingFileName] = useState("");
	const [pendingDuration, setPendingDuration] = useState(0);
	const [pendingBpm, setPendingBpm] = useState(120);
	const [pendingAutoDifficulty, setPendingAutoDifficulty] = useState<UploadDifficulty>("medium");

	const [title, setTitle] = useState("");
	const [artist, setArtist] = useState("");
	const [difficulty, setDifficulty] = useState<UploadDifficulty | "auto">("auto");

	const [transcribeProgress, setTranscribeProgress] = useState(0);
	const [transcribeMessage, setTranscribeMessage] = useState("Loading model…");
	const [audioFileName, setAudioFileName] = useState("");
	// Picked by the user before they drop a file. Defaults to the higher-quality
	// engine when it's available, otherwise the fast browser one. The actual
	// engine that runs is locked in at the moment they drop the file (in
	// activeEngineRef) so flipping the toggle mid-upload doesn't get weird.
	const [selectedEngine, setSelectedEngine] = useState<TranscribeEngine>(getDefaultTranscribeEngine);
	const activeEngineRef = useRef<TranscribeEngine>(selectedEngine);

	const reset = useCallback(() => {
		setStage("drop");
		setError(null);
		setDragOver(false);
		setPendingFile(null);
		setPendingFileName("");
		setPendingDuration(0);
		setPendingBpm(120);
		setPendingAutoDifficulty("medium");
		setTitle("");
		setArtist("");
		setDifficulty("auto");
		setTranscribeProgress(0);
		setTranscribeMessage("Loading model…");
		setAudioFileName("");
		setSelectedEngine(getDefaultTranscribeEngine());
		if (inputRef.current) inputRef.current.value = "";
	}, []);

	useEffect(() => {
		if (!open) reset();
	}, [open, reset]);

	const acceptForSource = source === "midi" ? ".mid,.midi,audio/midi,audio/x-midi" : AUDIO_ACCEPT;

	const consumeMidiBuffer = useCallback((file: File, fileName: string, buffer: ArrayBuffer) => {
		const parsed = parseMidi(buffer);
		const guessed = prettifyFileName(fileName);
		setPendingFile(file);
		setPendingFileName(fileName);
		setPendingDuration(parsed.durationSeconds);
		setPendingBpm(parsed.initialTempoBpm);
		setPendingAutoDifficulty(estimateDifficulty(parsed));
		setTitle(guessed.title);
		setArtist(guessed.artist ?? "");
		setDifficulty("auto");
		setStage("form");
	}, []);

	const handleMidiFile = useCallback(
		async (file: File) => {
			setError(null);
			if (!/\.midi?$/i.test(file.name)) {
				setError("Only .mid / .midi files are supported.");
				return;
			}
			if (file.size > MAX_MIDI_BYTES) {
				setError("File too large (max 10 MB).");
				return;
			}
			try {
				const buffer = await file.arrayBuffer();
				consumeMidiBuffer(file, file.name, buffer);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Could not read this MIDI file.");
			}
		},
		[consumeMidiBuffer],
	);

	const handleAudioFile = useCallback(
		async (file: File) => {
			setError(null);
			if (!isAudioFileName(file.name)) {
				setError("Unsupported audio format. Try .mp3, .wav, .flac, .ogg, .m4a.");
				return;
			}
			if (file.size > MAX_AUDIO_BYTES) {
				setError(`File too large (max ${Math.floor(MAX_AUDIO_BYTES / 1024 / 1024)} MB).`);
				return;
			}
			setAudioFileName(file.name);
			setStage("transcribing");
			setTranscribeProgress(0);
			setTranscribeMessage("Loading model…");
			activeEngineRef.current = selectedEngine;

			try {
				const midiBuffer = await transcribeAudioToMidi(
					file,
					(event) => {
						setTranscribeProgress(event.progress);
						setTranscribeMessage(event.message);
					},
					undefined,
					selectedEngine,
				);
				const midiName = file.name.replace(/\.[^.]+$/, "") + ".mid";
				const midiFile = new File([midiBuffer], midiName, { type: "audio/midi" });
				consumeMidiBuffer(midiFile, midiName, midiBuffer);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Transcription failed.");
				setStage("drop");
			}
		},
		[consumeMidiBuffer, selectedEngine],
	);

	const handleFile = useCallback(
		(file: File) => {
			if (source === "midi") handleMidiFile(file);
			else handleAudioFile(file);
		},
		[source, handleMidiFile, handleAudioFile],
	);

	const handleSave = useCallback(async () => {
		if (!pendingFile) return;
		const finalDifficulty: UploadDifficulty = difficulty === "auto" ? pendingAutoDifficulty : difficulty;
		setStage("saving");
		setError(null);
		try {
			const meta = await saveUploadedSong({
				file: pendingFile,
				title: title.trim() || "Untitled",
				artist: artist.trim(),
				difficulty: finalDifficulty,
				durationSeconds: pendingDuration,
				bpm: pendingBpm,
			});
			onUploaded(meta.id);
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save upload.");
			setStage("form");
		}
	}, [pendingFile, pendingDuration, pendingBpm, pendingAutoDifficulty, title, artist, difficulty, onUploaded, onClose]);

	if (!open) return null;

	return (
		<div
			className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/55"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-xl mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
				<div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
					<h2 className="text-xl font-semibold italic text-white/90">Import MIDI</h2>
					<button onClick={onClose} className="text-white/50 hover:text-white transition-colors text-2xl leading-none" aria-label="Close">
						×
					</button>
				</div>

				<div className="px-8 py-7">
					{!signedIn ? (
						<SignInPrompt />
					) : stage === "drop" ? (
						<>
							<SourceToggle source={source} onChange={setSource} />
							{source === "audio" && <EngineToggle selected={selectedEngine} onChange={setSelectedEngine} serverAvailable={isTranskunAvailable()} />}
							<DropZone
								source={source}
								dragOver={dragOver}
								onDragOver={setDragOver}
								onPickFile={() => inputRef.current?.click()}
								onFile={handleFile}
							/>
							<input
								ref={inputRef}
								type="file"
								accept={acceptForSource}
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) handleFile(file);
								}}
							/>
							{error && <p className="mt-4 text-rose-300/80 italic text-sm text-center">{error}</p>}
						</>
					) : stage === "transcribing" ? (
						<TranscribingStage progress={transcribeProgress} message={transcribeMessage} fileName={audioFileName} engine={activeEngineRef.current} />
					) : (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSave();
							}}
							className="flex flex-col gap-5"
						>
							<div className="text-xs italic text-white/40 truncate">{pendingFileName}</div>

							<Field label="Title">
								<input
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className="bg-transparent border-0 outline-none text-white text-base w-full"
									placeholder="Song title"
									required
								/>
							</Field>

							<Field label="Artist (optional)">
								<input
									type="text"
									value={artist}
									onChange={(e) => setArtist(e.target.value)}
									className="bg-transparent border-0 outline-none text-white text-base w-full"
									placeholder="Artist or composer"
								/>
							</Field>

							<div>
								<label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Difficulty</label>
								<div className="grid grid-cols-4 gap-2">
									{(["auto", "easy", "medium", "hard"] as const).map((d) => {
										const isActive = difficulty === d;
										const label = d === "auto" ? `Auto (${pendingAutoDifficulty})` : d.charAt(0).toUpperCase() + d.slice(1);
										return (
											<button
												key={d}
												type="button"
												onClick={() => setDifficulty(d)}
												className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
													isActive ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/55 hover:text-white/80"
												}`}
											>
												{label}
											</button>
										);
									})}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4 text-xs text-white/45">
								<div>
									<div className="uppercase tracking-widest text-[10px] text-white/35">Duration</div>
									<div className="text-white/80 tabular-nums mt-1">{formatDuration(pendingDuration)}</div>
								</div>
								<div>
									<div className="uppercase tracking-widest text-[10px] text-white/35">Tempo</div>
									<div className="text-white/80 tabular-nums mt-1">{pendingBpm} BPM</div>
								</div>
							</div>

							{error && <p className="text-rose-300/80 italic text-sm">{error}</p>}

							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => reset()}
									disabled={stage === "saving"}
									className="px-5 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
								>
									Pick another file
								</button>
								<button
									type="submit"
									disabled={stage === "saving"}
									className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-[1.02] transition-transform disabled:opacity-50"
								>
									{stage === "saving" ? "Uploading…" : "Save"}
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

function SourceToggle({ source, onChange }: { source: Source; onChange: (s: Source) => void }) {
	return (
		<div className="grid grid-cols-2 gap-2 mb-5">
			<ToggleButton active={source === "midi"} onClick={() => onChange("midi")}>
				MIDI file
			</ToggleButton>
			<ToggleButton active={source === "audio"} onClick={() => onChange("audio")}>
				Audio file
			</ToggleButton>
		</div>
	);
}

function EngineToggle({
	selected,
	onChange,
	serverAvailable,
}: {
	selected: TranscribeEngine;
	onChange: (engine: TranscribeEngine) => void;
	serverAvailable: boolean;
}) {
	return (
		<div className="grid grid-cols-2 gap-2 mb-5">
			<EngineCard active={selected === "basic-pitch"} onClick={() => onChange("basic-pitch")} title="Fast" detail="~30 seconds · decent quality" />
			<EngineCard
				active={selected === "transkun"}
				onClick={() => serverAvailable && onChange("transkun")}
				disabled={!serverAvailable}
				title="High quality"
				detail={serverAvailable ? "~3 minutes · much cleaner notes" : "Server not configured"}
			/>
		</div>
	);
}

function EngineCard({
	active,
	onClick,
	disabled,

	title,

	detail,
}: {
	active: boolean;
	onClick: () => void;
	disabled?: boolean;
	title: string;

	detail: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`rounded-xl border px-4 py-3 text-left transition-colors ${
				disabled
					? "border-white/5 bg-white/[0.02] text-white/30 cursor-not-allowed"
					: active
						? "border-white/30 bg-white/10 text-white"
						: "border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/8"
			}`}
		>
			<div className="flex items-center gap-2 text-sm font-medium">
				<span>{title}</span>
			</div>

			<div className="text-[11px] text-white/45 mt-0.5">{detail}</div>
		</button>
	);
}

function ToggleButton({
	active,
	onClick,
	children,
	disabled,
	title,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
	disabled?: boolean;
	title?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
				disabled
					? "border-white/5 bg-white/[0.02] text-white/30 cursor-not-allowed"
					: active
						? "border-white/30 bg-white/10 text-white"
						: "border-white/10 bg-white/5 text-white/65 hover:text-white"
			}`}
		>
			{children}
		</button>
	);
}

function SignInPrompt() {
	return (
		<div className="flex flex-col items-center text-center py-10">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-white/55 mb-4">
				<rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
				<path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
			</svg>
			<p className="text-white text-lg italic font-semibold mb-1">Sign in to import MIDI</p>
			<p className="text-white/55 text-sm max-w-sm">Your uploads are saved to your account so you only see your own files on any device.</p>
			<a href="/auth/login" className="mt-6 px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-[1.02] transition-transform">
				Sign in
			</a>
		</div>
	);
}

function DropZone({
	source,
	dragOver,
	onDragOver,
	onPickFile,
	onFile,
}: {
	source: Source;
	dragOver: boolean;
	onDragOver: (over: boolean) => void;
	onPickFile: () => void;
	onFile: (file: File) => void;
}) {
	const isMidi = source === "midi";
	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				onDragOver(true);
			}}
			onDragLeave={() => onDragOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				onDragOver(false);
				const file = e.dataTransfer.files?.[0];
				if (file) onFile(file);
			}}
			className={`flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed transition-colors py-14 px-6 ${
				dragOver ? "border-white/40 bg-white/5" : "border-white/15 bg-white/[0.02]"
			}`}
		>
			<svg width="38" height="38" viewBox="0 0 24 24" fill="none" className="text-white/55 mb-4">
				<path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
			<p className="text-white/80 italic text-base mb-1">{isMidi ? "Drag a MIDI file here" : "Drag an audio file here"}</p>
			<p className="text-white/40 text-sm mb-5">{isMidi ? ".mid or .midi · max 10 MB" : ".mp3, .wav, .flac, .ogg · max 50 MB"}</p>
			<button
				type="button"
				onClick={onPickFile}
				className="px-5 py-2 rounded-lg border border-white/15 text-white/85 hover:text-white hover:bg-white/5 transition-colors"
			>
				Browse files
			</button>
		</div>
	);
}

function TranscribingStage({
	progress,
	message,
	fileName,
	engine,
}: {
	progress: number;
	message: string;
	fileName: string;
	engine: TranscribeEngine;
}) {
	const clamped = Math.max(0, Math.min(100, Math.round(progress)));
	const isTranskun = engine === "transkun";
	return (
		<div className="py-10 flex flex-col items-center">
			<div className="text-6xl font-bold tabular-nums text-white mb-6 drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">{clamped}%</div>
			<div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-6">
				<div className="h-full bg-white/80 transition-[width] duration-300 ease-out" style={{ width: `${clamped}%` }} />
			</div>
			<p className="text-white/75 italic text-sm text-center px-2">{message}</p>
			{fileName && <p className="text-white/35 text-xs mt-2 truncate max-w-full">{fileName}</p>}
			<p className="text-white/40 text-xs mt-6 max-w-sm text-center leading-relaxed">
				{isTranskun ? (
					<>Expect 2-5 minutes per song. Leave this tab open — the result lands here when it finishes.</>
				) : (
					<>
						Audio-to-MIDI transcription runs in your browser. The first time may take a moment to download the model. Feel free to leave this tab
						open.
					</>
				)}
			</p>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">{label}</span>
			<div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">{children}</div>
		</label>
	);
}

function formatDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return "—";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}
