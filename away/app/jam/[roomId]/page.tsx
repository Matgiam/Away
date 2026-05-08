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
import { PLAYER_COLORS, getSolidColor } from "@/lib/playerColors";
import type { ChatMessage } from "@/hooks/useChat";

type PresencePlayer = {
	displayName: string;
	joinedAt: number;
};

type PlayerEntry = {
	id: string;
	displayName: string;
	colorIndex: number;
	isMe: boolean;
	isFriend: boolean;
};

async function decrementOrDelete(roomId: string) {
	const { data } = await supabase.from("rooms").select("current_players").eq("id", roomId).single();
	if (!data) return;
	if (data.current_players <= 1) {
		await supabase.from("rooms").delete().eq("id", roomId);
	} else {
		await supabase
			.from("rooms")
			.update({ current_players: data.current_players - 1 })
			.eq("id", roomId);
	}
}

export default function JamRoom() {
	const params = useParams();
	const router = useRouter();
	const roomId = params.roomId as string;

	const [showKeys, setShowKeys] = useState(true);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const pianoKeys = useMemo(() => generatePiano(), []);

	const myTempId = useRef(getOrCreatePlayerId());
	const joinedAtRef = useRef(Date.now());

	const {
		playNote,
		stopNote,
		unlockAudio,
		connectMIDI,
		releaseAllForPlayer,
		midiDevices,
		midiError,
		soundfonts,
		currentSoundfont,
		loadedSoundfonts,
		loadingSoundfont,
		selectSoundfont,
		masterVolume,
		setMasterVolume,
	} = useAudioEngine(pianoKeys, setNoteLines);

	const [user, setUser] = useState<any>(null);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [myName, setMyName] = useState(() => {
		if (typeof window === "undefined") return "";
		try {
			const saved = sessionStorage.getItem("away_user");
			if (saved) {
				const parsed = JSON.parse(saved);
				return parsed.username || parsed.email?.split("@")[0] || parsed.id?.substring(0, 8) || "";
			}
		} catch {}
		return "";
	});

	const [players, setPlayers] = useState<PlayerEntry[]>([]);
	const playersRef = useRef<PlayerEntry[]>([]);
	useEffect(() => {
		playersRef.current = players;
	}, [players]);

	const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
			(async () => {
				await decrementOrDelete(roomId);
				router.replace("/multiplayer");
			})();
			return;
		}
		const handleBeforeUnload = () => {
			sessionStorage.setItem(REFRESH_KEY, roomId);
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [roomId, router]);

	useEffect(() => {
		const checkUser = async () => {
			const supabaseClient = createClient();
			const { data } = await supabaseClient.auth.getUser();
			if (data.user) {
				setUser(data.user);
				setIsLoggedIn(true);
				const username =
					(data.user.user_metadata?.username as string | undefined) ||
					data.user.email?.split("@")[0] ||
					data.user.id.substring(0, 8);
				setMyName(username);
				sessionStorage.setItem(
					"away_user",
					JSON.stringify({ id: data.user.id, email: data.user.email, username }),
				);
			}
		};
		checkUser();
	}, []);

	const myNameRef = useRef(myName);
	useEffect(() => {
		myNameRef.current = myName;
		const channel = roomChannelRef.current;
		if (channel && myName) {
			channel.track({
				displayName: myName,
				joinedAt: joinedAtRef.current,
			});
		}
	}, [myName]);

	const myColorIndex = useMemo(() => players.findIndex((p) => p.id === myTempId.current), [players]);
	const myColor = useMemo(() => PLAYER_COLORS[Math.max(myColorIndex, 0) % PLAYER_COLORS.length], [myColorIndex]);
	const mySolidColor = useMemo(() => getSolidColor(Math.max(myColorIndex, 0)), [myColorIndex]);

	const myColorRef = useRef(myColor);
	const mySolidColorRef = useRef(mySolidColor);
	useEffect(() => {
		myColorRef.current = myColor;
	}, [myColor]);
	useEffect(() => {
		mySolidColorRef.current = mySolidColor;
	}, [mySolidColor]);

	const onReceivePeerNote = useCallback(
		(peerId: string, note: number, velocity: number, isNoteOn: boolean) => {
			const player = playersRef.current.find((p) => p.id === peerId);
			const colorIndex = player?.colorIndex ?? 0;
			const peerColor = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
			const peerSolid = getSolidColor(colorIndex);
			if (isNoteOn) {
				playNote(note, velocity, peerId, peerColor, peerSolid);
			} else {
				stopNote(note, peerId);
			}
		},
		[playNote, stopNote],
	);

	const { initiateConnection, handleOffer, handleAnswer, handleCandidate, removePeer, broadcastNote, hasPeer, knownPeerIds } = useWebRTC(
		myTempId.current,
		onReceivePeerNote,
	);

	const handleLocalPlay = useCallback(
		(note: number, velocity: number = 127) => {
			playNote(note, velocity, "self", myColorRef.current, mySolidColorRef.current);
			broadcastNote(note, velocity, true);
		},
		[playNote, broadcastNote],
	);

	const handleLocalStop = useCallback(
		(note: number) => {
			stopNote(note, "self");
			broadcastNote(note, 0, false);
		},
		[stopNote, broadcastNote],
	);

	const { messages, isChatOpen, setIsChatOpen, addMessage } = useChat(myTempId.current);

	const handleLoginClick = useCallback(() => {
		sessionStorage.setItem("redirect_after_login", `/jam/${roomId}`);
		router.push("/auth/login");
	}, [router, roomId]);

	const handleOpenChat = useCallback(() => setIsChatOpen(true), [setIsChatOpen]);
	const handleCloseChat = useCallback(() => setIsChatOpen(false), [setIsChatOpen]);

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

	const initiateConnectionRef = useRef(initiateConnection);
	const handleOfferRef = useRef(handleOffer);
	const handleAnswerRef = useRef(handleAnswer);
	const handleCandidateRef = useRef(handleCandidate);
	const removePeerRef = useRef(removePeer);
	const hasPeerRef = useRef(hasPeer);
	const knownPeerIdsRef = useRef(knownPeerIds);
	const releaseAllForPlayerRef = useRef(releaseAllForPlayer);
	const handleLocalPlayRef = useRef(handleLocalPlay);
	const handleLocalStopRef = useRef(handleLocalStop);
	const connectMIDIRef = useRef(connectMIDI);
	const addMessageRef = useRef(addMessage);

	useEffect(() => {
		initiateConnectionRef.current = initiateConnection;
	}, [initiateConnection]);
	useEffect(() => {
		handleOfferRef.current = handleOffer;
	}, [handleOffer]);
	useEffect(() => {
		handleAnswerRef.current = handleAnswer;
	}, [handleAnswer]);
	useEffect(() => {
		handleCandidateRef.current = handleCandidate;
	}, [handleCandidate]);
	useEffect(() => {
		removePeerRef.current = removePeer;
	}, [removePeer]);
	useEffect(() => {
		hasPeerRef.current = hasPeer;
	}, [hasPeer]);
	useEffect(() => {
		knownPeerIdsRef.current = knownPeerIds;
	}, [knownPeerIds]);
	useEffect(() => {
		releaseAllForPlayerRef.current = releaseAllForPlayer;
	}, [releaseAllForPlayer]);
	useEffect(() => {
		handleLocalPlayRef.current = handleLocalPlay;
	}, [handleLocalPlay]);
	useEffect(() => {
		handleLocalStopRef.current = handleLocalStop;
	}, [handleLocalStop]);
	useEffect(() => {
		connectMIDIRef.current = connectMIDI;
	}, [connectMIDI]);
	useEffect(() => {
		addMessageRef.current = addMessage;
	}, [addMessage]);

	useEffect(() => {
		unlockAudio();
		connectMIDIRef.current(
			(note, vel) => handleLocalPlayRef.current(note, vel),
			(note) => handleLocalStopRef.current(note),
		);
	}, [unlockAudio]);

	useEffect(() => {
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
			if (payload.targetId && payload.targetId !== myTempId.current) return;

			const senderId = payload.senderId as string;
			if (payload.type === "offer") {
				await handleOfferRef.current(senderId, payload.offer, sendSignal);
			} else if (payload.type === "answer") {
				await handleAnswerRef.current(senderId, payload.answer);
			} else if (payload.type === "candidate") {
				await handleCandidateRef.current(senderId, payload.candidate);
			}
		});

		room.on("broadcast", { event: "chat-message" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			addMessageRef.current(payload as ChatMessage);
		});

		room.on("presence", { event: "sync" }, () => {
			const state = room.presenceState<PresencePlayer>();

			const entries = Object.entries(state).map(([userId, presences]) => {
				const data = presences[0] as PresencePlayer;
				return {
					id: userId,
					displayName: data?.displayName || userId,
					joinedAt: data?.joinedAt ?? 0,
				};
			});

			entries.sort((a, b) => a.joinedAt - b.joinedAt);

			const newPlayers: PlayerEntry[] = entries.map((e, index) => ({
				id: e.id,
				displayName: e.displayName,
				colorIndex: index,
				isMe: e.id === myTempId.current,
				isFriend: false,
			}));
			setPlayers(newPlayers);

			const presentIds = new Set(newPlayers.map((p) => p.id));

			newPlayers.forEach((p) => {
				if (p.id === myTempId.current) return;
				if (hasPeerRef.current(p.id)) return;
				if (myTempId.current < p.id) {
					initiateConnectionRef.current(p.id, sendSignal);
				}
			});

			knownPeerIdsRef.current().forEach((pid) => {
				if (!presentIds.has(pid)) {
					releaseAllForPlayerRef.current(pid);
					removePeerRef.current(pid);
				}
			});
		});

		room.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				await room.track({
					displayName: myNameRef.current || myTempId.current,
					joinedAt: joinedAtRef.current,
				});
			}
		});

		return () => {
			roomChannelRef.current = null;
			try {
				room.untrack();
			} catch {}
			supabase.removeChannel(room);
		};
	}, [roomId]);

	const handleLeave = useCallback(async () => {
		await decrementOrDelete(roomId);
		sessionStorage.removeItem("hostedRoomId");
		router.push("/multiplayer");
	}, [roomId, router]);

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative" onClick={handleClick}>
			<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />

			<Navigation
				onLogout={handleLeave}
				isChatOpen={isChatOpen}
				onToggleChat={isChatOpen ? handleCloseChat : handleOpenChat}
				chatAnchorRef={chatAnchorRef}
				midiDevices={midiDevices}
				midiError={midiError}
				onRetryMidi={() =>
					connectMIDIRef.current(
						(note, vel) => handleLocalPlayRef.current(note, vel),
						(note) => handleLocalStopRef.current(note),
					)
				}
				soundfonts={soundfonts}
				currentSoundfont={currentSoundfont}
				loadedSoundfonts={loadedSoundfonts}
				loadingSoundfont={loadingSoundfont}
				onSelectSoundfont={selectSoundfont}
				masterVolume={masterVolume}
				onMasterVolumeChange={setMasterVolume}
				username={myName}
				onUsernameChange={setMyName}
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
