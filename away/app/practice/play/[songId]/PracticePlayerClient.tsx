"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { Navigation } from "@/components/layout/Navigation";
import { Piano } from "@/components/multiplayer/Piano";
import { ChordDisplay } from "@/components/layout/ChordDisplay";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useRecording } from "@/hooks/useRecording";
import { createClient } from "@/lib/supabase/client";
import { FallingNotes } from "@/components/practice/FallingNotes";
import { PlayerHud } from "@/components/practice/PlayerHud";
import { PracticeSideControls } from "@/components/practice/PracticeSideControls";
import { parseMidi, type ParsedMidi, type ParsedNote } from "@/lib/practice/midiParser";
import { buildChords, chordIndexForTime, type Chord } from "@/lib/practice/chords";
import { buildHandAssignment, type Hand } from "@/lib/practice/hands";
import type { BuiltInSong } from "@/lib/practice/songs";
import { downloadUploadedMidi, getUploadedSongMeta, isUploadId } from "@/lib/practice/uploads";

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
const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5];

const HAND_COLORS: Record<Hand, string> = {
	right: "#c75151",
	left: "#5571a8",
};

const EMPTY_SET: ReadonlySet<number> = new Set();

export default function PracticePlayerClient({ songId, initialBuiltIn }: PracticePlayerClientProps) {
	const router = useRouter();
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
	const { state: recordingState, countdown: recordingCountdown, startRecording, stopRecording } = useRecording(userId);

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
	const [midi, setMidi] = useState<ParsedMidi | null>(null);
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
	const [currentTime, setCurrentTime] = useState(0);

	const [waitingChord, setWaitingChord] = useState<Chord | null>(null);
	const [hitMidis, setHitMidis] = useState<ReadonlySet<number>>(EMPTY_SET);

	const playingRef = useRef(false);
	const speedRef = useRef(speed);
	const autoPauseRef = useRef(autoPause);
	const playheadRef = useRef(0);
	const lastFrameRef = useRef(0);
	const nextNoteIndexRef = useRef(0);
	const chordIndexRef = useRef(0);
	const waitingChordRef = useRef<Chord | null>(null);
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
		let cancelled = false;
		setLoadState("loading");
		setError(null);

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
				setLoadState("ready");
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
	}, [songId, initialBuiltIn]);

	const chords = useMemo<Chord[]>(() => (midi ? buildChords(midi.notes) : []), [midi]);

	const handForNote = useMemo(() => {
		if (!midi) return () => "right" as Hand;
		return buildHandAssignment(midi);
	}, [midi]);

	const totalDuration = midi?.durationSeconds ?? 0;

	const releaseAllAuto = useCallback(() => {
		activeAutoNotesRef.current.forEach((_releaseTime, midiNote) => {
			stopNote(midiNote, "practice-auto");
		});
		activeAutoNotesRef.current.clear();
	}, [stopNote]);

	const clearGate = useCallback(() => {
		waitingChordRef.current = null;
		setWaitingChord(null);
		hitMidisRef.current = new Set();
		setHitMidis(EMPTY_SET);
	}, []);

	const resetToTime = useCallback(
		(toSeconds: number) => {
			const clamped = Math.max(0, Math.min(totalDuration || 0, toSeconds));
			playheadRef.current = clamped;
			setCurrentTime(clamped);
			if (midi) {
				let lo = 0;
				let hi = midi.notes.length;
				while (lo < hi) {
					const mid = (lo + hi) >>> 1;
					if (midi.notes[mid].startSeconds < clamped) lo = mid + 1;
					else hi = mid;
				}
				nextNoteIndexRef.current = lo;
			}
			chordIndexRef.current = chordIndexForTime(chords, clamped);
			clearGate();
			releaseAllAuto();
		},
		[chords, clearGate, midi, releaseAllAuto, totalDuration],
	);

	useEffect(() => {
		if (!midi) return;
		resetToTime(0);
	}, [midi, resetToTime]);

	useEffect(() => {
		if (!midi) return;
		clearGate();
		releaseAllAuto();
		chordIndexRef.current = chordIndexForTime(chords, playheadRef.current);
		nextNoteIndexRef.current = (() => {
			let lo = 0;
			let hi = midi.notes.length;
			const t = playheadRef.current;
			while (lo < hi) {
				const mid = (lo + hi) >>> 1;
				if (midi.notes[mid].startSeconds < t) lo = mid + 1;
				else hi = mid;
			}
			return lo;
		})();
	}, [autoPause, chords, clearGate, midi, releaseAllAuto]);

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
				releaseAllAuto();
				return;
			}

			if (autoPauseRef.current) {
				const cIdx = chordIndexRef.current;
				if (cIdx < chords.length) {
					const nextChord = chords[cIdx];
					if (t >= nextChord.startSeconds) {
						playheadRef.current = nextChord.startSeconds;
						t = nextChord.startSeconds;
						waitingChordRef.current = nextChord;
						setWaitingChord(nextChord);
						hitMidisRef.current = new Set();
						setHitMidis(EMPTY_SET);
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
	}, [midi, chords, handForNote, playNote, stopNote, releaseAllAuto, totalDuration]);

	const handleUserNote = useCallback((m: number) => {
		if (!autoPauseRef.current) return;
		const waiting = waitingChordRef.current;
		if (!waiting) return;
		if (!waiting.midis.includes(m)) return;
		if (hitMidisRef.current.has(m)) return;

		const nextHit = new Set(hitMidisRef.current);
		nextHit.add(m);
		hitMidisRef.current = nextHit;
		setHitMidis(nextHit);

		if (nextHit.size >= waiting.midis.length) {
			chordIndexRef.current += 1;
			waitingChordRef.current = null;
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
		setPlaying((p) => {
			const next = !p;
			if (!next) releaseAllAuto();
			return next;
		});
	}, [unlockAudio, releaseAllAuto]);

	const handleRestart = useCallback(() => {
		setPlaying(false);
		resetToTime(0);
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

	const gateMidis = useMemo<ReadonlySet<number>>(
		() => (waitingChord ? new Set(waitingChord.midis) : EMPTY_SET),
		[waitingChord],
	);

	const title = descriptor.artist
		? `${descriptor.title} - ${descriptor.artist}`
		: descriptor.subcategoryLabel
			? `${descriptor.title} - ${descriptor.subcategoryLabel}`
			: descriptor.title;

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
			/>

			<PracticeSideControls
				onSelectSong={() => router.push("/practice")}
				autoPause={autoPause}
				onToggleAutoPause={() => setAutoPause((v) => !v)}
				speed={speed}
				onCycleSpeed={handleCycleSpeed}
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
		</div>
	);
}
