// ============================================================================
// layout/RecordingSavedBanner.tsx
// ----------------------------------------------------------------------------
// Toast that drops in from the top after a screen recording finishes
// uploading. Same look-and-feel as the achievements banner (so the two are
// visually consistent when they happen to fire close together) but with
// recording-specific copy and a film-reel icon.
//
// Host-driven: the parent (`RecordingSavedBannerHost`) decides when to mount
// and unmount this component. We just animate in, sit for a few seconds, then
// animate out and call onDismiss.
// ============================================================================

"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface Props {
	onDismiss: () => void;
}

export function RecordingSavedBanner({ onDismiss }: Props) {
	const ref = useRef<HTMLDivElement>(null);

	useGSAP(() => {
		const el = ref.current;
		if (!el) return;

		// Same back-out entry as the achievement banner. Sits a touch longer
		// (5 s vs the achievements' 6 s) because the copy is shorter and the
		// user just acted — no need to dwell as long.
		gsap.fromTo(
			el,
			{ y: -120, opacity: 0 },
			{
				y: 0,
				opacity: 1,
				duration: 1.2,
				ease: "back.out(1.7)",
				onComplete: () => {
					gsap.to(el, {
						y: -120,
						opacity: 0,
						duration: 1,
						ease: "power2.in",
						delay: 5,
						onComplete: onDismiss,
					});
				},
			},
		);
	}, []);

	return (
		<div
			ref={ref}
			className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
		>
			<div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a0118]/90 backdrop-blur-xl px-6 py-4 shadow-2xl">
				<div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
					<FilmIcon className="w-6 h-6 text-white/85" aria-hidden />
				</div>
				<div>
					<p className="text-white/50 text-xs uppercase tracking-widest font-medium">
						Recording Saved
					</p>
					<p className="text-white text-lg font-semibold">Video saved</p>
					<p className="text-white/40 text-sm">Find it in Recordings on your profile page</p>
				</div>
			</div>
		</div>
	);
}

// Inline icon so this component is self-contained — no extra import / asset.
function FilmIcon({ className, ...rest }: { className?: string } & React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			{...rest}
		>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M3 8h2M3 12h2M3 16h2M19 8h2M19 12h2M19 16h2M7 4v16M17 4v16" />
		</svg>
	);
}
