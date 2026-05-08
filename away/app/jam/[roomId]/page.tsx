"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { Piano } from "@/components/multiplayer/Piano";
import { generatePiano } from "@/lib/piano";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { VisNote } from "@/lib/types";
import { Visualizer } from "@/components/multiplayer/Visualizer";
import { Navigation } from "@/components/layout/Navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { useWebRTC } from "@/hooks/useWebRTC";
import { getOrCreatePlayerId } from "@/hooks/useCreateRoom";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChat } from "@/hooks/useChat";
import { PlayerList } from "@/components/multiplayer/PlayerList";
import { PLAYER_COLORS, getColorIndex } from "@/lib/playerColors";
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

	const [usersOnline, setUsersOnline] = useState<string[]>([]);
	const myTempId = useRef(getOrCreatePlayerId());
	const isConnecting = useRef(false);

	const [user, setUser] = useState<any>(null);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [myName, setMyName] = useState("");

	const chatAnchorRef = useRef<HTMLDivElement>(null);
	const [chatTopPx, setChatTopPx] = useState(0);

	useEffect(() => {
		const updateChatTop = () => {
			if (chatAnchorRef.current) {
				const rect = chatAnchorRef.current.getBoundingClientRect();
				setChatTopPx(rect.bottom + 12);
			}
		};
		updateChatTop();
		const observer = new ResizeObserver(updateChatTop);
		observer.observe(document.documentElement);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const REFRESH_KEY = "jamRoomRefreshed";

		const wasRefreshed = sessionStorage.getItem(REFRESH_KEY);
		if (wasRefreshed === roomId) {
			sessionStorage.removeItem(REFRESH_KEY);

			const cleanup = async () => {
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
				router.replace("/multiplayer");
			};

			cleanup();
			return;
		}

		const handleBeforeUnload = () => {
			sessionStorage.setItem(REFRESH_KEY, roomId);
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [roomId, router]);

	useEffect(() => {
		const checkUser = async () => {
			const supabaseClient = createClient();
			const { data } = await supabaseClient.auth.getUser();
			if (data.user) {
				setUser(data.user);
				setIsLoggedIn(true);
				setMyName(data.user.email?.split("@")[0] || data.user.id.substring(0, 8));
				sessionStorage.setItem("away_user", JSON.stringify({ id: data.user.id, email: data.user.email }));
			} else {
				const savedUser = sessionStorage.getItem("away_user");
				if (savedUser) {
					const parsed = JSON.parse(savedUser);
					setMyName(parsed.email?.split("@")[0] || parsed.id.substring(0, 8));
				}
			}
		};
		checkUser();
	}, []);

	const myColorIndex = useMemo(() => getColorIndex(usersOnline, myTempId.current), [usersOnline]);
	const myColor = useMemo(() => PLAYER_COLORS[myColorIndex % PLAYER_COLORS.length], [myColorIndex]);
	const peerColorIndex = useMemo(() => (myColorIndex === 0 ? 1 : 0), [myColorIndex]);
	const peerColor = useMemo(() => PLAYER_COLORS[peerColorIndex % PLAYER_COLORS.length], [peerColorIndex]);

	const peerColorRef = useRef(peerColor);
	useEffect(() => {
		peerColorRef.current = peerColor;
	}, [peerColor]);
	const myColorRef = useRef(myColor);
	useEffect(() => {
		myColorRef.current = myColor;
	}, [myColor]);

	const onReceivePeerNote = useCallback(
		(note: number, velocity: number, isNoteOn: boolean) => {
			if (isNoteOn) {
				if (activePeerNotes.current.has(note)) return;
				activePeerNotes.current.add(note);
				playNote(note, velocity, peerColorRef.current);
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

	const prevIsConnected = useRef(false);
	useEffect(() => {
		if (prevIsConnected.current === true && isConnected === false) {
			isConnecting.current = false;
			activePeerNotes.current.clear();
		}
		prevIsConnected.current = isConnected;
	}, [isConnected]);

	const handleLocalPlay = useCallback(
		(note: number, velocity: number = 127) => {
			playNote(note, velocity, myColorRef.current);
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

	const { messages, isChatOpen, setIsChatOpen, addMessage } = useChat(myTempId.current);

	const handleLoginClick = useCallback(() => {
		sessionStorage.setItem("redirect_after_login", `/jam/${roomId}`);
		router.push("/auth/login");
	}, [router, roomId]);

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
				senderId: isLoggedIn ? user?.id || myTempId.current : myTempId.current,
				senderName: isLoggedIn ? myName : myTempId.current,
				text,
				timestamp: Date.now(),
			};
			addMessage(msg);
			channel.send({ type: "broadcast", event: "chat-message", payload: msg });
		},
		[addMessage, isLoggedIn, user, myName],
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
			setUsersOnline(Object.keys(room.presenceState()).sort());
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

	const players = useMemo(
		() =>
			usersOnline.map((userId, index) => ({
				id: userId,
				displayName: userId === myTempId.current ? myName || userId : userId,
				colorIndex: index,
				isMe: userId === myTempId.current,
				isFriend: false,
			})),
		[usersOnline, myName],
	);

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative" onClick={handleClick}>
			<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />

			<Navigation
				onLogout={handleLeave}
				isChatOpen={isChatOpen}
				onToggleChat={isChatOpen ? handleCloseChat : handleOpenChat}
				chatAnchorRef={chatAnchorRef}
			/>

			<div className="absolute inset-0 flex flex-row items-stretch">
				<div className="flex flex-col flex-1 min-w-0">
					<div className="absolute top-6 left-8 z-50">
						<PlayerList players={players} onAddFriend={(id) => console.log("add friend", id)} />
					</div>
					<Visualizer noteLines={noteLines} />
					<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={handleLocalPlay} onStopNote={handleLocalStop} />
				</div>

				{isChatOpen && chatTopPx > 0 && (
					<div
						className="flex flex-col border-l border-white/8 bg-[#0a0118]/80 backdrop-blur-xl"
						style={{
							width: "300px",
							flexShrink: 0,
							marginTop: `${chatTopPx}px`,
							zIndex: 60,
						}}
					>
						<ChatPanel
							messages={messages}
							myId={isLoggedIn ? user?.id || myTempId.current : myTempId.current}
							myName={myName}
							isLoggedIn={isLoggedIn}
							onSend={handleSendMessage}
							onClose={handleCloseChat}
							onLoginClick={handleLoginClick}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
