// ============================================================================
// useAudioTrack.ts
// ----------------------------------------------------------------------------
// Drives an HTMLAudioElement so the original source audio (kept when a song
// was created via audio→MIDI transcription) plays in lockstep with the MIDI
// playhead in practice mode.
//
// Design:
//   * The MIDI playback engine is the source of truth for `currentTime`.
//     Audio is a slave — it follows.
//   * Setting `audio.currentTime` every frame causes browser jitter, so we
//     resync only when drift > DRIFT_TOLERANCE.
//   * Mute is independent of volume: the user keeps their preferred level
//     and just toggles the audio on/off without sliding back to zero.
//   * Negative `currentTime` (the lead-in countdown) keeps audio paused at 0.
// ============================================================================

"use client";

import { useEffect, useRef } from "react";

// Browser timing isn't sample-accurate; ±150 ms drift is inaudible most of
// the time but worth correcting before it becomes obvious.
const DRIFT_TOLERANCE_SECONDS = 0.15;

export type AudioTrackOptions = {
	/** Public/signed URL of the audio file. Null disables playback. */
	url: string | null;
	/** Current playhead in seconds (MIDI side). Negative during lead-in. */
	currentTime: number;
	/** True when the MIDI is actively advancing. */
	playing: boolean;
	/** Playback rate (1.0 = real-time). Mirrors the practice speed control. */
	speed: number;
	/** False routes audio through `audio.muted = true` while keeping volume. */
	enabled: boolean;
	/** 0–100 user-facing slider value. */
	volume: number;
};

/**
 * Returns a ref to attach to an `<audio>` element rendered by the caller.
 * All sync side-effects flow through that element.
 */
export function useAudioTrack({
	url,
	currentTime,
	playing,
	speed,
	enabled,
	volume,
}: AudioTrackOptions) {
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Reset the playhead whenever the source URL changes — a fresh signed URL
	// for the same upload would otherwise leak the previous offset in.
	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		el.currentTime = 0;
	}, [url]);

	// Volume / mute. Volume rides 0..1 inside the element; the mute toggle is
	// a separate channel so flipping it doesn't blow away the user's slider
	// position.
	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		el.volume = Math.max(0, Math.min(1, volume / 100));
		el.muted = !enabled;
	}, [volume, enabled]);

	// Playback rate. Browsers support 0.25–4× without pitch correction; the
	// practice presets stay well within that.
	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		el.playbackRate = speed;
	}, [speed]);

	// Main sync effect. Re-runs whenever the practice state shifts (play/pause,
	// seek, source change, lead-in tick). Inside, we:
	//   1. Keep audio paused while currentTime < 0 (we're still in the
	//      countdown — there's no song-time to align with yet).
	//   2. Resync audio.currentTime when it drifts past tolerance.
	//   3. Mirror play/pause.
	useEffect(() => {
		const el = audioRef.current;
		if (!el || !url) return;

		if (currentTime < 0) {
			if (!el.paused) el.pause();
			if (el.currentTime !== 0) el.currentTime = 0;
			return;
		}

		const target = Math.max(0, currentTime);
		if (Math.abs(el.currentTime - target) > DRIFT_TOLERANCE_SECONDS) {
			el.currentTime = target;
		}

		if (playing) {
			// `play()` returns a promise that rejects if the user hasn't
			// interacted yet (autoplay policy). The practice player only ever
			// reaches `playing=true` after a click, so the rejection path is
			// effectively unreachable — but we still swallow it so it doesn't
			// surface as an "Uncaught (in promise)" warning in dev.
			if (el.paused) void el.play().catch(() => {});
		} else {
			if (!el.paused) el.pause();
		}
	}, [url, currentTime, playing]);

	// On unmount, stop the audio so it doesn't keep playing after navigating
	// away from the practice page. The ref is the source of truth at cleanup
	// time — the warning about ref mutation doesn't apply here because we
	// specifically want whichever element is currently mounted.
	useEffect(() => {
		const ref = audioRef;
		return () => {
			const el = ref.current;
			if (el && !el.paused) el.pause();
		};
	}, []);

	return audioRef;
}
