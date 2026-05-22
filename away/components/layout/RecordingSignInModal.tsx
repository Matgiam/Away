"use client";

import { useEffect } from "react";

interface RecordingSignInModalProps {
	open: boolean;
	onClose: () => void;
}

// Shown when the user hits the record button without being signed in. Recording
// uploads attach to a userId, so we refuse to start the screen-capture flow at
// all rather than letting them record into the void.
export function RecordingSignInModal({ open, onClose }: RecordingSignInModalProps) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	const loginHref = `/auth/login?next=${encodeURIComponent(
		typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
	)}`;

	return (
		<div
			className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm bg-black/55"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
				<div className="flex items-center justify-between px-7 py-4 border-b border-white/5">
					<h2 className="text-lg font-semibold italic text-white/90">Sign in to record</h2>
					<button
						onClick={onClose}
						className="text-white/50 hover:text-white transition-colors text-2xl leading-none"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div className="px-7 py-6">
					<div className="flex items-start gap-4">
						<div className="shrink-0 w-12 h-12 rounded-full border border-rose-300/40 bg-rose-500/15 text-rose-200 flex items-center justify-center">
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								className="w-5 h-5"
								aria-hidden
							>
								<circle cx="12" cy="12" r="6" />
							</svg>
						</div>
						<div>
							<p className="text-white italic">
								Recordings are saved to your account so you can play them back later from
								your profile page.
							</p>
							<p className="text-white/55 text-sm italic mt-2">
								Sign in (or create a free account) and the record button will be ready
								whenever you are.
							</p>
						</div>
					</div>

					<div className="flex justify-end gap-3 mt-7">
						<button
							onClick={onClose}
							className="px-5 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
						>
							Not now
						</button>
						<a
							href={loginHref}
							className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:scale-[1.02] transition-transform"
						>
							Sign in
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
