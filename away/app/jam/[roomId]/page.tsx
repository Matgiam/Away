"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Piano } from "@/components/Piano";
import { generatePiano } from "@/lib/piano";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { VisNote } from "@/lib/types";
import { Visualizer } from "@/components/Visualizer";
import { Navigation } from "@/components/Navigation";
import { SilkBackground } from "@/components/SilkBackground";

export default function JamRoom() {
	const params = useParams();
	const router = useRouter();
	const roomId = params.roomId as string;

	const [showKeys, setShowKeys] = useState(true);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const pianoKeys = useMemo(() => generatePiano(), []);
	const { playNote, stopNote, unlockAudio } = useAudioEngine(pianoKeys, setNoteLines);

	const [usersOnline, setUsersOnline] = useState<string[]>([]);
	const myTempId = useRef(`Player-${Math.floor(Math.random() * 1000)}`);

	useEffect(() => {
		unlockAudio();

		// 1. Create a unique channel using the URL parameter
		const room = supabase.channel(`jam-room-${roomId}`, {
			config: { presence: { key: myTempId.current } },
		});

		// 2. Listen for Presence changes
		room.on("presence", { event: "sync" }, () => {
			const state = room.presenceState();
			setUsersOnline(Object.keys(state));
		});

		// 3. Join the room
		room.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				await room.track({ status: "online" });
			}
		});

		// 4. Cleanup on leave
		return () => {
			room.untrack();
			supabase.removeChannel(room);
		};
	}, [roomId, unlockAudio]);

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />

			<div className="absolute inset-0 z-10 flex flex-col">
				<Navigation onLogout={() => router.push("/")} />

				<div className="absolute top-20 left-10">
					<ul className="space-y-1">
						{usersOnline.map((user) => (
							<li key={user} className="flex items-center space-x-2 text-sm font-mono">
								<h2 className={user === myTempId.current ? "text-white" : "text-gray-400"}>
									{user} {user === myTempId.current && "(You)"}
								</h2>
							</li>
						))}
					</ul>
				</div>

				<Visualizer noteLines={noteLines} />
				<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={playNote} onStopNote={stopNote} />
			</div>
		</div>
	);
}
