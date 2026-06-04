"use client";

import { useCallback, useEffect, useState } from "react";
import {
	submitFromExistingUpload,
	type CommunityMidi,
} from "@/lib/practice/community";
import type {
	UploadDifficulty,
	UploadedSongMeta,
} from "@/lib/practice/uploads";

interface PublishToCommunityModalProps {
	open: boolean;
	upload: UploadedSongMeta | null;
	onClose: () => void;
	onSubmitted: (result: CommunityMidi) => void;
}

type Stage = "form" | "submitting";

export function PublishToCommunityModal({
	open,
	upload,
	onClose,
	onSubmitted,
}: PublishToCommunityModalProps) {
	const [stage, setStage] = useState<Stage>("form");
	const [title, setTitle] = useState("");
	const [artist, setArtist] = useState("");
	const [difficulty, setDifficulty] = useState<UploadDifficulty>("medium");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open && upload) {
			setTitle(upload.title);
			setArtist(upload.artist);
			setDifficulty(upload.difficulty);
			setError(null);
			setStage("form");
		}
	}, [open, upload]);

	const handleSubmit = useCallback(async () => {
		if (!upload) return;
		setError(null);
		setStage("submitting");
		try {
			const result = await submitFromExistingUpload(upload, {
				title: title.trim() || upload.title,
				artist: artist.trim(),
				difficulty,
			});
			onSubmitted(result);
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to publish. Please try again.");
			setStage("form");
		}
	}, [artist, difficulty, onClose, onSubmitted, title, upload]);

	if (!open || !upload) return null;

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/55">
			<div className="w-full max-w-xl mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
				<div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
					<h2 className="text-xl font-semibold italic text-white/90">Publish to community</h2>
					<button
						onClick={onClose}
						disabled={stage === "submitting"}
						className="text-white/50 hover:text-white transition-colors text-2xl leading-none disabled:opacity-30"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="px-8 py-7 flex flex-col gap-5">
					<p className="text-white/55 text-sm italic leading-relaxed">
						Your MIDI will be reviewed before it appears in the community library. Once approved,
						any signed-in player can preview and practice it.
					</p>

					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSubmit();
						}}
						className="flex flex-col gap-5"
					>
						<Field label="Title">
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="bg-transparent border-0 outline-none text-white text-base w-full"
								placeholder="Song title"
								required
								disabled={stage === "submitting"}
							/>
						</Field>

						<Field label="Artist (optional)">
							<input
								type="text"
								value={artist}
								onChange={(e) => setArtist(e.target.value)}
								className="bg-transparent border-0 outline-none text-white text-base w-full"
								placeholder="Artist or composer"
								disabled={stage === "submitting"}
							/>
						</Field>

						<div>
							<label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">
								Difficulty
							</label>
							<div className="grid grid-cols-3 gap-2">
								{(["easy", "medium", "hard"] as const).map((d) => {
									const isActive = difficulty === d;
									return (
										<button
											key={d}
											type="button"
											onClick={() => setDifficulty(d)}
											disabled={stage === "submitting"}
											className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
												isActive
													? "border-white/30 bg-white/10 text-white"
													: "border-white/10 bg-white/5 text-white/55 hover:text-white/80"
											} disabled:opacity-40`}
										>
											{d.charAt(0).toUpperCase() + d.slice(1)}
										</button>
									);
								})}
							</div>
						</div>

						<div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55 italic">
							You will receive no email — just check back in the practice menu. If the review
							gets rejected, you&apos;ll see the reason here next to the file.
						</div>

						{error && <p className="text-rose-300/80 italic text-sm">{error}</p>}

						<div className="flex justify-end gap-3 pt-1">
							<button
								type="button"
								onClick={onClose}
								disabled={stage === "submitting"}
								className="px-5 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={stage === "submitting"}
								className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-[1.02] transition-transform disabled:opacity-50"
							>
								{stage === "submitting" ? "Submitting…" : "Submit for review"}
							</button>
						</div>
					</form>
				</div>
			</div>
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
