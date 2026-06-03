// ============================================================================
// courses/FinishScreen.tsx
// ----------------------------------------------------------------------------
// "Course complete" celebration overlay shown after the final step. Lists
// the summary bullets (either from `course.summary` or auto-derived from
// the step titles) and offers Replay / Back-to-courses actions.
// ============================================================================

"use client";

interface FinishScreenProps {
	courseTitle: string;
	summary: string[];
	onBackToCourses: () => void;
	onReplay: () => void;
}

export function FinishScreen({ courseTitle, summary, onBackToCourses, onReplay }: FinishScreenProps) {
	return (
		<div
			className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onBackToCourses}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-[560px] mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
			>
				<div className="flex flex-col px-12 pt-12 pb-10">
					<span className="text-white/40 text-xs italic tracking-[0.25em] uppercase mb-3">Course complete</span>
					<h1 className="text-white text-4xl font-light italic leading-tight">{courseTitle}</h1>

					<div className="h-px bg-white/10 my-9" />

					<span className="text-white/40 text-xs italic tracking-[0.25em] uppercase mb-5">What you learned</span>
					<ul className="flex flex-col gap-3">
						{summary.map((line, i) => (
							<li key={i} className="flex items-start gap-4">
								<span className="mt-[10px] block w-[14px] h-[2px] rounded-full bg-[#7a2db0] shrink-0" aria-hidden />
								<span className="text-white/85 text-[15px] italic leading-relaxed">{line}</span>
							</li>
						))}
					</ul>

					<div className="flex items-center justify-end gap-3 mt-12">
						<button
							onClick={onReplay}
							className="px-5 py-3 rounded-xl border border-white/15 bg-white/[0.03] text-white/85 italic text-sm tracking-wide hover:bg-white/[0.08] hover:text-white transition-colors"
						>
							Replay course
						</button>
						<button
							onClick={onBackToCourses}
							className="px-5 py-3 rounded-xl border border-white/15 bg-white/[0.03] text-white/85 italic text-sm tracking-wide hover:bg-white/[0.08] hover:text-white transition-colors"
						>
							Back to courses
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// Build a default summary from step titles. Drops empty titles and deduplicates trivial repeats.
export function summaryFromSteps(stepTitles: Array<string | undefined>): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const t of stepTitles) {
		if (!t) continue;
		const trimmed = t.trim();
		if (!trimmed) continue;
		const lower = trimmed.toLowerCase();
		if (seen.has(lower)) continue;
		seen.add(lower);
		out.push(trimmed);
	}
	return out;
}
