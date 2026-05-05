// "use client";

// import { useState, useMemo } from "react";
// import { useRouter } from "next/navigation"; // <-- NEW: Next.js Router
// import { Piano } from "../components/Piano";
// import { generatePiano } from "../lib/piano";
// import { useAudioEngine } from "../hooks/useAudioEngine";
// import { VisNote } from "../lib/types";
// import { Visualizer } from "@/components/Visualizer";
// import { Navigation } from "@/components/Navigation";
// import { SilkBackground } from "@/components/SilkBackground";

// export default function App() {
// 	const [showKeys, setShowKeys] = useState(true);
// 	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
// 	const [showHomeScreen, setShowHomeScreen] = useState(true);
// 	const pianoKeys = useMemo(() => generatePiano(), []);

// 	const { playNote, stopNote, unlockAudio } = useAudioEngine(pianoKeys, setNoteLines);

// 	return (
// 		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
// 			{showHomeScreen ? (
// 				<>
// 					<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />

// 					<div className="absolute inset-0 z-10">
// 						<div className="absolute bottom-0 left-0 right-0 h-32"></div>
// 						<div className="absolute right-30 mt-30">
// 							<div className="flex flex-col items-end">
// 								<h1 className="text-[96px] font-black text-white tracking-wider mb-2 title">Away</h1>
// 								<p
// 									className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-20"
// 									onClick={() => {
// 										setShowHomeScreen(false);
// 										unlockAudio();
// 									}}
// 								>
// 									Solo mode
// 								</p>
// 							</div>
// 						</div>
// 					</div>
// 				</>
// 			) : (
// 				<>
// 					<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />
// 					<div className="absolute inset-0 z-10 flex flex-col">
// 						<Navigation onLogout={() => setShowHomeScreen(true)} />
// 						<Visualizer noteLines={noteLines} />
// 						<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={playNote} onStopNote={stopNote} />
// 					</div>
// 				</>
// 			)}
// 		</div>
// 	);
// }
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase"; // Adjust the path if needed

export default function SupabaseLobby() {
	const [status, setStatus] = useState("Connecting...");
	const [usersOnline, setUsersOnline] = useState<string[]>([]);
	const myTempId = useRef(`Player-${Math.floor(Math.random() * 1000)}`);

	useEffect(() => {
		const room = supabase.channel("test-room", {
			config: {
				presence: {
					key: myTempId.current,
				},
			},
		});
		room.on("presence", { event: "sync" }, () => {
			const state = room.presenceState();
			const activeUsers = Object.keys(state);
			setUsersOnline(activeUsers);
		});

		// 3. Actually join the room
		room.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				setStatus(`Connected to Supabase! (I am ${myTempId.current})`);
				// Tell everyone else we have arrived!
				await room.track({ status: "online" });
			} else {
				setStatus("Failed to connect.");
			}
		});
		return () => {
			supabase.removeChannel(room);
		};
	}, []);

	return (
		<div className="flex items-center justify-center h-screen bg-[#050505] text-white font-sans">
			<div className="p-8 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full">
				<h2 className="text-3xl font-bold mb-2">Lobby test</h2>
				<p className="mb-8 text-sm">{status}</p>

				<div className="bg-gray-800 p-4 rounded-lg">
					<h3 className="text-gray-400 text-sm uppercase tracking-widest mb-3">Musicians Online ({usersOnline.length})</h3>
					<ul className="space-y-2">
						{usersOnline.map((user) => (
							<li key={user} className="flex items-center space-x-3 bg-gray-700 p-3 rounded-md">
								<h2 className="font-mono text-gray-200">
									{user} {user === myTempId.current ? "(You)" : ""}
								</h2>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
