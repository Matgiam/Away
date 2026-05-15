"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { Navigation } from "@/components/layout/Navigation";
import { Piano } from "@/components/multiplayer/Piano";
import { ChordDisplay } from "@/components/layout/ChordDisplay";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useRecording } from "@/hooks/useRecording";
import { createClient } from "@/lib/supabase/client";
import { CourseStepCard } from "@/components/courses/CourseStepCard";
import { CourseSideControls } from "@/components/courses/CourseSideControls";
import { CourseFallingNotes, type LaneItem } from "@/components/courses/CourseFallingNotes";
import { ImprovisationStage } from "@/components/courses/ImprovisationStage";
import { midiToLetter } from "@/lib/courses/music";
import type { Course, CourseStep } from "@/lib/courses/types";

const COLOR_PRIMARY = "#c75ad6";
const COLOR_PLAYED = "#5571a8";
const COLOR_DEMO = "#a76cd1";

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
	const { state: recordingState, countdown: recordingCountdown, startRecording, stopRecording } =
		useRecording(userId);

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

	const step = course.steps[stepIndex];
	const state = stepStates[stepIndex] ?? freshStepState();

	// Bump the drop-in animation when a sequence advances
	useEffect(() => {
		if (step?.type === "play-sequence" && state.sequenceCursor > 0) {
			setStepStartedAt(performance.now());
		}
	}, [state.sequenceCursor, step?.type]);

	const setState = useCallback((mutator: (prev: StepState) => StepState) => {
		setStepStates((all) => {
			const prev = all[stepIndex] ?? freshStepState();
			return { ...all, [stepIndex]: mutator(prev) };
		});
	}, [stepIndex]);

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
	const demoTimersRef = useRef<number[]>([]);
	const demoActiveNotesRef = useRef<Set<number>>(new Set());
	const [demoState, setDemoState] = useState<"idle" | "playing" | "done">("done");
	const [demoCursor, setDemoCursor] = useState(0); // which item in the demo is currently being played (-1 if none)

	const cancelDemo = useCallback(() => {
		demoTimersRef.current.forEach((id) => window.clearTimeout(id));
		demoTimersRef.current = [];
		demoActiveNotesRef.current.forEach((m) => stopNote(m, "course-demo"));
		demoActiveNotesRef.current.clear();
	}, [stopNote]);

	// Plays a sequence of items where each item is either a single midi or an array (chord)
	const startDemoSequence = useCallback(
		(items: Array<number | number[]>, opts?: { noteDurationMs?: number; gapMs?: number }) => {
			cancelDemo();
			void unlockAudio();
			const noteDuration = opts?.noteDurationMs ?? 600;
			const chordDuration = Math.max(noteDuration, 900);
			const gap = opts?.gapMs ?? 200;

			setDemoState("playing");
			setDemoCursor(0);

			let cursorMs = 250; // small lead-in
			items.forEach((item, idx) => {
				const midis = chordSlot(item);
				const duration = midis.length > 1 ? chordDuration : noteDuration;
				const startMs = cursorMs;

				const onId = window.setTimeout(() => {
					setDemoCursor(idx);
					midis.forEach((m) => {
						playNote(m, 88, "course-demo", undefined, COLOR_DEMO);
						demoActiveNotesRef.current.add(m);
					});
				}, startMs);
				const offId = window.setTimeout(() => {
					midis.forEach((m) => {
						stopNote(m, "course-demo");
						demoActiveNotesRef.current.delete(m);
					});
				}, startMs + duration);
				demoTimersRef.current.push(onId, offId);

				cursorMs += duration + gap;
			});

			const doneId = window.setTimeout(() => {
				setDemoState("done");
				setDemoCursor(-1);
			}, cursorMs + 50);
			demoTimersRef.current.push(doneId);
		},
		[cancelDemo, playNote, stopNote, unlockAudio],
	);

	// Plays the manually-authored demo-sequence step (with absolute timing per note)
	const playLegacyDemoSequence = useCallback(() => {
		if (!step || step.type !== "demo-sequence") return;
		cancelDemo();
		void unlockAudio();
		setDemoState("playing");
		setDemoCursor(0);
		step.notes.forEach((note, idx) => {
			const onId = window.setTimeout(() => {
				setDemoCursor(idx);
				playNote(note.midi, note.velocity ?? 90, "course-demo", undefined, COLOR_DEMO);
				demoActiveNotesRef.current.add(note.midi);
			}, note.startSeconds * 1000);
			const offId = window.setTimeout(() => {
				stopNote(note.midi, "course-demo");
				demoActiveNotesRef.current.delete(note.midi);
			}, (note.startSeconds + note.durationSeconds) * 1000);
			demoTimersRef.current.push(onId, offId);
		});
		const doneId = window.setTimeout(() => {
			setState((prev) => ({ ...prev, demoPlayed: true, completed: true }));
			setDemoState("done");
			setDemoCursor(-1);
		}, step.durationSeconds * 1000 + 50);
		demoTimersRef.current.push(doneId);
	}, [step, cancelDemo, playNote, stopNote, setState, unlockAudio]);

	// Replay just the demo for the current step (used by the Replay demo side button)
	const replayDemo = useCallback(() => {
		if (!step) return;
		if (step.type === "demo-sequence") {
			playLegacyDemoSequence();
			return;
		}
		const items = deriveDemo(step);
		if (!items || items.length === 0) return;
		startDemoSequence(items, {
			noteDurationMs: step.demoNoteDurationMs,
			gapMs: step.demoGapMs,
		});
	}, [step, playLegacyDemoSequence, startDemoSequence]);

	// Run on step entry: auto-demo where applicable
	useEffect(() => {
		cancelDemo();
		if (!step) return;

		if (step.type === "demo-sequence") {
			if (step.autoPlayOnEnter) {
				const t = window.setTimeout(() => playLegacyDemoSequence(), 350);
				demoTimersRef.current.push(t);
			} else {
				setDemoState("done");
				setDemoCursor(-1);
			}
			return cancelDemo;
		}

		if (step.type === "text" || step.type === "improvisation") {
			setDemoState("done");
			setDemoCursor(-1);
			return cancelDemo;
		}

		const items = deriveDemo(step);
		if (!items || items.length === 0) {
			setDemoState("done");
			setDemoCursor(-1);
			return cancelDemo;
		}

		const t = window.setTimeout(() => {
			startDemoSequence(items, {
				noteDurationMs: step.demoNoteDurationMs,
				gapMs: step.demoGapMs,
			});
		}, 400);
		demoTimersRef.current.push(t);

		return cancelDemo;
	}, [step, cancelDemo, playLegacyDemoSequence, startDemoSequence]);

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

	// Build lane items for the falling notes area
	const laneItems = useMemo<LaneItem[]>(() => {
		if (!step) return [];
		const inDemo = demoState === "playing";
		switch (step.type) {
			case "play-note": {
				const playingNow = inDemo && demoCursor === 0;
				return [
					{
						midi: step.midi,
						progress: 0,
						height: 0.13,
						color: state.completed ? COLOR_PLAYED : inDemo ? COLOR_DEMO : COLOR_PRIMARY,
						glow: playingNow || (!inDemo && !state.completed),
						faded: state.completed && !playingNow,
						noDropIn: inDemo,
					},
				];
			}
			case "play-chord": {
				const playingNow = inDemo && demoCursor === 0;
				return step.midis.map((m) => ({
					midi: m,
					progress: 0,
					height: 0.16,
					color: state.chordHits.has(m) || state.completed
						? COLOR_PLAYED
						: inDemo
							? COLOR_DEMO
							: COLOR_PRIMARY,
					glow: playingNow || (!inDemo && !state.chordHits.has(m) && !state.completed),
					faded: state.completed && !playingNow,
					noDropIn: inDemo,
				}));
			}
			case "play-sequence": {
				const items: LaneItem[] = [];
				step.sequence.forEach((slot, idx) => {
					const midis = chordSlot(slot);
					if (inDemo) {
						// During demo, show the whole sequence statically, glowing the current item
						const progress = (step.sequence.length - 1 - idx) * (0.95 / Math.max(1, step.sequence.length));
						const isPlaying = demoCursor === idx;
						midis.forEach((m) => {
							items.push({
								midi: m,
								progress,
								height: 0.07,
								color: isPlaying ? COLOR_DEMO : "#7d56a3",
								glow: isPlaying,
								faded: false,
								noDropIn: true,
							});
						});
						return;
					}
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
			case "play-any-of": {
				if (!inDemo) return [];
				// Show the demo midis briefly while playing so the user sees which key plays
				const demo = deriveDemo(step) ?? [];
				const items: LaneItem[] = [];
				demo.forEach((slot, idx) => {
					if (demoCursor !== idx) return;
					const midis = chordSlot(slot);
					midis.forEach((m) => {
						items.push({
							midi: m,
							progress: 0,
							height: 0.13,
							color: COLOR_DEMO,
							glow: true,
							faded: false,
							noDropIn: true,
						});
					});
				});
				return items;
			}
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
	}, [step, state, demoState, demoCursor]);

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

	const handleNoteFromPiano = useCallback(
		(m: number, vel: number) => {
			unlockAudio();
			playNote(m, vel, "self");
			handleUserNoteRef.current(m);
		},
		[playNote, unlockAudio],
	);

	const handleNext = useCallback(() => {
		if (!step) return;
		if (stepIndex < course.steps.length - 1) {
			cancelDemo();
			setStepIndex(stepIndex + 1);
		} else {
			// Last step — return to course menu
			router.push("/practice/courses");
		}
	}, [step, stepIndex, course.steps.length, cancelDemo, router]);

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
			// Keep auto-complete behavior
			setStepStates((all) => {
				const prev = all[stepIndex] ?? freshStepState();
				return { ...all, [stepIndex]: { ...prev, completed: true } };
			});
			return;
		}
		// Re-trigger the demo if the step has one
		if (step?.type === "demo-sequence") {
			const t = window.setTimeout(() => playLegacyDemoSequence(), 300);
			demoTimersRef.current.push(t);
			return;
		}
		if (!step) return;
		const items = deriveDemo(step);
		if (items && items.length > 0) {
			const t = window.setTimeout(() => {
				startDemoSequence(items, {
					noteDurationMs: step.demoNoteDurationMs,
					gapMs: step.demoGapMs,
				});
			}, 300);
			demoTimersRef.current.push(t);
		}
	}, [cancelDemo, step, stepIndex, playLegacyDemoSequence, startDemoSequence]);

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
	const canPrevious = stepIndex > 0;
	const canNext = state.completed;
	const isImprovStep = step?.type === "improvisation";
	const hasDemo = step ? deriveDemo(step) !== null || step.type === "demo-sequence" : false;

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
			/>

			<CourseSideControls
				onSelectCourse={() => router.push("/practice/courses")}
				onReplayStep={handleReplayStep}
				canReplay={true}
				demoMode={hasDemo}
				demoLabel={demoState === "playing" ? "Playing demo…" : "Replay demo"}
				onDemo={replayDemo}
			/>

			<CourseStepCard
				stepIndex={stepIndex}
				totalSteps={course.steps.length}
				title={step?.title}
				body={step?.body ?? ""}
				prompt={promptText}
				canPrevious={canPrevious}
				canNext={canNext}
				completed={state.completed}
				onPrevious={handlePrevious}
				onNext={handleNext}
			/>

			<div className="absolute inset-0 z-10 flex flex-col pb-[150px] pt-72">
				<div className="relative flex-1 min-h-0">
					{isImprovStep && step?.type === "improvisation" ? (
						<ImprovisationStage step={step} playNote={playNote} stopNote={stopNote} unlockAudio={unlockAudio} />
					) : (
						<CourseFallingNotes items={laneItems} stepStartedAt={stepStartedAt} />
					)}
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
					highlightedMidis={highlightSet}
					accentMidis={accentSet}
					labelMidis={labelMap}
				/>
			</div>

			<ChordDisplay heldMidis={localHeldMidis} enabled={settings.chordRecognizerEnabled} />
		</div>
	);
}

// Workaround for unused CourseStep import in some IDEs
export type { CourseStep };
