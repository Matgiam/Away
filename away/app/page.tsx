"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Piano } from "@/components/multiplayer/Piano";
import { generatePiano } from "../lib/piano";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { VisNote } from "../lib/types";
import { Visualizer } from "@/components/multiplayer/Visualizer";
import { Navigation } from "@/components/layout/Navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
// ChatPanel removed - not needed on home page

export default function App() {
	const [showKeys, setShowKeys] = useState(true);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const [showHomeScreen, setShowHomeScreen] = useState(true);
	const pianoKeys = useMemo(() => generatePiano(), []);

	const router = useRouter();

	const { playNote, stopNote, unlockAudio } = useAudioEngine(pianoKeys, setNoteLines);

	const handleMultiplayerClick = () => {
		router.push("/multiplayer");
	};
	const handleProfileClick = () => {
		router.push("/protected/profile");
	};

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			{showHomeScreen ? (
				<>
					<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />

					<div className="absolute inset-0 z-10">
						<div className="absolute bottom-0 left-0 right-0 h-32"></div>
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
								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleMultiplayerClick}>
									Multiplayer mode
								</p>
								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleProfileClick}>
									Profile
								</p>
							</div>
						</div>
					</div>
				</>
			) : (
				<>
					<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />
					<div className="absolute inset-0 z-10 flex flex-col">
						<Navigation onLogout={() => setShowHomeScreen(true)} />
						<Visualizer noteLines={noteLines} />
						<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={playNote} onStopNote={stopNote} />
					</div>
				</>
			)}
		</div>
	);
}
