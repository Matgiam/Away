"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { generatePiano } from "@/lib/piano";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import type { PianoKey, VisNote } from "@/lib/types";

type AudioEngineContextValue = ReturnType<typeof useAudioEngine> & {
	pianoKeys: PianoKey[];
	noteLines: VisNote[];
};

const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

export function AudioEngineProvider({ children }: { children: ReactNode }) {
	const pianoKeys = useMemo(() => generatePiano(), []);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const engine = useAudioEngine(pianoKeys, setNoteLines);

	const value = useMemo<AudioEngineContextValue>(
		() => ({ ...engine, pianoKeys, noteLines }),
		[engine, pianoKeys, noteLines],
	);

	return <AudioEngineContext.Provider value={value}>{children}</AudioEngineContext.Provider>;
}

export function useAudioEngineContext(): AudioEngineContextValue {
	const ctx = useContext(AudioEngineContext);
	if (!ctx) throw new Error("useAudioEngineContext must be used inside <AudioEngineProvider>");
	return ctx;
}
