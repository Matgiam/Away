"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseMidi } from "@/lib/practice/midiParser";
import { prettifyFileName } from "@/lib/practice/songs";
import {
	generateUploadId,
	saveUploadedSong,
	type UploadDifficulty,
} from "@/lib/practice/uploads";
import { estimateDifficulty } from "@/lib/practice/difficulty";

interface UploadModalProps {
	open: boolean;
	onClose: () => void;
	onUploaded: (id: string) => void;
}

type Stage = "drop" | "form" | "saving";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [stage, setStage] = useState<Stage>("drop");
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);

	const [pendingBuffer, setPendingBuffer] = useState<ArrayBuffer | null>(null);
	const [pendingFileName, setPendingFileName] = useState("");
	const [pendingDuration, setPendingDuration] = useState(0);
	const [pendingBpm, setPendingBpm] = useState(120);
	const [pendingAutoDifficulty, setPendingAutoDifficulty] = useState<UploadDifficulty>("medium");

	const [title, setTitle] = useState("");
	const [artist, setArtist] = useState("");
	const [difficulty, setDifficulty] = useState<UploadDifficulty | "auto">("auto");

	const reset = useCallback(() => {
		setStage("drop");
		setError(null);
		setDragOver(false);
		setPendingBuffer(null);
		setPendingFileName("");
		setPendingDuration(0);
		setPendingBpm(120);
		setPendingAutoDifficulty("medium");
		setTitle("");
		setArtist("");
		setDifficulty("auto");
		if (inputRef.current) inputRef.current.value = "";
	}, []);

	useEffect(() => {
		if (!open) reset();
	}, [open, reset]);

	const handleFile = useCallback(async (file: File) => {
		setError(null);
		if (!/\.midi?$/i.test(file.name)) {
			setError("Only .mid / .midi files are supported.");
			return;
		}
		if (file.size > MAX_FILE_BYTES) {
			setError("File too large (max 10 MB).");
			return;
		}
		try {
			const buffer = await file.arrayBuffer();
			const parsed = parseMidi(buffer);
			const guessed = prettifyFileName(file.name);
			setPendingBuffer(buffer);
			setPendingFileName(file.name);
			setPendingDuration(parsed.durationSeconds);
			setPendingBpm(parsed.initialTempoBpm);
			setPendingAutoDifficulty(estimateDifficulty(parsed));
			setTitle(guessed.title);
			setArtist(guessed.artist ?? "");
			setDifficulty("auto");
			setStage("form");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not read this MIDI file.");
		}
	}, []);

	const handleSave = useCallback(async () => {
		if (!pendingBuffer) return;
		const finalDifficulty: UploadDifficulty = difficulty === "auto" ? pendingAutoDifficulty : difficulty;
		const id = generateUploadId();
		setStage("saving");
		try {
			await saveUploadedSong({
				id,
				title: title.trim() || "Untitled",
				artist: artist.trim(),
				difficulty: finalDifficulty,
				fileName: pendingFileName,
				durationSeconds: pendingDuration,
				bpm: pendingBpm,
				data: pendingBuffer,
				createdAt: Date.now(),
			});
			onUploaded(id);
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to save upload.");
			setStage("form");
		}
	}, [
		pendingBuffer,
		pendingFileName,
		pendingDuration,
		pendingBpm,
		pendingAutoDifficulty,
		title,
		artist,
		difficulty,
		onUploaded,
		onClose,
	]);

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
					<button
						onClick={onClose}
						className="text-white/50 hover:text-white transition-colors text-2xl leading-none"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="px-8 py-7">
					{stage === "drop" && (
						<>
							<DropZone
								dragOver={dragOver}
								onDragOver={(over) => setDragOver(over)}
								onPickFile={() => inputRef.current?.click()}
								onFile={handleFile}
							/>
							<input
								ref={inputRef}
								type="file"
								accept=".mid,.midi,audio/midi,audio/x-midi"
								className="hidden"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) handleFile(file);
								}}
							/>
							{error && <p className="mt-4 text-rose-300/80 italic text-sm text-center">{error}</p>}
						</>
					)}

					{(stage === "form" || stage === "saving") && (
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
								<label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">
									Difficulty
								</label>
								<div className="grid grid-cols-4 gap-2">
									{(["auto", "easy", "medium", "hard"] as const).map((d) => {
										const isActive = difficulty === d;
										const label =
											d === "auto"
												? `Auto (${pendingAutoDifficulty})`
												: d.charAt(0).toUpperCase() + d.slice(1);
										return (
											<button
												key={d}
												type="button"
												onClick={() => setDifficulty(d)}
												className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
													isActive
														? "border-white/30 bg-white/10 text-white"
														: "border-white/10 bg-white/5 text-white/55 hover:text-white/80"
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
									onClick={() => {
										reset();
									}}
									className="px-5 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
								>
									Pick another file
								</button>
								<button
									type="submit"
									disabled={stage === "saving"}
									className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-[1.02] transition-transform disabled:opacity-50"
								>
									{stage === "saving" ? "Saving…" : "Save"}
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

function DropZone({
	dragOver,
	onDragOver,
	onPickFile,
	onFile,
}: {
	dragOver: boolean;
	onDragOver: (over: boolean) => void;
	onPickFile: () => void;
	onFile: (file: File) => void;
}) {
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
				<path
					d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16"
					stroke="currentColor"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<p className="text-white/80 italic text-base mb-1">Drag a MIDI file here</p>
			<p className="text-white/40 text-sm mb-5">.mid or .midi · max 10 MB</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="block">
			<span className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">
				{label}
			</span>
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
