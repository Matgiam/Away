"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { Piano } from "@/components/Piano";
import { generatePiano } from "@/lib/piano";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { VisNote } from "@/lib/types";
import { Visualizer } from "@/components/Visualizer";
import { Navigation } from "@/components/Navigation";
import { SilkBackground } from "@/components/SilkBackground";
import { useWebRTC } from "@/hooks/useWebRTC";
import { getOrCreatePlayerId } from "@/hooks/useCreateRoom";
import { ChatPanel } from "@/components/ChatPanel";
import { useChat } from "@/hooks/useChat";
import type { ChatMessage } from "@/hooks/useChat";

export default function JamRoom() {
	const params = useParams();
	const router = useRouter();
	const roomId = params.roomId as string;

	const [showKeys, setShowKeys] = useState(true);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const pianoKeys = useMemo(() => generatePiano(), []);

	const { playNote, stopNote, unlockAudio, connectMIDI } = useAudioEngine(pianoKeys, setNoteLines);
	const activePeerNotes = useRef<Set<number>>(new Set());

	const onReceivePeerNote = useCallback(
		(note: number, velocity: number, isNoteOn: boolean) => {
			if (isNoteOn) {
				if (activePeerNotes.current.has(note)) return;
				activePeerNotes.current.add(note);
				playNote(note, velocity);
			} else {
				if (activePeerNotes.current.has(note)) {
					activePeerNotes.current.delete(note);
					stopNote(note);
				}
			}
		},
		[playNote, stopNote],
	);

	const { createOffer, acceptOffer, acceptAnswer, addIceCandidate, sendNoteToPeer, isConnected } = useWebRTC(onReceivePeerNote);

	const handleLocalPlay = useCallback(
		(note: number, velocity: number = 127) => {
			playNote(note, velocity);
			sendNoteToPeer(note, velocity, true);
		},
		[playNote, sendNoteToPeer],
	);

	const handleLocalStop = useCallback(
		(note: number) => {
			stopNote(note);
			sendNoteToPeer(note, 0, false);
		},
		[stopNote, sendNoteToPeer],
	);

	const [usersOnline, setUsersOnline] = useState<string[]>([]);
	const myTempId = useRef(getOrCreatePlayerId());
	const isConnecting = useRef(false);

	
	const { messages, isChatOpen, setIsChatOpen, addMessage } = useChat(myTempId.current);
	const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

	const handleOpenChat = useCallback(() => {
		setIsChatOpen(true);
	}, [setIsChatOpen]);

	const handleCloseChat = useCallback(() => {
		setIsChatOpen(false);
	}, [setIsChatOpen]);

	const handleSendMessage = useCallback(
		(text: string) => {
			const channel = roomChannelRef.current;
			if (!channel) return;
			const msg: ChatMessage = {
				id: Math.random().toString(36).substring(2),
				senderId: myTempId.current,
				senderName: myTempId.current,
				text,
				timestamp: Date.now(),
			};
			addMessage(msg);
			channel.send({
				type: "broadcast",
				event: "chat-message",
				payload: msg,
			});
		},
		[addMessage],
	);

	const handleClick = useCallback(() => unlockAudio(), [unlockAudio]);

	const createOfferRef = useRef(createOffer);
	const acceptOfferRef = useRef(acceptOffer);
	const acceptAnswerRef = useRef(acceptAnswer);
	const addIceCandidateRef = useRef(addIceCandidate);
	const unlockAudioRef = useRef(unlockAudio);

	useEffect(() => {
		createOfferRef.current = createOffer;
		acceptOfferRef.current = acceptOffer;
		acceptAnswerRef.current = acceptAnswer;
		addIceCandidateRef.current = addIceCandidate;
		unlockAudioRef.current = unlockAudio;
	}, [createOffer, acceptOffer, acceptAnswer, addIceCandidate, unlockAudio]);

	const connectMIDIRef = useRef(connectMIDI);
	const handleLocalPlayRef = useRef(handleLocalPlay);
	const handleLocalStopRef = useRef(handleLocalStop);

	useEffect(() => {
		connectMIDIRef.current = connectMIDI;
	}, [connectMIDI]);
	useEffect(() => {
		handleLocalPlayRef.current = handleLocalPlay;
	}, [handleLocalPlay]);
	useEffect(() => {
		handleLocalStopRef.current = handleLocalStop;
	}, [handleLocalStop]);

	useEffect(() => {
		if (isConnected) {
			unlockAudio();
			connectMIDIRef.current(
				(note, vel) => handleLocalPlayRef.current(note, vel),
				(note) => handleLocalStopRef.current(note),
			);
		}
	}, [isConnected, unlockAudio]);

	const addMessageRef = useRef(addMessage);
	useEffect(() => {
		addMessageRef.current = addMessage;
	}, [addMessage]);

	useEffect(() => {
		unlockAudioRef.current();

		const room = supabase.channel(`jam-room-${roomId}`, {
			config: { presence: { key: myTempId.current } },
		});

		roomChannelRef.current = room;

		const sendSignal = (payload: any) => {
			room.send({
				type: "broadcast",
				event: "webrtc-signal",
				payload: { ...payload, senderId: myTempId.current },
			});
		};

		room.on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			if (payload.type === "ready-to-connect" && !isConnecting.current) {
				isConnecting.current = true;
				createOfferRef.current(sendSignal);
			} else if (payload.type === "offer") {
				isConnecting.current = true;
				acceptOfferRef.current(payload.offer, sendSignal);
			} else if (payload.type === "answer") {
				acceptAnswerRef.current(payload.answer);
			} else if (payload.type === "candidate") {
				addIceCandidateRef.current(payload.candidate);
			}
		});

		room.on("broadcast", { event: "chat-message" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			addMessageRef.current(payload as ChatMessage);
		});

		room.on("presence", { event: "sync" }, () => {
			setUsersOnline(Object.keys(room.presenceState()));
		});

		room.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				await room.track({ status: "online" });
				sendSignal({ type: "ready-to-connect" });
			}
		});

		return () => {
			isConnecting.current = false;
			roomChannelRef.current = null;
			room.untrack();
			supabase.removeChannel(room);
		};
	}, [roomId]);

	useEffect(() => {
		return () => {
			const hostedRoomId = sessionStorage.getItem("hostedRoomId");
			if (hostedRoomId === roomId) {
				supabase.from("rooms").delete().eq("id", roomId);
				sessionStorage.removeItem("hostedRoomId");
			}
		};
	}, [roomId]);

	const handleLeave = useCallback(async () => {
		const hostedRoomId = sessionStorage.getItem("hostedRoomId");
		if (hostedRoomId === roomId) {
			await supabase.from("rooms").delete().eq("id", roomId);
			sessionStorage.removeItem("hostedRoomId");
		} else {
			const { data } = await supabase.from("rooms").select("current_players").eq("id", roomId).single();
			if (data && data.current_players <= 1) {
				await supabase.from("rooms").delete().eq("id", roomId);
			} else {
				await supabase.rpc("decrement_players", { room_id: roomId });
			}
		}
		router.push("/multiplayer");
	}, [roomId, router]);

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative" onClick={handleClick}>
			<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />

			<div className="absolute inset-0 z-10 flex flex-row">
				<div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
					<Navigation onLogout={handleLeave} isChatOpen={isChatOpen} onToggleChat={isChatOpen ? handleCloseChat : handleOpenChat} />
					<div className="absolute top-20 left-10 z-50">
						{isConnected ? "connected!" : "connecting...."}
						<ul className="space-y-1">
							{usersOnline.map((user) => (
								<li key={user} className="flex items-center space-x-2 text-sm font-mono">
									<span className={user === myTempId.current ? "text-white" : "text-gray-400"}>{user}</span>
									<span className="font-mono text-gray-200">{user === myTempId.current ? "(You)" : ""}</span>
								</li>
							))}
						</ul>
					</div>
					<Visualizer noteLines={noteLines} />
					<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={handleLocalPlay} onStopNote={handleLocalStop} />
				</div>

				{isChatOpen && <ChatPanel messages={messages} myId={myTempId.current} onSend={handleSendMessage} onClose={handleCloseChat} />}
			</div>
		</div>
	);
}
