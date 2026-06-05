// ============================================================================
// courses/EarTrainingStage.tsx
// ----------------------------------------------------------------------------
// Stage used by ear-training course steps. Plays the configured pitches
// (sequential or chordal) and shows multiple-choice answer buttons. The
// piano stays silent — nothing is highlighted — so the user has to identify
// the sound by ear.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { EarTrainingStep } from "@/lib/courses/types";

interface EarTrainingStageProps {
	step: EarTrainingStep;
	// Changes each time the user enters this step (used to retrigger audio / reset state).
	stepKey: number;
	playNote: (
		midi: number,
		velocity: number,
		playerId?: string,
		colorIndex?: number,
		noteColorHex?: string,
		soundfontKey?: string,
	) => void;
	stopNote: (midi: number, playerId?: string, soundfontKey?: string) => void;
	unlockAudio: () => Promise<void>;
	// Called once when the user clicks the correct option.
	onCorrect: () => void;
}

const COURSE_PLAYER_ID = "course-ear-training";
const AUDIO_COLOR = "#c75ad6";

export function EarTrainingStage({
	step,
	stepKey,
	playNote,
	stopNote,
	unlockAudio,
	onCorrect,
}: EarTrainingStageProps) {
	const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
	const [solvedId, setSolvedId] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);

	const sustainedRef = useRef<Set<number>>(new Set());
	const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const stopAll = useCallback(() => {
		timeoutsRef.current.forEach((t) => clearTimeout(t));
		timeoutsRef.current = [];
		sustainedRef.current.forEach((m) => stopNote(m, COURSE_PLAYER_ID));
		sustainedRef.current.clear();
		setPlaying(false);
	}, [stopNote]);

	const playAudio = useCallback(async () => {
		await unlockAudio();
		stopAll();

		setPlaying(true);
		const noteDur = step.noteDurationMs ?? 700;
		const gap = step.gapMs ?? 150;
		const chordHold = step.chordHoldMs ?? 1500;

		if (step.isChord) {
			step.notes.forEach((m) => {
				playNote(m, 90, COURSE_PLAYER_ID, undefined, AUDIO_COLOR);
				sustainedRef.current.add(m);
			});
			timeoutsRef.current.push(
				setTimeout(() => {
					sustainedRef.current.forEach((m) => stopNote(m, COURSE_PLAYER_ID));
					sustainedRef.current.clear();
					setPlaying(false);
				}, chordHold),
			);
		} else {
			step.notes.forEach((m, i) => {
				const onTime = i * (noteDur + gap);
				const offTime = onTime + noteDur;
				timeoutsRef.current.push(
					setTimeout(() => {
						playNote(m, 90, COURSE_PLAYER_ID, undefined, AUDIO_COLOR);
						sustainedRef.current.add(m);
					}, onTime),
				);
				timeoutsRef.current.push(
					setTimeout(() => {
						stopNote(m, COURSE_PLAYER_ID);
						sustainedRef.current.delete(m);
					}, offTime),
				);
			});
			const total = step.notes.length * (noteDur + gap) + 100;
			timeoutsRef.current.push(setTimeout(() => setPlaying(false), total));
		}
	}, [playNote, stopNote, unlockAudio, stopAll, step.notes, step.isChord, step.noteDurationMs, step.gapMs, step.chordHoldMs]);

	// Reset and auto-play when the user reaches a new step.
	useEffect(() => {
		setSolvedId(null);
		setWrongIds(new Set());
		const t = setTimeout(() => {
			void playAudio();
		}, 350);
		return () => {
			clearTimeout(t);
			stopAll();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stepKey]);

	// Hard cleanup on unmount.
	useEffect(() => {
		return () => stopAll();
	}, [stopAll]);

	const handleSelect = (optionId: string) => {
		if (solvedId) return;
		if (optionId === step.correctOptionId) {
			setSolvedId(optionId);
			onCorrect();
		} else {
			setWrongIds((prev) => {
				const next = new Set(prev);
				next.add(optionId);
				return next;
			});
		}
	};

	return (
		<div className="relative h-full w-full flex flex-col items-center justify-center gap-10 px-6">
			<button
				type="button"
				onClick={() => void playAudio()}
				disabled={playing}
				className={`transition-transform ${playing ? "opacity-70" : "hover:scale-105"}`}
			>
				<DynamicLiquidGlass
					width={220}
					height={68}
					radius={34}
					refractionLevel={0.8}
					specularOpacity={0.7}
					glassBgOpacity={playing ? 0.16 : 0.05}
				>
					<span className="text-white text-lg italic font-semibold tracking-wide">
						{playing ? "Listening…" : solvedId ? "Play again" : "Play again"}
					</span>
				</DynamicLiquidGlass>
			</button>

			<div className="flex flex-wrap items-center justify-center gap-4 max-w-[760px]">
				{step.options.map((opt) => {
					const isSolved = solvedId === opt.id;
					const isWrong = wrongIds.has(opt.id);
					const dimmed = !!solvedId && !isSolved;

					return (
						<button
							key={opt.id}
							type="button"
							onClick={() => handleSelect(opt.id)}
							disabled={!!solvedId || isWrong}
							className={`transition-transform ${
								dimmed ? "opacity-50" : isWrong ? "opacity-70" : "hover:scale-[1.03]"
							} disabled:cursor-default`}
						>
							<DynamicLiquidGlass
								width={220}
								height={84}
								radius={22}
								refractionLevel={0.8}
								specularOpacity={0.65}
								glassBgOpacity={isSolved ? 0.22 : isWrong ? 0.18 : 0.04}
							>
								<span
									className={`text-lg italic font-semibold tracking-wide ${
										isSolved
											? "text-emerald-200"
											: isWrong
												? "text-red-300/90"
												: "text-white/90"
									}`}
								>
									{isSolved ? "✓ " : isWrong ? "✕ " : ""}
									{opt.label}
								</span>
							</DynamicLiquidGlass>
						</button>
					);
				})}
			</div>

			{solvedId && (
				<p className="text-emerald-200/80 text-sm italic tracking-wide">
					Nice, press <span className="font-semibold">Next</span> to continue.
				</p>
			)}
		</div>
	);
}
