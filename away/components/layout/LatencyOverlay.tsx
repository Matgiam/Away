// ============================================================================
// layout/LatencyOverlay.tsx
// ----------------------------------------------------------------------------
// Optional debug overlay that shows live round-trip latency to Supabase.
// Pings the REST endpoint every 2 seconds and displays the elapsed ms.
// Visible only when `settings.showLatency` is on (toggled via SettingsPanel).
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";

const PING_INTERVAL_MS = 2000;

export function LatencyOverlay() {
	const { settings } = useAudioEngineContext();
	const [latencyMs, setLatencyMs] = useState<number | null>(null);

	useEffect(() => {
		if (!settings.showLatency) {
			setLatencyMs(null);
			return;
		}

		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!url || !key) return;

		let cancelled = false;
		const target = `${url}/rest/v1/`;

		const measure = async () => {
			const start = performance.now();
			try {
				await fetch(target, {
					method: "HEAD",
					cache: "no-store",
					headers: { apikey: key },
				});
			} catch {
				if (!cancelled) setLatencyMs(null);
				return;
			}
			if (cancelled) return;
			setLatencyMs(Math.round(performance.now() - start));
		};

		measure();
		const interval = window.setInterval(measure, PING_INTERVAL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [settings.showLatency]);

	if (!settings.showLatency) return null;

	const tone =
		latencyMs === null
			? "text-white/50"
			: latencyMs < 80
				? "text-green-300"
				: latencyMs < 200
					? "text-amber-300"
					: "text-red-300";

	return (
		<div
			aria-live="polite"
			className="fixed bottom-3 left-3 z-[150] pointer-events-none select-none rounded-md border border-white/10 bg-black/40 backdrop-blur-sm px-2.5 py-1 text-xs font-mono tabular-nums shadow-sm"
		>
			<span className="text-white/40 mr-1.5">ping</span>
			<span className={tone}>{latencyMs === null ? "—" : `${latencyMs} ms`}</span>
		</div>
	);
}
