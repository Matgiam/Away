// ============================================================================
// practice/AudioTrackControl.tsx
// ----------------------------------------------------------------------------
// Floating control rendered in the practice player whenever the loaded song
// has an original audio track stored (transcribed uploads only).
//
// Shows a speaker icon (click to toggle mute) and a horizontal volume slider.
// The actual audio element + sync logic lives in useAudioTrack — this is
// purely the user-facing dial.
// ============================================================================

"use client";

import { useEffect, useRef, useState } from "react";

const PERSIST_VOLUME_KEY = "away:practice-audio-volume";
const PERSIST_ENABLED_KEY = "away:practice-audio-enabled";

interface AudioTrackControlProps {
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
	volume: number;
	onVolumeChange: (volume: number) => void;
}

// Pill with a speaker icon (mute toggle) + horizontal volume slider.
// Anchored top-left of the practice player so it doesn't clash with the song
// chip (top-centre) or the right-side practice controls.
export function AudioTrackControl({ enabled, onEnabledChange, volume, onVolumeChange }: AudioTrackControlProps) {
	return (
		<div
			className="absolute top-6 left-6 z-30 flex items-center gap-3 px-4 py-2.5 rounded-full border border-white/10 bg-[#0a0118]/80 backdrop-blur-xl shadow-lg"
			style={{ pointerEvents: "auto" }}
		>
			<button
				type="button"
				onClick={() => onEnabledChange(!enabled)}
				title={enabled ? "Mute original audio" : "Unmute original audio"}
				className="text-white/85 hover:text-white transition-colors"
			>
				{enabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
			</button>
			<input
				type="range"
				min={0}
				max={100}
				step={1}
				value={volume}
				onChange={(e) => onVolumeChange(Number(e.target.value))}
				className="w-28 accent-white/80 cursor-pointer"
				aria-label="Original audio volume"
			/>
			<span className="text-[10px] uppercase tracking-widest text-white/40 select-none">Audio</span>
		</div>
	);
}

// Persists the user's preferred volume + mute state across sessions so they
// don't have to re-set it every time they open a song.
export function usePersistedAudioPrefs(): {
	enabled: boolean;
	setEnabled: (v: boolean) => void;
	volume: number;
	setVolume: (v: number) => void;
} {
	const [enabled, setEnabledState] = useState(true);
	// Default volume is intentionally quiet — the original audio is a
	// guidance track, not the main thing the user wants to hear. They can
	// raise it with the slider; localStorage remembers the choice.
	const [volume, setVolumeState] = useState(15);
	// Defer hydration to a ref so the initial render matches SSR (both start
	// at the defaults above) and we only restore in the client.
	const hydratedRef = useRef(false);

	useEffect(() => {
		if (typeof window === "undefined" || hydratedRef.current) return;
		hydratedRef.current = true;
		try {
			const v = window.localStorage.getItem(PERSIST_VOLUME_KEY);
			if (v !== null) {
				const n = Number(v);
				if (Number.isFinite(n)) setVolumeState(Math.max(0, Math.min(100, n)));
			}
			const e = window.localStorage.getItem(PERSIST_ENABLED_KEY);
			if (e === "0") setEnabledState(false);
		} catch {
			// localStorage can throw in private mode — ignore.
		}
	}, []);

	const setEnabled = (v: boolean) => {
		setEnabledState(v);
		try {
			window.localStorage.setItem(PERSIST_ENABLED_KEY, v ? "1" : "0");
		} catch {}
	};
	const setVolume = (v: number) => {
		setVolumeState(v);
		try {
			window.localStorage.setItem(PERSIST_VOLUME_KEY, String(v));
		} catch {}
	};

	return { enabled, setEnabled, volume, setVolume };
}

function SpeakerOnIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M11 5 6 9H2v6h4l5 4V5Z" />
			<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
		</svg>
	);
}

function SpeakerOffIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M11 5 6 9H2v6h4l5 4V5Z" />
			<path d="M22 9l-6 6M16 9l6 6" />
		</svg>
	);
}
