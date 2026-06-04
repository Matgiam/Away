"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { Navigation } from "@/components/layout/Navigation";
import { Piano } from "@/components/multiplayer/Piano";
import { ChordDisplay } from "@/components/layout/ChordDisplay";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useRecording } from "@/hooks/useRecording";
import { RecordingSignInModal } from "@/components/layout/RecordingSignInModal";
import { createClient } from "@/lib/supabase/client";
import { FallingNotes } from "@/components/practice/FallingNotes";
import { PlayerHud } from "@/components/practice/PlayerHud";
import { buildPracticeControls } from "@/components/practice/PracticeSideControls";
import { parseMidi, type ParsedMidi, type ParsedNote } from "@/lib/practice/midiParser";
import { buildChords, chordIndexForTime, type Chord } from "@/lib/practice/chords";
import { buildHandAssignment, type Hand } from "@/lib/practice/hands";
import type { BuiltInSong } from "@/lib/practice/songs";
import { downloadUploadedMidi, getUploadedAudioSignedUrl, getUploadedSongMeta, isUploadId } from "@/lib/practice/uploads";
import { useAudioTrack } from "@/hooks/useAudioTrack";
import { AudioTrackControl, usePersistedAudioPrefs } from "@/components/practice/AudioTrackControl";
import {
	downloadCommunityMidi,
	getCommunityAudioPublicUrl,
	getCommunityMidi,
	incrementCommunityPlayCount,
	isCommunityId,
} from "@/lib/practice/community";
import { markSongCompleted, checkAndUnlockAchievements } from "@/lib/achievements";

type LoadState = "loading" | "ready" | "error";

type SongDescriptor = {
	title: string;
	artist: string | null;
	subcategoryLabel: string | null;
};

interface PracticePlayerClientProps {
	songId: string;
	initialBuiltIn: BuiltInSong | null;
}

const LOOK_AHEAD_SECONDS = 3;
// Notes spawn at the top of the canvas and fall for this long before the song's first
// note hits t=0. Matching LOOK_AHEAD means a note at startSeconds=0 enters at the very top.
const LEAD_IN_SECONDS = 3;
const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5];

const HAND_COLORS: Record<Hand, string> = {
	right: "#c75151",
	left: "#5571a8",
};

const EMPTY_SET: ReadonlySet<number> = new Set();

export default function PracticePlayerClient({ songId, initialBuiltIn }: PracticePlayerClientProps) {
	const router = useAppRouter();
	const {
		pianoKeys,
		playNote,
		stopNote,
		unlockAudio,
		connectMIDI,
		midiDevices,
		midiError,
		soundfonts,
		currentSoundfont,
		loadedSoundfonts,
		loadingSoundfont,
		selectSoundfont,
		masterVolume,
		setMasterVolume,
		noteColor,
		setNoteColor,
		setSustain,
		setPeerSustain,
		keyboardInputEnabled,
		setKeyboardInputEnabled,
		keybinds,
		setKeybinds,
		keybindBaseMidi,
		setKeybindBaseMidi,
		keybindPreset,
		setKeybindPreset,
		settings,
		updateSetting,
		resetSettings,
		localHeldMidis,
	} = useAudioEngineContext();

	const [userId, setUserId] = useState<string | null>(null);
	const [username, setUsername] = useState("");
	const { state: recordingState, countdown: recordingCountdown, startRecording, stopRecording, needsLogin: recordingNeedsLogin, dismissLoginPrompt: dismissRecordingLogin } = useRecording(userId);

	// Force note labels on while practicing — useful learning aid here. The chord
	// recognizer stays at the user's setting (it can be distracting while playing
	// a song). Restore previous value when leaving.
	useEffect(() => {
		const prevShowNoteLabels = settings.showNoteLabels;
		updateSetting("showNoteLabels", true);
		return () => {
			updateSetting("showNoteLabels", prevShowNoteLabels);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const load = async () => {
			const supabase = createClient();
			const { data } = await supabase.auth.getUser();
			if (!data.user) return;
			setUserId(data.user.id);
			const { data: profile } = await supabase
				.from("profiles")
				.select("username")
				.eq("id", data.user.id)
				.maybeSingle();
			setUsername(
				profile?.username ||
					(data.user.user_metadata?.username as string | undefined) ||
					data.user.email?.split("@")[0] ||
					data.user.id.substring(0, 8),
			);
		};
		load();
	}, []);

	const [loadState, setLoadState] = useState<LoadState>("loading");
	const [error, setError] = useState<string | null>(null);
	// Signed URL of the source audio. Only set when this song is an upload
	// that was created via audio→MIDI transcription AND the user opted to keep
	// the source. Null disables the sync-playback control entirely.
	const [audioUrl, setAudioUrl] = useState<string | null>(null);

	const [midi, setMidi] = useState<ParsedMidi | null>(null);
	// We keep the raw MIDI bytes around so the "Export MIDI" button in the HUD
	// can save the original file without re-downloading. Small (a few hundred KB
	// at worst) and only one is held at a time.
	const [midiBuffer, setMidiBuffer] = useState<ArrayBuffer | null>(null);
	const [descriptor, setDescriptor] = useState<SongDescriptor>(() =>
		initialBuiltIn
			? {
					title: initialBuiltIn.title,
					artist: initialBuiltIn.artist,
					subcategoryLabel: initialBuiltIn.subcategoryLabel,
				}
			: { title: "Loading…", artist: null, subcategoryLabel: null },
	);

	const [playing, setPlaying] = useState(true);
	const [speed, setSpeed] = useState(1.0);
	const [autoPause, setAutoPause] = useState(false);
	const [practiceHand, setPracticeHand] = useState<"both" | "left" | "right">("both");
	const [currentTime, setCurrentTime] = useState(-LEAD_IN_SECONDS);

	const [waitingChord, setWaitingChord] = useState<Chord | null>(null);
	const [hitMidis, setHitMidis] = useState<ReadonlySet<number>>(EMPTY_SET);

	const playingRef = useRef(false);
	const speedRef = useRef(speed);
	const autoPauseRef = useRef(autoPause);
	const practiceHandRef = useRef(practiceHand);
	const playheadRef = useRef(-LEAD_IN_SECONDS);
	const lastFrameRef = useRef(0);
	const nextNoteIndexRef = useRef(0);
	const nextPedalIndexRef = useRef(0);
	// MIDI channels currently holding their pedal down. The auto-play synth's
	// pedal is on iff this set is non-empty, so multi-track files where left
	// and right hands have independent pedal events behave correctly.
	const heldPedalChannelsRef = useRef<Set<number>>(new Set());
	const autoSustainOnRef = useRef(false);
	const chordIndexRef = useRef(0);
	const waitingChordRef = useRef<Chord | null>(null);
	const gateMidisRef = useRef<number[]>([]);
	const hitMidisRef = useRef<Set<number>>(new Set());
	const activeAutoNotesRef = useRef<Map<number, number>>(new Map());

	useEffect(() => {
		playingRef.current = playing;
	}, [playing]);
	useEffect(() => {
		speedRef.current = speed;
	}, [speed]);
	useEffect(() => {
		autoPauseRef.current = autoPause;
	}, [autoPause]);
	useEffect(() => {
		practiceHandRef.current = practiceHand;
	}, [practiceHand]);

	useEffect(() => {
		let cancelled = false;
		setLoadState("loading");
		setError(null);
		setAudioUrl(null);

		const load = async () => {
			try {
				let buffer: ArrayBuffer;
				if (isUploadId(songId)) {
					const meta = await getUploadedSongMeta(songId);
					if (!meta) throw new Error("Upload not found or you don't have access to it.");
					if (cancelled) return;
					setDescriptor({
						title: meta.title,
						artist: meta.artist || null,
						subcategoryLabel: null,
					});
					buffer = await downloadUploadedMidi(meta.storagePath);
					if (cancelled) return;
					// Best-effort signed URL for the source audio. A failure here just
					// hides the sync control — the MIDI still plays normally.
					if (meta.audioStoragePath) {
						getUploadedAudioSignedUrl(meta.audioStoragePath)
							.then((url) => {
								if (!cancelled) setAudioUrl(url);
							})
							.catch(() => {});
					}
				} else if (isCommunityId(songId)) {
					const meta = await getCommunityMidi(songId);
					if (!meta) throw new Error("This community MIDI was not found or has not been approved.");
					if (cancelled) return;
					setDescriptor({
						title: meta.title,
						artist: meta.artist || null,
						subcategoryLabel: meta.submitterUsername ? `by ${meta.submitterUsername}` : null,
					});
					buffer = await downloadCommunityMidi(meta.storagePath);
					if (cancelled) return;
					// Community bucket is public, so we use the CDN URL directly.
					if (meta.audioStoragePath) {
						const url = getCommunityAudioPublicUrl(meta.audioStoragePath);
						if (!cancelled) setAudioUrl(url);
					}
					// Best-effort play_count bump. Fire-and-forget so the user can practice
					// even if the RPC is unreachable.
					incrementCommunityPlayCount(songId).catch(() => {});
				} else {
					if (!initialBuiltIn) throw new Error("Song unavailable");
					const res = await fetch(initialBuiltIn.filePath);
					if (!res.ok) throw new Error(`Failed to load MIDI (${res.status})`);
					buffer = await res.arrayBuffer();
					if (cancelled) return;
				}
				const parsed = parseMidi(buffer);
				if (cancelled) return;
				setMidi(parsed);
				setMidiBuffer(buffer);
				setLoadState("ready");
				unlockAudio();
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : String(err));
				setLoadState("error");
			}
		};

		load();

		return () => {
			cancelled = true;
		};
	}, [songId, initialBuiltIn, unlockAudio]);

	const chords = useMemo<Chord[]>(() => (midi ? buildChords(midi.notes) : []), [midi]);

	const handForNote = useMemo(() => {
		if (!midi) return () => "right" as Hand;
		return buildHandAssignment(midi);
	}, [midi]);

	const totalDuration = midi?.durationSeconds ?? 0;

	const releaseAutoPedal = useCallback(() => {
		heldPedalChannelsRef.current.clear();
		if (autoSustainOnRef.current) {
			autoSustainOnRef.current = false;
			setPeerSustain("practice-auto", false);
		}
	}, [setPeerSustain]);

	const releaseAllAuto = useCallback(() => {
		activeAutoNotesRef.current.forEach((_releaseTime, midiNote) => {
			stopNote(midiNote, "practice-auto");
		});
		activeAutoNotesRef.current.clear();
		releaseAutoPedal();
	}, [stopNote, releaseAutoPedal]);

	const clearGate = useCallback(() => {
		waitingChordRef.current = null;
		gateMidisRef.current = [];
		setWaitingChord(null);
		hitMidisRef.current = new Set();
		setHitMidis(EMPTY_SET);
	}, []);

	const resetToTime = useCallback(
		(toSeconds: number) => {
			const clamped = Math.max(-LEAD_IN_SECONDS, Math.min(totalDuration || 0, toSeconds));
			playheadRef.current = clamped;
			setCurrentTime(clamped);
			// releaseAllAuto also wipes pedal state, so do it before we replay
			// pedal history below — otherwise we'd clear the very state we're
			// reconstructing.
			clearGate();
			releaseAllAuto();
			if (midi) {
				let lo = 0;
				let hi = midi.notes.length;
				while (lo < hi) {
					const mid = (lo + hi) >>> 1;
					if (midi.notes[mid].startSeconds < clamped) lo = mid + 1;
					else hi = mid;
				}
				nextNoteIndexRef.current = lo;

				// Replay pedal history so seeking into the middle of a held pedal
				// section restores the correct pedal state. The auto-play channel
				// may not exist yet — the tick loop will push the resolved state
				// to the engine on its first iteration.
				let pedalIdx = 0;
				while (pedalIdx < midi.pedalEvents.length) {
					const ev = midi.pedalEvents[pedalIdx];
					if (ev.timeSeconds > clamped) break;
					if (ev.on) heldPedalChannelsRef.current.add(ev.channel);
					else heldPedalChannelsRef.current.delete(ev.channel);
					pedalIdx++;
				}
				nextPedalIndexRef.current = pedalIdx;
			}
			chordIndexRef.current = chordIndexForTime(chords, clamped);
		},
		[chords, clearGate, midi, releaseAllAuto, totalDuration],
	);

	useEffect(() => {
		if (!midi) return;
		resetToTime(-LEAD_IN_SECONDS);
	}, [midi, resetToTime]);

	useEffect(() => {
		if (!midi) return;
		clearGate();
		releaseAllAuto();
		chordIndexRef.current = chordIndexForTime(chords, playheadRef.current);
		const t = playheadRef.current;
		nextNoteIndexRef.current = (() => {
			let lo = 0;
			let hi = midi.notes.length;
			while (lo < hi) {
				const mid = (lo + hi) >>> 1;
				if (midi.notes[mid].startSeconds < t) lo = mid + 1;
				else hi = mid;
			}
			return lo;
		})();
		let pedalIdx = 0;
		while (pedalIdx < midi.pedalEvents.length) {
			const ev = midi.pedalEvents[pedalIdx];
			if (ev.timeSeconds > t) break;
			if (ev.on) heldPedalChannelsRef.current.add(ev.channel);
			else heldPedalChannelsRef.current.delete(ev.channel);
			pedalIdx++;
		}
		nextPedalIndexRef.current = pedalIdx;
	}, [autoPause, practiceHand, chords, clearGate, midi, releaseAllAuto]);

	useEffect(() => {
		if (!midi) return;
		let frameId = 0;

		const tick = (now: number) => {
			frameId = requestAnimationFrame(tick);

			const last = lastFrameRef.current || now;
			const dt = (now - last) / 1000;
			lastFrameRef.current = now;

			if (!playingRef.current) return;
			if (autoPauseRef.current && waitingChordRef.current) return;

			playheadRef.current += dt * speedRef.current;
			let t = playheadRef.current;

			if (t >= totalDuration) {
				playingRef.current = false;
				setPlaying(false);
				// Snap to the exact end so the UI can derive "finished" cleanly
				// (and the play button can swap to the replay icon). The early
				// return below would otherwise skip the setCurrentTime call at
				// the end of tick and leave currentTime one frame short.
				playheadRef.current = totalDuration;
				setCurrentTime(totalDuration);
				releaseAllAuto();
				markSongCompleted(songId);
				checkAndUnlockAchievements();
				return;
			}

			if (autoPauseRef.current) {
				const handFilter = practiceHandRef.current;
				const cIdx = chordIndexRef.current;
				if (cIdx < chords.length) {
					const nextChord = chords[cIdx];
					if (t >= nextChord.startSeconds) {
						// Split the chord by hand so we only gate on the user's hand.
						const userHandNotes =
							handFilter === "both"
								? nextChord.notes
								: nextChord.notes.filter((n) => handForNote(n) === handFilter);
						const otherHandNotes =
							handFilter === "both"
								? []
								: nextChord.notes.filter((n) => handForNote(n) !== handFilter);

						if (userHandNotes.length === 0) {
							// No notes from the user's hand — auto-play the entire chord and skip the gate
							for (const note of nextChord.notes) {
								if (activeAutoNotesRef.current.has(note.midi)) {
									stopNote(note.midi, "practice-auto");
									activeAutoNotesRef.current.delete(note.midi);
								}
								const hand = handForNote(note);
								playNote(note.midi, note.velocity, "practice-auto", undefined, HAND_COLORS[hand]);
								activeAutoNotesRef.current.set(
									note.midi,
									note.startSeconds + note.durationSeconds,
								);
							}
							chordIndexRef.current += 1;
							// Advance the next-note pointer past this chord so the open branch
							// (when auto-pause is later turned off) doesn't replay these.
							while (
								nextNoteIndexRef.current < midi.notes.length &&
								midi.notes[nextNoteIndexRef.current].startSeconds <= nextChord.startSeconds + 0.001
							) {
								nextNoteIndexRef.current++;
							}
						} else {
							// Auto-play the other-hand notes right now, gate on the user's hand
							for (const note of otherHandNotes) {
								if (activeAutoNotesRef.current.has(note.midi)) {
									stopNote(note.midi, "practice-auto");
									activeAutoNotesRef.current.delete(note.midi);
								}
								const hand = handForNote(note);
								playNote(note.midi, note.velocity, "practice-auto", undefined, HAND_COLORS[hand]);
								activeAutoNotesRef.current.set(
									note.midi,
									note.startSeconds + note.durationSeconds,
								);
							}
							playheadRef.current = nextChord.startSeconds;
							t = nextChord.startSeconds;
							waitingChordRef.current = nextChord;
							gateMidisRef.current = userHandNotes.map((n) => n.midi);
							setWaitingChord(nextChord);
							hitMidisRef.current = new Set();
							setHitMidis(EMPTY_SET);
						}
					}
				}
			} else {
				const notes = midi.notes;
				while (nextNoteIndexRef.current < notes.length) {
					const note = notes[nextNoteIndexRef.current];
					if (note.startSeconds > t) break;
					nextNoteIndexRef.current++;
					const hand = handForNote(note);
					if (activeAutoNotesRef.current.has(note.midi)) {
						stopNote(note.midi, "practice-auto");
						activeAutoNotesRef.current.delete(note.midi);
					}
					playNote(note.midi, note.velocity, "practice-auto", undefined, HAND_COLORS[hand]);
					activeAutoNotesRef.current.set(note.midi, note.startSeconds + note.durationSeconds);
				}
				activeAutoNotesRef.current.forEach((release, m) => {
					if (release <= t) {
						stopNote(m, "practice-auto");
						activeAutoNotesRef.current.delete(m);
					}
				});
			}

			const pedals = midi.pedalEvents;
			while (nextPedalIndexRef.current < pedals.length) {
				const ev = pedals[nextPedalIndexRef.current];
				if (ev.timeSeconds > t) break;
				nextPedalIndexRef.current++;
				if (ev.on) heldPedalChannelsRef.current.add(ev.channel);
				else heldPedalChannelsRef.current.delete(ev.channel);
			}
			const wantSustain = heldPedalChannelsRef.current.size > 0;
			if (wantSustain !== autoSustainOnRef.current) {
				autoSustainOnRef.current = wantSustain;
				setPeerSustain("practice-auto", wantSustain);
			}

			setCurrentTime(t);
		};

		frameId = requestAnimationFrame((ts) => {
			lastFrameRef.current = ts;
			tick(ts);
		});

		return () => {
			cancelAnimationFrame(frameId);
			lastFrameRef.current = 0;
		};
	}, [midi, chords, handForNote, playNote, stopNote, releaseAllAuto, totalDuration, songId, setPeerSustain]);

	const handleUserNote = useCallback((m: number) => {
		if (!autoPauseRef.current) return;
		const waiting = waitingChordRef.current;
		if (!waiting) return;
		const gateMidis = gateMidisRef.current;
		if (!gateMidis.includes(m)) return;
		if (hitMidisRef.current.has(m)) return;

		const nextHit = new Set(hitMidisRef.current);
		nextHit.add(m);
		hitMidisRef.current = nextHit;
		setHitMidis(nextHit);

		if (nextHit.size >= gateMidis.length) {
			chordIndexRef.current += 1;
			waitingChordRef.current = null;
			gateMidisRef.current = [];
			setWaitingChord(null);
			hitMidisRef.current = new Set();
			setHitMidis(EMPTY_SET);
		}
	}, []);

	const handleUserNoteRef = useRef(handleUserNote);
	useEffect(() => {
		handleUserNoteRef.current = handleUserNote;
	}, [handleUserNote]);

	useEffect(() => {
		connectMIDI(
			(note, vel) => {
				handleUserNoteRef.current(note);
				playNote(note, vel, "self");
			},
			(note) => stopNote(note, "self"),
		);
		return () => {
			connectMIDI();
		};
	}, [connectMIDI, playNote, stopNote]);

	useKeyboardInput({
		enabled: keyboardInputEnabled,
		keybinds,
		baseMidi: keybindBaseMidi,
		onPlay: (m, v) => {
			handleUserNoteRef.current(m);
			playNote(m, v, "self");
		},
		onStop: (m) => stopNote(m, "self"),
		onOctaveShift: (delta) => setKeybindBaseMidi(keybindBaseMidi + delta),
		onSustainChange: setSustain,
		onAnyKey: unlockAudio,
	});

	const handlePlayPause = useCallback(async () => {
		await unlockAudio();
		// Replay branch: the song has finished. Rewind to the lead-in so the
		// notes fall in from the top again, then start playing. We check the
		// ref (not state) because handlePlayPause may be fired from a
		// keyboard handler whose closure captured stale `playing`.
		if (
			!playingRef.current &&
			totalDuration > 0 &&
			playheadRef.current >= totalDuration - 0.01
		) {
			resetToTime(-LEAD_IN_SECONDS);
			playingRef.current = true;
			setPlaying(true);
			return;
		}
		setPlaying((p) => {
			const next = !p;
			if (!next) releaseAllAuto();
			return next;
		});
	}, [unlockAudio, releaseAllAuto, resetToTime, totalDuration]);

	const handleRestart = useCallback(() => {
		setPlaying(false);
		resetToTime(-LEAD_IN_SECONDS);
	}, [resetToTime]);

	const handleSeek = useCallback(
		(seconds: number) => {
			resetToTime(seconds);
		},
		[resetToTime],
	);

	const handleCycleSpeed = useCallback(() => {
		setSpeed((current) => {
			const idx = SPEED_PRESETS.findIndex((s) => Math.abs(s - current) < 0.001);
			return SPEED_PRESETS[(idx + 1) % SPEED_PRESETS.length];
		});
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
			if (e.code === "Space") {
				e.preventDefault();
				handlePlayPause();
			} else if (e.key === "ArrowRight") {
				handleSeek(playheadRef.current + 5);
			} else if (e.key === "ArrowLeft") {
				handleSeek(playheadRef.current - 5);
			} else if (e.key === "r" || e.key === "R") {
				handleRestart();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [handlePlayPause, handleSeek, handleRestart]);

	useEffect(() => {
		return () => releaseAllAuto();
	}, [releaseAllAuto]);

	// Pause the song when the user switches tabs. Without this, requestAnimationFrame
	// gets throttled or suspended in background tabs — the playhead "catches up"
	// when the tab becomes visible again, fast-forwarding through every note the
	// user missed. Pausing on hide keeps the position exactly where they left it.
	useEffect(() => {
		if (typeof document === "undefined") return;
		const onVisibility = () => {
			if (!document.hidden) {
				// Coming back. Reset the tick baseline so the first tick after
				// resume doesn't compute a multi-minute dt from the stale ref.
				lastFrameRef.current = 0;
				return;
			}
			if (!playingRef.current) return;
			playingRef.current = false;
			setPlaying(false);
			releaseAllAuto();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => document.removeEventListener("visibilitychange", onVisibility);
	}, [releaseAllAuto]);

	const handleNoteFromPiano = useCallback(
		(m: number, vel: number) => {
			unlockAudio();
			playNote(m, vel, "self");
			handleUserNoteRef.current(m);
		},
		[playNote, unlockAudio],
	);

	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	const visibleNotes = useMemo<ParsedNote[]>(() => {
		if (!midi) return [];
		const t = currentTime;
		const horizon = t + LOOK_AHEAD_SECONDS;
		return midi.notes.filter((n) => {
			const end = n.startSeconds + n.durationSeconds;
			if (end < t - 0.2) return false;
			if (n.startSeconds > horizon) return false;
			return true;
		});
	}, [midi, currentTime]);

	const gateMidis = useMemo<ReadonlySet<number>>(() => {
		if (!waitingChord) return EMPTY_SET;
		if (practiceHand === "both") return new Set(waitingChord.midis);
		return new Set(
			waitingChord.notes.filter((n) => handForNote(n) === practiceHand).map((n) => n.midi),
		);
	}, [waitingChord, practiceHand, handForNote]);

	// MIDI notes currently sounding in the song (auto-played by the backing track).
	// Recomputed every frame off currentTime — the intermediate `key` keeps the array
	// reference stable across frames where the set of sounding notes is unchanged, so
	// ChordDisplay doesn't re-recognize / re-render on every tick.
	const songActiveMidisKey = useMemo<string>(() => {
		if (!midi || currentTime < 0) return "";
		let result = "";
		for (const n of midi.notes) {
			if (n.startSeconds > currentTime) break;
			if (n.startSeconds + n.durationSeconds > currentTime) {
				result += (result ? "," : "") + n.midi;
			}
		}
		return result;
	}, [midi, currentTime]);

	const songActiveMidis = useMemo<number[]>(() => {
		if (!songActiveMidisKey) return [];
		return songActiveMidisKey.split(",").map(Number);
	}, [songActiveMidisKey]);

	const title = descriptor.artist
		? `${descriptor.title} - ${descriptor.artist}`
		: descriptor.subcategoryLabel
			? `${descriptor.title} - ${descriptor.subcategoryLabel}`
			: descriptor.title;

	// Sync the original audio (when present) to the MIDI playhead. Pref state
	// is persisted across sessions so the user's mute/volume choices stick.
	//
	// When the auto-pause gate engages (autoPause mode + waiting for the user
	// to play the next chord), the MIDI playhead freezes. We mirror that into
	// the audio by treating the gate-paused state as `playing: false`, so the
	// audio doesn't drift ahead while the user is figuring out the chord.
	const audioPrefs = usePersistedAudioPrefs();
	const audioAdvancing = playing && !(autoPause && waitingChord !== null);
	const audioRef = useAudioTrack({
		url: audioUrl,
		currentTime,
		playing: audioAdvancing,
		speed,
		enabled: audioPrefs.enabled,
		volume: audioPrefs.volume,
	});

	return (
		<div className="h-[var(--app-h,100dvh)] w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			<SilkBackground
				color={settings.backgroundColor}
				scale={1}
				noiseIntensity={1.3}
				speed={3}
				rotation={270}
				animated={backgroundAnimated}
			/>

			<Navigation
				onLogout={() => router.push("/practice")}
				onToggleRecord={recordingState === "recording" ? stopRecording : startRecording}
				recordingState={recordingState}
				recordingCountdown={recordingCountdown}
				midiDevices={midiDevices}
				midiError={midiError}
				onRetryMidi={() => connectMIDI()}
				soundfonts={soundfonts}
				currentSoundfont={currentSoundfont}
				loadedSoundfonts={loadedSoundfonts}
				loadingSoundfont={loadingSoundfont}
				onSelectSoundfont={selectSoundfont}
				masterVolume={masterVolume}
				onMasterVolumeChange={setMasterVolume}
				username={username}
				onUsernameChange={setUsername}
				noteColor={noteColor}
				onNoteColorChange={setNoteColor}
				keyboardInputEnabled={keyboardInputEnabled}
				onKeyboardInputEnabledChange={setKeyboardInputEnabled}
				keybinds={keybinds}
				onKeybindsChange={setKeybinds}
				keybindBaseMidi={keybindBaseMidi}
				onKeybindBaseMidiChange={setKeybindBaseMidi}
				keybindPreset={keybindPreset}
				onKeybindPresetChange={setKeybindPreset}
				settings={settings}
				updateSetting={updateSetting}
				onResetSettings={resetSettings}
				extraControls={buildPracticeControls({
					onSelectSong: () => router.push("/practice"),
					autoPause,
					onToggleAutoPause: () => setAutoPause((v) => !v),
					speed,
					onCycleSpeed: handleCycleSpeed,
					practiceHand,
					onPracticeHandChange: setPracticeHand,
				})}
			/>

			<PlayerHud
				title={title}
				currentTime={currentTime}
				totalDuration={totalDuration}
				onSeek={handleSeek}
				playing={playing}
				onPlayPause={handlePlayPause}
				loadState={loadState}
				error={error}
				canExport={!!midiBuffer}
				onExport={() => {
					if (!midiBuffer) return;
					const blob = new Blob([midiBuffer], { type: "audio/midi" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					// Build a safe-ish filename from the visible title.
					const stem = title.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "song";
					a.download = `${stem}.mid`;
					document.body.appendChild(a);
					a.click();
					a.remove();
					setTimeout(() => URL.revokeObjectURL(url), 1000);
				}}
			/>

			<div className="absolute inset-0 z-10 flex flex-col pb-[150px] pt-44">
				<div className="relative flex-1 min-h-0">
					<FallingNotes
						notes={visibleNotes}
						currentTime={currentTime}
						lookAheadSeconds={LOOK_AHEAD_SECONDS}
						handForNote={handForNote}
						colors={HAND_COLORS}
						gateMidis={gateMidis}
						hitMidis={hitMidis}
						gateStartTime={waitingChord?.startSeconds ?? null}
					/>
				</div>
			</div>

			<div className="fixed bottom-0 left-0 right-0 z-20">
				<Piano
					pianoKeys={pianoKeys}
					showKeys={true}
					onPlayNote={handleNoteFromPiano}
					onStopNote={stopNote}
					showNoteLabels={settings.showNoteLabels}
					keyAnimations={settings.keyAnimations}
				/>
			</div>

			<ChordDisplay heldMidis={localHeldMidis} enabled={settings.chordRecognizerEnabled} />
			<ChordDisplay
				heldMidis={songActiveMidis}
				enabled={settings.chordRecognizerEnabled}
				placement={1}
				label="song"
			/>

			{audioUrl && (
				<>
					<AudioTrackControl
						enabled={audioPrefs.enabled}
						onEnabledChange={audioPrefs.setEnabled}
						volume={audioPrefs.volume}
						onVolumeChange={audioPrefs.setVolume}
					/>
					{/* preload="auto" so the first play() doesn't stall on a long fetch. */}
					<audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />
				</>
			)}

			<RecordingSignInModal open={recordingNeedsLogin} onClose={dismissRecordingLogin} />
		</div>
	);
}
