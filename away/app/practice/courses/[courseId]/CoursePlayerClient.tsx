"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { Navigation } from "@/components/layout/Navigation";
import { Piano } from "@/components/multiplayer/Piano";
import { Visualizer } from "@/components/multiplayer/Visualizer";
import { ChordDisplay } from "@/components/layout/ChordDisplay";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useRecording } from "@/hooks/useRecording";
import { RecordingSignInModal } from "@/components/layout/RecordingSignInModal";
import { createClient } from "@/lib/supabase/client";
import { CourseStepCard } from "@/components/courses/CourseStepCard";
import { buildCourseControls } from "@/components/courses/CourseSideControls";
import { CourseFallingNotes, type LaneItem } from "@/components/courses/CourseFallingNotes";
import { CourseDemoStage, buildSyntheticDemoNotes } from "@/components/courses/CourseDemoStage";
import { FinishScreen, summaryFromSteps } from "@/components/courses/FinishScreen";
import { ImprovisationStage } from "@/components/courses/ImprovisationStage";
import { EarTrainingStage } from "@/components/courses/EarTrainingStage";
import { midiToLetter } from "@/lib/courses/music";
import { markCourseCompleted, checkAndUnlockAchievements } from "@/lib/achievements";
import type { ParsedNote } from "@/lib/practice/midiParser";
import type { Course, CourseStep } from "@/lib/courses/types";

const COLOR_PRIMARY = "#c75ad6";
const COLOR_PLAYED = "#5571a8";

// Returns the metronome tempo a step prefers, or null if it doesn't suggest one.
// For improvisation steps `beatsPerChord` doubles as the metronome's beats-per-bar.
function stepTempo(step: CourseStep | undefined): { bpm: number; beatsPerBar: number } | null {
	if (!step) return null;
	if (step.bpm === undefined) return null;
	let beatsPerBar = step.beatsPerBar ?? 4;
	if (step.type === "improvisation" && step.beatsPerBar === undefined) {
		beatsPerBar = step.beatsPerChord;
	}
	return { bpm: step.bpm, beatsPerBar };
}

// True when a step has an auto-demo phase before the user takes over.
function stepNeedsDemo(step: CourseStep | undefined): boolean {
	if (!step) return false;
	switch (step.type) {
		case "play-note":
		case "play-chord":
		case "play-sequence":
		case "play-any-of":
		case "demo-sequence":
			return true;
		default:
			return false;
	}
}

// Derive demo notes from a step. Returns null when no demo should auto-play.
function deriveDemo(step: CourseStep): Array<number | number[]> | null {
	if (step.skipAutoDemo) return null;
	if (step.demoNotes) return step.demoNotes;
	switch (step.type) {
		case "play-note":
			return [step.midi];
		case "play-chord":
			return [step.midis];
		case "play-sequence":
			return step.sequence;
		case "play-any-of": {
			// For 'any of' we pick one note near the middle of the allowed range as a representative example.
			if (step.allowedMidis.length === 0) return null;
			const mid = step.allowedMidis[Math.floor(step.allowedMidis.length / 2)];
			return [mid];
		}
		default:
			return null;
	}
}

interface CoursePlayerClientProps {
	course: Course;
}

type StepState = {
	completed: boolean;
	// For sequences: how far into the sequence the user has gotten
	sequenceCursor: number;
	// For "any of" steps: which midis have been pressed
	hitMidis: Set<number>;
	// For chord steps: which midis from the required set are currently held
	chordHits: Set<number>;
	// For demo: whether the demo has played at least once
	demoPlayed: boolean;
};

function freshStepState(): StepState {
	return {
		completed: false,
		sequenceCursor: 0,
		hitMidis: new Set(),
		chordHits: new Set(),
		demoPlayed: false,
	};
}

function chordSlot(item: number | number[]): number[] {
	return Array.isArray(item) ? item : [item];
}

export default function CoursePlayerClient({ course }: CoursePlayerClientProps) {
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
		noteLines,
	} = useAudioEngineContext();

	const [userId, setUserId] = useState<string | null>(null);
	const [username, setUsername] = useState("");
	const {
		state: recordingState,
		countdown: recordingCountdown,
		startRecording,
		stopRecording,
		needsLogin: recordingNeedsLogin,
		dismissLoginPrompt: dismissRecordingLogin,
	} = useRecording(userId);

	// Force note labels on while a course is open — useful learning aid here. The
	// chord recognizer stays at the user's setting (it can be distracting when
	// learning a course step). Restore previous value on leave.
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

	const [stepIndex, setStepIndex] = useState(0);
	const [stepStates, setStepStates] = useState<Record<number, StepState>>({});
	const [, forceTick] = useState(0);
	const heldRef = useRef<Set<number>>(new Set());
	const [stepStartedAt, setStepStartedAt] = useState(() => performance.now());

	const step = course.steps[stepIndex];

	// Auto-set the metronome BPM/beats so that if the user clicks the metronome button it
	// already matches the step. We DON'T auto-enable the click itself — the user toggles it on
	// from the nav button when they want it (the click can get annoying when always on).
	useEffect(() => {
		const tempo = stepTempo(step);
		if (!tempo) return;
		updateSetting("metronomeBpm", tempo.bpm);
		updateSetting("metronomeBeatsPerBar", tempo.beatsPerBar);
	}, [step, updateSetting]);

	// Make sure the metronome stops on the way out of the course player.
	useEffect(() => {
		return () => {
			updateSetting("metronomeEnabled", false);
		};
	}, [updateSetting]);

	const handleEarTrainingCorrect = useCallback(() => {
		setStepStates((all) => {
			const prev = all[stepIndex] ?? freshStepState();
			if (prev.completed) return all;
			return { ...all, [stepIndex]: { ...prev, completed: true } };
		});
	}, [stepIndex]);

	useEffect(() => {
		heldRef.current = new Set(localHeldMidis);
		forceTick((x) => x + 1);
		// Re-check chord completion when the held set changes (eg. user is already holding when arriving)
		const s = course.steps[stepIndex];
		if (!s) return;
		if (s.type === "play-chord") {
			const held = heldRef.current;
			const allHeld = s.midis.every((req) => held.has(req));
			if (allHeld) {
				setStepStates((all) => {
					const prev = all[stepIndex] ?? freshStepState();
					if (prev.completed) return all;
					const next = new Set(prev.chordHits);
					s.midis.forEach((m) => next.add(m));
					return { ...all, [stepIndex]: { ...prev, chordHits: next, completed: true } };
				});
			}
		}
	}, [localHeldMidis, course.steps, stepIndex]);

	useEffect(() => {
		setStepStartedAt(performance.now());
	}, [stepIndex]);

	const state = stepStates[stepIndex] ?? freshStepState();

	// Text steps and improvisation are always "completable" — no required action.
	useEffect(() => {
		if (!step) return;
		if (step.type === "text" || step.type === "improvisation") {
			setStepStates((all) => {
				const prev = all[stepIndex] ?? freshStepState();
				if (prev.completed) return all;
				return { ...all, [stepIndex]: { ...prev, completed: true } };
			});
		}
	}, [step, stepIndex]);

	// ── Demo: auto-play the target on step entry, then hand off to the user ──
	const [demoNotes, setDemoNotes] = useState<ParsedNote[]>([]);
	const [demoRunning, setDemoRunning] = useState(false);
	const [demoState, setDemoState] = useState<"idle" | "playing" | "done">(() =>
		stepNeedsDemo(course.steps[0]) ? "idle" : "done",
	);

	// Reset demo state synchronously the moment stepIndex changes. This runs during render
	// (not in a useEffect), so the FIRST render of a new step already uses fresh demo state —
	// no flash of stale CourseFallingNotes between step changes.
	const [demoStepKey, setDemoStepKey] = useState(0);
	if (demoStepKey !== stepIndex) {
		setDemoStepKey(stepIndex);
		setDemoNotes([]);
		setDemoRunning(false);
		setDemoState(stepNeedsDemo(step) ? "idle" : "done");
	}

	const buildSyntheticForStep = useCallback((s: CourseStep): ParsedNote[] => {
		const items = deriveDemo(s);
		if (!items || items.length === 0) return [];
		return buildSyntheticDemoNotes(items, {
			noteDurationMs: s.demoNoteDurationMs,
			gapMs: s.demoGapMs,
		});
	}, []);

	// Launches the synthetic auto-demo for the current step.
	useEffect(() => {
		if (!step) return;
		if (!stepNeedsDemo(step)) return;

		let cancelled = false;
		const synth = buildSyntheticForStep(step);
		if (synth.length === 0) {
			setDemoState("done");
			return;
		}
		setDemoNotes(synth);
		void unlockAudio();
		const timeoutId = window.setTimeout(() => {
			if (cancelled) return;
			setDemoRunning(true);
			setDemoState("playing");
		}, 350);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [step, buildSyntheticForStep, unlockAudio]);

	const handleDemoComplete = useCallback(() => {
		setDemoState("done");
		setDemoRunning(false);
	}, []);

	const replayDemo = useCallback(() => {
		if (!step) return;
		if (demoNotes.length === 0) return;
		setDemoRunning(false);
		void unlockAudio();
		window.setTimeout(() => {
			setDemoRunning(true);
			setDemoState("playing");
		}, 50);
	}, [step, demoNotes.length, unlockAudio]);

	const cancelDemo = useCallback(() => {
		setDemoRunning(false);
		setDemoState("done");
	}, []);

	// Highlights for the keyboard
	const highlightSet = useMemo<Set<number>>(() => {
		if (!step) return new Set();
		return new Set(step.highlightKeys ?? []);
	}, [step]);
	const accentSet = useMemo<Set<number>>(() => {
		if (!step) return new Set();
		return new Set(step.highlightAccent ?? []);
	}, [step]);

	// Labels on highlighted keys
	const labelMap = useMemo<Map<number, string>>(() => {
		const map = new Map<number, string>();
		highlightSet.forEach((m) => map.set(m, midiToLetter(m).replace("#", "♯")));
		accentSet.forEach((m) => {
			if (!map.has(m)) map.set(m, midiToLetter(m).replace("#", "♯"));
		});
		return map;
	}, [highlightSet, accentSet]);

	// Build lane items for the user-turn rendering (after the demo finishes).
	// During the demo phase, CourseDemoStage renders the real falling notes — these static
	// items only show once the user is being asked to play.
	const laneItems = useMemo<LaneItem[]>(() => {
		if (!step) return [];
		if (demoState === "playing") return [];
		switch (step.type) {
			case "play-note": {
				return [
					{
						midi: step.midi,
						progress: 0,
						height: 0.13,
						color: state.completed ? COLOR_PLAYED : COLOR_PRIMARY,
						glow: !state.completed,
						faded: state.completed,
					},
				];
			}
			case "play-chord": {
				return step.midis.map((m) => ({
					midi: m,
					progress: 0,
					height: 0.16,
					color: state.chordHits.has(m) || state.completed ? COLOR_PLAYED : COLOR_PRIMARY,
					glow: !state.chordHits.has(m) && !state.completed,
					faded: state.completed,
				}));
			}
			case "play-sequence": {
				const items: LaneItem[] = [];
				step.sequence.forEach((slot, idx) => {
					const midis = chordSlot(slot);
					const isCurrent = idx === state.sequenceCursor;
					const isFuture = idx > state.sequenceCursor;
					const isPast = idx < state.sequenceCursor;
					const progress = isCurrent ? 0 : isFuture ? (idx - state.sequenceCursor) * 0.18 : -0.2;
					if (progress < -0.1) return;
					midis.forEach((m) => {
						items.push({
							midi: m,
							progress: Math.max(0, progress),
							height: 0.14,
							color: isCurrent ? COLOR_PRIMARY : isPast ? COLOR_PLAYED : "#9a6dd5",
							glow: isCurrent,
							faded: isPast,
						});
					});
				});
				return items;
			}
			case "play-any-of":
				return [];
			case "demo-sequence": {
				// Static visualization of all notes spread by time
				const total = step.durationSeconds || 1;
				return step.notes.map((n) => ({
					midi: n.midi,
					progress: 1 - n.startSeconds / total,
					height: Math.max(0.06, (n.durationSeconds / total) * 0.9),
					color: COLOR_PRIMARY,
					glow: false,
					faded: false,
				}));
			}
			default:
				return [];
		}
	}, [step, state, demoState]);

	// Determine the user's prompt line (eg. "Press any C")
	const promptText = useMemo<string | null>(() => {
		if (!step) return null;
		// While the auto-demo is running, surface that state for any interactive step
		if (demoState === "playing" && step.type !== "text" && step.type !== "improvisation") {
			return "🎧 Listen…";
		}
		switch (step.type) {
			case "play-note":
				return `Now you try — press ${midiToLetter(step.midi).replace("#", "♯")}`;
			case "play-any-of": {
				const hitsNeeded = step.hitsNeeded ?? 1;
				return `Now you try — ${state.hitMidis.size} / ${hitsNeeded}`;
			}
			case "play-chord":
				return `Now you try — hold ${step.chordName ?? "the chord"} together`;
			case "play-sequence": {
				const total = step.sequence.length;
				return `Now you try — note ${Math.min(state.sequenceCursor + 1, total)} / ${total}`;
			}
			case "demo-sequence":
				return state.demoPlayed ? "Demo played" : "Listen…";
			case "improvisation":
				return "Improvise freely";
			case "ear-training":
				return state.completed ? "Correct ✓" : "Listen and pick the answer";
			case "text":
			default:
				return null;
		}
	}, [step, state, demoState]);

	// Handle a user note press — feed it to the active step's logic
	const handleUserNote = useCallback(
		(m: number) => {
			if (!step) return;

			setStepStates((all) => {
				const prev = all[stepIndex] ?? freshStepState();
				if (prev.completed && step.type !== "play-any-of") {
					// Already done — no-op for most steps
					return all;
				}

				switch (step.type) {
					case "play-note": {
						if (m === step.midi) {
							return { ...all, [stepIndex]: { ...prev, completed: true } };
						}
						return all;
					}
					case "play-any-of": {
						if (!step.allowedMidis.includes(m)) return all;
						if (prev.hitMidis.has(m)) return all;
						const nextHits = new Set(prev.hitMidis);
						nextHits.add(m);
						const need = step.hitsNeeded ?? 1;
						const completed = nextHits.size >= need;
						return { ...all, [stepIndex]: { ...prev, hitMidis: nextHits, completed } };
					}
					case "play-chord": {
						if (!step.midis.includes(m)) return all;
						// Look at the current held set + this incoming note
						const held = new Set(heldRef.current);
						held.add(m);
						const nextChordHits = new Set(prev.chordHits);
						step.midis.forEach((req) => {
							if (held.has(req)) nextChordHits.add(req);
						});
						const completed = step.midis.every((req) => held.has(req));
						return { ...all, [stepIndex]: { ...prev, chordHits: nextChordHits, completed } };
					}
					case "play-sequence": {
						const cursor = prev.sequenceCursor;
						if (cursor >= step.sequence.length) return all;
						const required = chordSlot(step.sequence[cursor]);
						if (!required.includes(m)) return all;
						// For chord slots, wait until all required midis are currently held
						const held = new Set(heldRef.current);
						held.add(m);
						const allHeld = required.every((req) => held.has(req));
						if (!allHeld) {
							const nextChordHits = new Set(prev.chordHits);
							required.forEach((req) => {
								if (held.has(req)) nextChordHits.add(req);
							});
							return { ...all, [stepIndex]: { ...prev, chordHits: nextChordHits } };
						}
						const nextCursor = cursor + 1;
						const completed = nextCursor >= step.sequence.length;
						return {
							...all,
							[stepIndex]: {
								...prev,
								sequenceCursor: nextCursor,
								chordHits: new Set(),
								completed,
							},
						};
					}
					default:
						return all;
				}
			});
		},
		[step, stepIndex],
	);

	const handleUserNoteRef = useRef(handleUserNote);
	useEffect(() => {
		handleUserNoteRef.current = handleUserNote;
	}, [handleUserNote]);

	const dispatchUserNote = useCallback((midi: number) => {
		handleUserNoteRef.current(midi);
	}, []);

	useEffect(() => {
		connectMIDI(
			(note, vel) => {
				dispatchUserNote(note);
				playNote(note, vel, "self");
			},
			(note) => stopNote(note, "self"),
		);
		return () => {
			connectMIDI();
		};
	}, [connectMIDI, playNote, stopNote, dispatchUserNote]);

	useKeyboardInput({
		enabled: keyboardInputEnabled,
		keybinds,
		baseMidi: keybindBaseMidi,
		onPlay: (m, v) => {
			dispatchUserNote(m);
			playNote(m, v, "self");
		},
		onStop: (m) => stopNote(m, "self"),
		onOctaveShift: (delta) => setKeybindBaseMidi(keybindBaseMidi + delta),
		onSustainChange: setSustain,
		onAnyKey: unlockAudio,
	});

	const handleNoteFromPiano = useCallback(
		(m: number, vel: number) => {
			unlockAudio();
			playNote(m, vel, "self");
			dispatchUserNote(m);
		},
		[playNote, unlockAudio, dispatchUserNote],
	);

	const [showFinish, setShowFinish] = useState(false);

	const handleNext = useCallback(() => {
		if (!step) return;
		if (stepIndex < course.steps.length - 1) {
			cancelDemo();
			setStepIndex(stepIndex + 1);
		} else {
			// Last step — show the course-complete screen
			cancelDemo();
			markCourseCompleted(course.id);
			checkAndUnlockAchievements();
			setShowFinish(true);
		}
	}, [step, stepIndex, course.steps.length, course.id, cancelDemo]);

	const handleBackToCourses = useCallback(() => {
		router.push("/practice/courses");
	}, [router]);

	const handleReplayCourse = useCallback(() => {
		setShowFinish(false);
		setStepStates({});
		setStepIndex(0);
	}, []);

	const courseSummary = useMemo(
		() => course.summary ?? summaryFromSteps(course.steps.map((s) => s.title)),
		[course],
	);

	const handlePrevious = useCallback(() => {
		if (stepIndex > 0) {
			cancelDemo();
			setStepIndex(stepIndex - 1);
		}
	}, [stepIndex, cancelDemo]);

	const handleReplayStep = useCallback(() => {
		cancelDemo();
		setStepStartedAt(performance.now());
		setStepStates((all) => ({ ...all, [stepIndex]: freshStepState() }));
		if (step?.type === "improvisation" || step?.type === "text") {
			setStepStates((all) => {
				const prev = all[stepIndex] ?? freshStepState();
				return { ...all, [stepIndex]: { ...prev, completed: true } };
			});
			return;
		}
		// Re-trigger the demo
		if (demoNotes.length > 0) {
			void unlockAudio();
			window.setTimeout(() => {
				setDemoRunning(true);
				setDemoState("playing");
			}, 200);
		}
	}, [cancelDemo, step, stepIndex, demoNotes.length, unlockAudio]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
			if (e.key === "ArrowRight") {
				if (state.completed) handleNext();
			} else if (e.key === "ArrowLeft") {
				handlePrevious();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [handleNext, handlePrevious, state.completed]);

	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	// Visualizer is for the user's own notes only — strip out anything from
	// the course's auto-play paths (CourseDemoStage uses "course-demo",
	// ImprovisationStage uses "course-backing"). See the Visualizer JSX
	// comment for why this matters.
	const selfNoteLines = useMemo(
		() => noteLines.filter((n) => n.playerId === "self"),
		[noteLines],
	);
	const canPrevious = stepIndex > 0;
	const canNext = state.completed;
	const isImprovStep = step?.type === "improvisation";
	const isEarTrainingStep = step?.type === "ear-training";
	const hasDemo = step ? deriveDemo(step) !== null || step.type === "demo-sequence" : false;

	return (
		<div className="h-full w-full text-gray-200 overflow-hidden flex relative">
			<SilkBackground
				color={settings.backgroundColor}
				scale={1}
				noiseIntensity={1.3}
				speed={3}
				rotation={270}
				animated={backgroundAnimated}
			/>

			<Navigation
				onLogout={() => router.push("/practice/courses")}
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
				extraControls={buildCourseControls({
					onReplayStep: handleReplayStep,
					canReplay: true,
				})}
			/>

			<CourseStepCard
				courseTitle={course.title}
				stepIndex={stepIndex}
				totalSteps={course.steps.length}
				title={step?.title}
				body={step?.body ?? ""}
				image={step?.image}
				imageAlt={step?.imageAlt}
				prompt={promptText}
				canPrevious={canPrevious}
				canNext={canNext}
				completed={state.completed}
				onPrevious={handlePrevious}
				onNext={handleNext}
			/>

			<div className="stage-full-bleed-x top-0 stage-bleed-bottom flex flex-col pb-[150px] pt-72" style={{ zIndex: 10 }}>
				<div className="relative flex-1 min-h-0">
					{/* User's own note trails — same canvas-based Visualizer that
					    runs in solo / multiplayer / regular-practice modes. Sits
					    behind the course content (which has its own absolute-
					    positioned lane bars on top) so the trails are visible
					    without competing for clicks. pointer-events:none lets the
					    stage UI underneath stay interactive.
					    Filtered to playerId === "self" — the course's demo notes
					    and improvisation backing track also flow through the
					    audio engine and get added to noteLines (under playerIds
					    "course-demo" and "course-backing"). Without the filter
					    every demonstration note would leave a trail next to the
					    user's, which is confusing — the lane bars from
					    CourseFallingNotes already show the demo path. */}
					<div className="absolute inset-0 pointer-events-none">
						<Visualizer
							noteLines={selfNoteLines}
							enabled={settings.visualizerEnabled}
							fallSpeed={settings.noteFallSpeed}
							cornerRadius={settings.noteCornerRadius}
						/>
					</div>
					{isImprovStep && step?.type === "improvisation" ? (
						<ImprovisationStage
							step={step}
							playNote={playNote}
							stopNote={stopNote}
							unlockAudio={unlockAudio}
						/>
					) : isEarTrainingStep && step?.type === "ear-training" ? (
						<EarTrainingStage
							step={step}
							stepKey={stepIndex}
							playNote={playNote}
							stopNote={stopNote}
							unlockAudio={unlockAudio}
							onCorrect={handleEarTrainingCorrect}
						/>
					) : demoState !== "done" ? (
						// Keep the demo stage mounted during both "idle" (waiting to start) and
						// "playing" so we never briefly swap to CourseFallingNotes between phases.
						<CourseDemoStage
							notes={demoNotes}
							running={demoRunning}
							playNote={playNote}
							stopNote={stopNote}
							onComplete={handleDemoComplete}
						/>
					) : (
						<CourseFallingNotes items={laneItems} stepStartedAt={stepStartedAt} />
					)}
				</div>
			</div>

			<div className="stage-full-bleed-x stage-bleed-bottom z-20">
				<Piano
					pianoKeys={pianoKeys}
					showKeys={true}
					onPlayNote={handleNoteFromPiano}
					onStopNote={stopNote}
					showNoteLabels={settings.showNoteLabels}
					keyAnimations={settings.keyAnimations}
					highlightedMidis={highlightSet}
					accentMidis={accentSet}
					labelMidis={labelMap}
				/>
			</div>

			<ChordDisplay heldMidis={localHeldMidis} enabled={settings.chordRecognizerEnabled} />

			{showFinish && (
				<FinishScreen
					courseTitle={course.title}
					summary={courseSummary}
					onBackToCourses={handleBackToCourses}
					onReplay={handleReplayCourse}
				/>
			)}

			<RecordingSignInModal open={recordingNeedsLogin} onClose={dismissRecordingLogin} />
		</div>
	);
}

// Workaround for unused CourseStep import in some IDEs
export type { CourseStep };
