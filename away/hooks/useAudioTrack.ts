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

import { useCallback, useEffect, useRef, useState } from "react";

// Browser timing isn't sample-accurate; ±150 ms drift is inaudible most of
// the time but worth correcting before it becomes obvious.
const DRIFT_TOLERANCE_SECONDS = 0.15;

// Hard ceiling on what the slider can pump out of the <audio> element.
// Mastered music files peak near 0 dBFS, while the spessasynth chain peaks
// around -4 to -6 dBFS once the limiter and bus trim are in play — so a raw
// 1:1 mapping (slider 100 → el.volume 1.0) makes the backing track *much*
// louder than the synth even at low slider positions. Capping the slider's
// top end at AUDIO_MAX_GAIN (0.25 ≈ -12 dB) brings the audio's max into the
// same loudness ballpark as a piano chord, so the user can compare playing
// vs. recording without the track drowning them out. Adjust here if your
// uploads tend to be quieter or hotter.
const AUDIO_MAX_GAIN = 0.25;

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
	// Track the element via state, not just useRef, so effects that need to
	// react to the audio actually attaching can depend on it. With a plain
	// ref, the volume effect runs once at mount when `audioRef.current` is
	// still null (the audio element hasn't been rendered yet because the
	// signed URL is still being fetched), then never runs again because
	// `volume` / `enabled` haven't changed — leaving the element at the
	// browser default of 1.0 until the user touches the slider.
	const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
	const audioRef = useCallback((el: HTMLAudioElement | null) => {
		setAudioEl(el);
	}, []);

	// Reset the playhead whenever the source URL changes — a fresh signed URL
	// for the same upload would otherwise leak the previous offset in.
	useEffect(() => {
		if (!audioEl) return;
		audioEl.currentTime = 0;
	}, [audioEl, url]);

	// Volume / mute. The slider's 0..100 range is mapped *linearly* into
	// 0..AUDIO_MAX_GAIN — that ceiling, rather than the raw 1.0 the audio
	// element allows, is what keeps the backing track at the same perceived
	// loudness as the synth chain at full volume. Mute is a separate channel
	// from volume so flipping it doesn't blow away the user's slider position.
	// `audioEl` in the deps guarantees we apply the values the instant the
	// element mounts, not at the next slider movement.
	useEffect(() => {
		if (!audioEl) return;
		const slider = Math.max(0, Math.min(1, volume / 100));
		audioEl.volume = slider * AUDIO_MAX_GAIN;
		audioEl.muted = !enabled;
	}, [audioEl, volume, enabled]);

	// Playback rate. Browsers support 0.25–4× without pitch correction; the
	// practice presets stay well within that.
	useEffect(() => {
		if (!audioEl) return;
		audioEl.playbackRate = speed;
	}, [audioEl, speed]);

	// Main sync effect. Re-runs whenever the practice state shifts (play/pause,
	// seek, source change, lead-in tick). Inside, we:
	//   1. Keep audio paused while currentTime < 0 (we're still in the
	//      countdown — there's no song-time to align with yet).
	//   2. Resync audio.currentTime when it drifts past tolerance.
	//   3. Mirror play/pause.
	useEffect(() => {
		if (!audioEl || !url) return;

		if (currentTime < 0) {
			if (!audioEl.paused) audioEl.pause();
			if (audioEl.currentTime !== 0) audioEl.currentTime = 0;
			return;
		}

		const target = Math.max(0, currentTime);
		if (Math.abs(audioEl.currentTime - target) > DRIFT_TOLERANCE_SECONDS) {
			audioEl.currentTime = target;
		}

		if (playing) {
			// `play()` returns a promise that rejects if the user hasn't
			// interacted yet (autoplay policy). The practice player only ever
			// reaches `playing=true` after a click, so the rejection path is
			// effectively unreachable — but we still swallow it so it doesn't
			// surface as an "Uncaught (in promise)" warning in dev.
			if (audioEl.paused) void audioEl.play().catch(() => {});
		} else {
			if (!audioEl.paused) audioEl.pause();
		}
	}, [audioEl, url, currentTime, playing]);

	// On unmount, stop the audio so it doesn't keep playing after navigating
	// away from the practice page.
	useEffect(() => {
		return () => {
			if (audioEl && !audioEl.paused) audioEl.pause();
		};
	}, [audioEl]);

	return audioRef;
}
