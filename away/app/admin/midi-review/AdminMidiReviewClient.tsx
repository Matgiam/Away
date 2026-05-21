"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useMidiPreview } from "@/hooks/useMidiPreview";
import {
	adminDeleteSubmission,
	approveSubmission,
	getCommunityMidiPublicUrl,
	listPendingSubmissions,
	listRecentlyReviewed,
	rejectSubmission,
	type CommunityMidi,
} from "@/lib/practice/community";
import type { UploadDifficulty } from "@/lib/practice/uploads";

export default function AdminMidiReviewClient() {
	const { settings } = useAudioEngineContext();
	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	const [pending, setPending] = useState<CommunityMidi[]>([]);
	const [reviewed, setReviewed] = useState<CommunityMidi[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actingId, setActingId] = useState<string | null>(null);
	const [rejectingId, setRejectingId] = useState<string | null>(null);
	const [rejectNote, setRejectNote] = useState("");

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [p, r] = await Promise.all([listPendingSubmissions(), listRecentlyReviewed(15)]);
			setPending(p);
			setReviewed(r);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load submissions.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleApprove = useCallback(
		async (id: string) => {
			setActingId(id);
			try {
				await approveSubmission(id);
				await refresh();
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to approve.");
			} finally {
				setActingId(null);
			}
		},
		[refresh],
	);

	const handleConfirmReject = useCallback(async () => {
		if (!rejectingId) return;
		setActingId(rejectingId);
		try {
			await rejectSubmission(rejectingId, rejectNote);
			setRejectingId(null);
			setRejectNote("");
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to reject.");
		} finally {
			setActingId(null);
		}
	}, [rejectingId, rejectNote, refresh]);

	const handleDelete = useCallback(
		async (id: string) => {
			if (!confirm("Permanently delete this submission and its file?")) return;
			setActingId(id);
			try {
				await adminDeleteSubmission(id);
				await refresh();
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to delete.");
			} finally {
				setActingId(null);
			}
		},
		[refresh],
	);

	return (
		<div className="h-[var(--app-h,100dvh)] w-screen bg-[#050505] text-gray-200 overflow-hidden relative">
			<SilkBackground
				color={settings.backgroundColor}
				scale={0.8}
				noiseIntensity={1.3}
				speed={3}
				rotation={180}
				animated={backgroundAnimated}
			/>
			<BackButton />

			<div className="relative z-10 h-full overflow-y-auto">
				<div className="mx-auto max-w-[1200px] flex flex-col gap-8 px-1 pt-16 pb-12">
					<header className="flex items-end justify-between gap-12 px-1">
						<div>
							<h1 className="text-white text-5xl font-bold italic tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
								Admin · MIDI review
							</h1>
							<p className="text-white/55 italic text-sm mt-2">
								Submitted MIDIs only show up in the community library once you approve them.
							</p>
						</div>
						<button
							onClick={refresh}
							className="text-sm italic text-white/60 hover:text-white px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
						>
							Refresh
						</button>
					</header>

					{error && (
						<div className="rounded-xl border border-rose-300/30 bg-rose-500/10 text-rose-200/90 px-5 py-3 italic">
							{error}
						</div>
					)}

					<section className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-6">
						<div className="flex items-center justify-between mb-5">
							<h2 className="text-white font-semibold text-2xl">
								Pending review{" "}
								<span className="text-white/40 text-base font-normal">({pending.length})</span>
							</h2>
						</div>

						{loading ? (
							<p className="text-white/50 italic">Loading…</p>
						) : pending.length === 0 ? (
							<p className="text-white/50 italic">No submissions waiting. </p>
						) : (
							<div className="flex flex-col gap-3">
								{pending.map((midi) => (
									<PendingRow
										key={midi.id}
										midi={midi}
										busy={actingId === midi.id}
										onApprove={() => handleApprove(midi.id)}
										onReject={() => {
											setRejectingId(midi.id);
											setRejectNote("");
										}}
										onDelete={() => handleDelete(midi.id)}
									/>
								))}
							</div>
						)}
					</section>

					<section className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-6">
						<h2 className="text-white font-semibold text-2xl mb-5">Recently reviewed</h2>

						{loading ? null : reviewed.length === 0 ? (
							<p className="text-white/50 italic">Nothing reviewed yet.</p>
						) : (
							<div className="flex flex-col gap-2">
								{reviewed.map((midi) => (
									<ReviewedRow
										key={midi.id}
										midi={midi}
										onDelete={() => handleDelete(midi.id)}
										busy={actingId === midi.id}
									/>
								))}
							</div>
						)}
					</section>
				</div>
			</div>

			{rejectingId && (
				<RejectModal
					note={rejectNote}
					onNoteChange={setRejectNote}
					onCancel={() => {
						setRejectingId(null);
						setRejectNote("");
					}}
					onConfirm={handleConfirmReject}
					busy={actingId === rejectingId}
				/>
			)}
		</div>
	);
}

function PendingRow({
	midi,
	busy,
	onApprove,
	onReject,
	onDelete,
}: {
	midi: CommunityMidi;
	busy: boolean;
	onApprove: () => void;
	onReject: () => void;
	onDelete: () => void;
}) {
	const preview = useMidiPreview();
	const url = useMemo(() => getCommunityMidiPublicUrl(midi.storagePath), [midi.storagePath]);
	const isPlaying = preview.activeUrl === url && preview.state === "playing";
	const isLoading = preview.activeUrl === url && preview.state === "loading";

	const togglePlay = useCallback(() => {
		if (isPlaying || isLoading) {
			preview.stop();
		} else {
			// Full play during review, not just 3s preview.
			preview.play(url, { maxDurationSec: Math.max(15, midi.durationSeconds) });
		}
	}, [isLoading, isPlaying, midi.durationSeconds, preview, url]);

	return (
		<div className="rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4 flex items-center justify-between gap-4">
			<div className="flex-1 min-w-0">
				<div className="text-white text-lg italic font-semibold tracking-wide truncate">
					{midi.title}
					{midi.artist && <span className="text-white/55"> – {midi.artist}</span>}
				</div>
				<div className="text-[12px] italic text-white/45 truncate mt-0.5 flex items-center gap-2 flex-wrap">
					<span>by {midi.submitterUsername ?? midi.submitterId.slice(0, 8)}</span>
					<span className="text-white/25">·</span>
					<span>{formatDuration(midi.durationSeconds)}</span>
					<span className="text-white/25">·</span>
					<span>{midi.bpm} BPM</span>
					<span className="text-white/25">·</span>
					<span>submitted {formatDate(midi.createdAt)}</span>
					<span className="text-white/25">·</span>
					<span className="text-white/35">{midi.fileName}</span>
				</div>
			</div>

			<div className="flex items-center gap-2 shrink-0">
				<DifficultyBadge difficulty={midi.difficulty} />
				<button
					onClick={togglePlay}
					disabled={busy}
					className={`px-3 py-2 rounded-lg border text-sm italic transition-colors disabled:opacity-40 ${
						isPlaying || isLoading
							? "border-violet-300/40 bg-violet-500/20 text-violet-100"
							: "border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
					}`}
					title={isPlaying ? "Stop preview" : "Play through your speakers"}
				>
					{isPlaying ? "Stop" : isLoading ? "Loading…" : "Play"}
				</button>
				<button
					onClick={onApprove}
					disabled={busy}
					className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-300/40 text-emerald-100 italic text-sm hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
				>
					{busy ? "…" : "Accept"}
				</button>
				<button
					onClick={onReject}
					disabled={busy}
					className="px-4 py-2 rounded-lg bg-rose-500/15 border border-rose-300/30 text-rose-100 italic text-sm hover:bg-rose-500/25 transition-colors disabled:opacity-40"
				>
					Reject
				</button>
				<button
					onClick={onDelete}
					disabled={busy}
					className="text-white/35 hover:text-rose-300 transition-colors px-1"
					title="Delete submission"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path
							d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
}

function ReviewedRow({
	midi,
	onDelete,
	busy,
}: {
	midi: CommunityMidi;
	onDelete: () => void;
	busy: boolean;
}) {
	const isApproved = midi.status === "approved";
	return (
		<div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/5">
			<div className="flex-1 min-w-0 flex items-center gap-3">
				<span
					className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${
						isApproved
							? "bg-emerald-500/15 text-emerald-200/90 border-emerald-300/20"
							: "bg-rose-500/15 text-rose-200/90 border-rose-300/20"
					}`}
				>
					{midi.status}
				</span>
				<span className="text-white/85 italic truncate">
					{midi.title}
					{midi.artist && <span className="text-white/45"> – {midi.artist}</span>}
				</span>
				<span className="text-white/35 text-xs italic shrink-0">
					by {midi.submitterUsername ?? midi.submitterId.slice(0, 8)}
				</span>
				{midi.reviewNote && (
					<span className="text-white/40 text-xs italic truncate">· {midi.reviewNote}</span>
				)}
			</div>
			<button
				onClick={onDelete}
				disabled={busy}
				className="text-white/35 hover:text-rose-300 transition-colors px-1 disabled:opacity-40"
				title="Delete"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
					<path
						d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
		</div>
	);
}

function RejectModal({
	note,
	onNoteChange,
	onCancel,
	onConfirm,
	busy,
}: {
	note: string;
	onNoteChange: (s: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
	busy: boolean;
}) {
	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/55"
			onClick={(e) => {
				if (e.target === e.currentTarget && !busy) onCancel();
			}}
		>
			<div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
				<div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
					<h3 className="text-white italic font-semibold">Reject submission</h3>
					<button
						onClick={onCancel}
						disabled={busy}
						className="text-white/50 hover:text-white text-2xl leading-none disabled:opacity-30"
					>
						×
					</button>
				</div>
				<div className="px-6 py-5">
					<label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">
						Reason (shown to the submitter — optional)
					</label>
					<textarea
						value={note}
						onChange={(e) => onNoteChange(e.target.value)}
						rows={3}
						className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-white/25 resize-none"
						placeholder="e.g. low-quality transcription, contains non-piano notes…"
						disabled={busy}
					/>
					<div className="flex justify-end gap-3 mt-5">
						<button
							onClick={onCancel}
							disabled={busy}
							className="px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
						>
							Cancel
						</button>
						<button
							onClick={onConfirm}
							disabled={busy}
							className="px-5 py-2 rounded-lg bg-rose-500/30 border border-rose-300/40 text-rose-100 italic hover:bg-rose-500/40 transition-colors disabled:opacity-40"
						>
							{busy ? "Rejecting…" : "Confirm reject"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

const DIFFICULTY_COLORS: Record<UploadDifficulty, string> = {
	easy: "bg-emerald-500/15 text-emerald-200/90 border-emerald-300/20",
	medium: "bg-amber-500/15 text-amber-200/90 border-amber-300/20",
	hard: "bg-rose-500/15 text-rose-200/90 border-rose-300/20",
};

function DifficultyBadge({ difficulty }: { difficulty: UploadDifficulty }) {
	return (
		<span
			className={`text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${DIFFICULTY_COLORS[difficulty]}`}
		>
			{difficulty}
		</span>
	);
}

function formatDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return "—";
	const total = Math.floor(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
