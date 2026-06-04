// ============================================================================
// layout/RecordingSavedBannerHost.tsx
// ----------------------------------------------------------------------------
// Listens for RECORDING_SAVED_EVENT from anywhere in the app and pops one
// RecordingSavedBanner per event. Mirrors AchievementBannerHost — events are
// queued so back-to-back uploads each get their own toast instead of being
// swallowed.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { RecordingSavedBanner } from "./RecordingSavedBanner";
import { RECORDING_SAVED_EVENT } from "@/lib/recording";

export function RecordingSavedBannerHost() {
	// Queue is keyed by a monotonically-increasing sequence number so React
	// can tell consecutive banners apart even though they carry no payload.
	const [queue, setQueue] = useState<number[]>([]);
	const current = queue[0] ?? null;

	useEffect(() => {
		if (typeof window === "undefined") return;
		let seq = 0;
		const onSaved = () => {
			seq += 1;
			const id = seq;
			setQueue((prev) => [...prev, id]);
		};
		window.addEventListener(RECORDING_SAVED_EVENT, onSaved);
		return () => window.removeEventListener(RECORDING_SAVED_EVENT, onSaved);
	}, []);

	if (current === null) return null;

	return (
		<RecordingSavedBanner
			key={current}
			onDismiss={() => setQueue((prev) => prev.slice(1))}
		/>
	);
}
