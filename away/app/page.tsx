"use client";

import { useState, useMemo } from "react";
import { Piano } from "../components/Piano";
import { generatePiano } from "../lib/piano";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { VisNote } from "../lib/types";

export default function App() {
	const [showKeys, setShowKeys] = useState(true);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const [showHomeScreen, setShowHomeScreen] = useState(true);
	const pianoKeys = useMemo(() => generatePiano(), []);

	const { playNote, stopNote, unlockAudio } = useAudioEngine(pianoKeys, setNoteLines);

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			{showHomeScreen ? (
				<>
					<div className="absolute inset-0 z-10">
								<div className="absolute bottom-0 left-0 right-0 h-32">
						</div>
						<div className="absolute right-30 mt-30">
							<div className="flex flex-col items-end">
								<h1 className="text-[96px] font-black text-white tracking-wider mb-2 title">Away</h1>
								<p
									className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-20"
									onClick={() => {
										setShowHomeScreen(false);
										unlockAudio();
									}}
								>
									Solo mode
								</p>
							</div>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="absolute inset-0 z-10 flex flex-col">
						<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={playNote} onStopNote={stopNote} />
					</div>
				</>
			)}
		</div>
	);
}
