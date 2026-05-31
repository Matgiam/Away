"use client";

import type { BackgroundTranscribeState } from "@/hooks/useBackgroundTranscription";

interface TranscriptionLoadingProps {
	state: BackgroundTranscribeState;
	// Click handler — only meaningful when state.phase === "done". When the user
	// clicks the bar after completion, the parent reopens the upload modal at
	// the form stage with the transcription result prefilled.
	onOpenFinalize: () => void;
	// Lifts the toast from the screen. For terminal states (done/error) this is
	// a soft dismiss; for the running state it aborts the in-flight job.
	onDismiss: () => void;
	onCancel: () => void;
}

export function TranscriptionLoading({
	state,
	onOpenFinalize,
	onDismiss,
	onCancel,
}: TranscriptionLoadingProps) {
	if (state.phase === "idle") return null;

	const isRunning = state.phase === "running";
	const isDone = state.phase === "done";
	const isError = state.phase === "error";

	const clamped = isRunning ? Math.max(0, Math.min(100, Math.round(state.progress))) : isDone ? 100 : 0;
	const fileName = state.fileName;

	// The whole card is clickable when state is "done". Implemented as a div
	// (not <button>) so the dismiss × inside doesn't violate the "no nested
	// buttons" HTML rule — clicking × stops propagation so it doesn't trigger
	// finalize.
	const onCardClick = isDone ? onOpenFinalize : undefined;
	const onCardKeyDown = isDone
		? (e: React.KeyboardEvent<HTMLDivElement>) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpenFinalize();
				}
			}
		: undefined;

	return (
		<div className="fixed bottom-6 right-6 z-[60] pointer-events-none">
			<div
				onClick={onCardClick}
				onKeyDown={onCardKeyDown}
				role={isDone ? "button" : undefined}
				tabIndex={isDone ? 0 : undefined}
				className={`pointer-events-auto w-[340px] rounded-2xl border backdrop-blur-xl shadow-2xl text-left transition-colors ${
					isDone
						? "border-emerald-400/30 bg-[#0a1f15]/90 hover:border-emerald-400/50 hover:bg-[#0e2a1c]/90 cursor-pointer"
						: isError
							? "border-rose-400/30 bg-[#1f0a14]/90"
							: "border-white/10 bg-[#0d0620]/90"
				}`}
			>
				<div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-medium">
							<StatusDot phase={state.phase} />
							<span
								className={`${
									isDone ? "text-emerald-300/80" : isError ? "text-rose-300/80" : "text-white/55"
								}`}
							>
								{isRunning
									? "Transcribing audio"
									: isDone
										? "Ready — click to finalize"
										: "Transcription failed"}
							</span>
						</div>
						<p className="mt-1.5 text-sm text-white/85 italic truncate" title={fileName}>
							{fileName}
						</p>
					</div>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							if (isRunning) onCancel();
							else onDismiss();
						}}
						className="text-white/40 hover:text-white transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center shrink-0"
						aria-label={isRunning ? "Cancel transcription" : "Dismiss"}
					>
						×
					</button>
				</div>

				{(isRunning || isDone) && (
					<div className="px-4 pb-3">
						<div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
							<div
								className={`h-full transition-[width] duration-300 ease-out ${
									isDone ? "bg-emerald-400" : "bg-white/75"
								}`}
								style={{ width: `${clamped}%` }}
							/>
						</div>
						{isRunning && (
							<p className="mt-2 text-[11px] text-white/50 italic truncate" title={state.message}>
								{state.message}
							</p>
						)}
					</div>
				)}

				{isError && (
					<div className="px-4 pb-3">
						<p className="text-[11px] text-rose-300/80 italic">{state.error}</p>
					</div>
				)}
			</div>
		</div>
	);
}

function StatusDot({ phase }: { phase: BackgroundTranscribeState["phase"] }) {
	if (phase === "running") {
		return <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />;
	}
	if (phase === "done") {
		return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />;
	}
	if (phase === "error") {
		return <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />;
	}
	return null;
}
