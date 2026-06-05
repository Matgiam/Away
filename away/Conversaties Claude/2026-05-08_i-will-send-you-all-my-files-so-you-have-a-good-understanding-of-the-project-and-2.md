# i will send you all my files so you have a good understanding of the project and then i will tell you about my issues: "

*Started: 2026-05-08 15:34 UTC*

## User

Hey so i am building a webapplication where you can play piano in solo or multiplayer mode. i will send you all my files so you have a good understanding of the project and then i will tell you about my issues: "use client";

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
	const [myName, setMyName] = useState("");

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
				const name = data.user.email?.split("@")[0] || data.user.id.substring(0, 8);
				setMyName(name);
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
}"use client";

import { SilkBackground } from "@/components/effects/SilkBackground";
import { useRooms } from "@/hooks/useRooms";
import { useCreateRoom } from "@/hooks/useCreateRoom";
import { useJoinRoom } from "@/hooks/useJoinRoom";
import BackButton from "@/components/multiplayer/BackButton";
import RoomList from "@/components/multiplayer/RoomList";
import CreateRoomModal from "@/components/multiplayer/CreateRoomModal";
import JoinRoomModal from "@/components/multiplayer/JoinRoomModal";

export default function MultiplayerLobby() {
	const { filter, setFilter, filteredRooms } = useRooms();
	const createRoomProps = useCreateRoom();
	const joinRoomProps = useJoinRoom();

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative">
			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />
			<BackButton />
			<div className="absolute inset-0 z-10 flex flex-col mt-30">
				<RoomList
					filter={filter}
					setFilter={setFilter}
					filteredRooms={filteredRooms}
					setShowCreate={createRoomProps.setShowCreate}
					handleJoinRoom={joinRoomProps.handleJoinRoom}
				/>
			</div>

			<CreateRoomModal {...createRoomProps} />
			<JoinRoomModal {...joinRoomProps} />
		</div>
	);
}
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
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

export default function App() {
	const [showKeys, setShowKeys] = useState(true);
	const [noteLines, setNoteLines] = useState<VisNote[]>([]);
	const [showHomeScreen, setShowHomeScreen] = useState(true);
	const pianoKeys = useMemo(() => generatePiano(), []);

	const router = useRouter();

	const {
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
	} = useAudioEngine(pianoKeys, setNoteLines);

	const handleMultiplayerClick = () => router.push("/multiplayer");
	const handleProfileClick = () => router.push("/protected/profile");

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
						<Navigation
							onLogout={() => setShowHomeScreen(true)}
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
						/>
						<Visualizer noteLines={noteLines} />
						<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={playNote} onStopNote={stopNote} />
					</div>
				</>
			)}
		</div>
	);
}"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/hooks/useChat";

interface ChatPanelProps {
  messages: ChatMessage[];
  myId: string;
  myName: string;
  isLoggedIn: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  onLoginClick: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, myId, myName, isLoggedIn, onSend, onClose, onLoginClick }) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div
      className="flex flex-col h-full border-l border-white/8 bg-[#0a0118]/80 backdrop-blur-xl relative z-6000"
      style={{ width: "300px", flexShrink: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <span className="text-white/60 text-xs uppercase tracking-widest font-medium">Live Chat</span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages Area - Always Visible */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && <p className="text-white/20 text-xs text-center mt-8">No messages yet. Say something!</p>}
        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-white/30 font-mono px-1">{isMe ? myName || "You" : msg.senderName}</span>
              <div
                className={`px-3 py-2 rounded-xl text-sm max-w-[220px] break-words leading-relaxed ${
                  isMe ? "bg-white/10 text-white rounded-tr-none" : "bg-white/5 text-white/80 rounded-tl-none border border-white/8"
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Conditionally Render Input OR Login Button */}
      <div className="px-4 py-4 border-t border-white/8">
        {isLoggedIn ? (
          <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/8 px-3 py-2 focus-within:border-white/20 transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type message here"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none"
            />
            <button onClick={handleSend} disabled={!input.trim()} className="text-white/30 hover:text-white transition-colors disabled:opacity-20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-2">
            <p className="text-white/40 text-xs">You need to be logged in to chat</p>
            <button
              onClick={onLoginClick}
              className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors"
            >
              Log in to send messages
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import type { SoundfontOption } from "@/hooks/useAudioEngine";

type TabKey = "General" | "MIDI" | "Keyboard" | "Visualisation";

const TABS: TabKey[] = ["General", "MIDI", "Keyboard", "Visualisation"];

interface NavigationProps {
	onLogout?: () => void;
	isChatOpen?: boolean;
	onToggleChat?: () => void;
	chatAnchorRef?: React.RefObject<HTMLDivElement | null>;
	midiDevices?: string[];
	midiError?: string | null;
	onRetryMidi?: () => void;
	soundfonts?: SoundfontOption[];
	currentSoundfont?: string;
	loadedSoundfonts?: string[];
	loadingSoundfont?: string | null;
	onSelectSoundfont?: (key: string) => void;
	masterVolume?: number;
	onMasterVolumeChange?: (v: number) => void;
	username?: string;
	onUsernameChange?: (name: string) => void;
	onToggleRecord?: () => void;
	isRecording?: boolean;
}

const SpeakerIcon = ({ muted }: { muted?: boolean }) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white/70">
		<path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
		{!muted && (
			<>
				<path d="M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" />
				<path d="M19.07 4.93a10 10 0 010 14.14" strokeLinecap="round" />
			</>
		)}
	</svg>
);

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
	<button
		onClick={() => onChange(!value)}
		className={`relative w-14 h-7 rounded-full transition-colors ${value ? "bg-purple-500" : "bg-white/10 border border-white/15"}`}
	>
		<span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${value ? "translate-x-7" : "translate-x-0.5"}`} />
	</button>
);

export const Navigation = ({
	onLogout,
	isChatOpen,
	onToggleChat,
	chatAnchorRef,
	midiDevices = [],
	midiError = null,
	onRetryMidi,
	soundfonts = [],
	currentSoundfont,
	loadedSoundfonts = [],
	loadingSoundfont = null,
	onSelectSoundfont,
	masterVolume = 75,
	onMasterVolumeChange,
	username = "",
	onUsernameChange,
	onToggleRecord,
	isRecording = false,
}: NavigationProps) => {
	const [showSettings, setShowSettings] = useState(false);
	const [activeTab, setActiveTab] = useState<TabKey>("General");
	const [usernameDraft, setUsernameDraft] = useState(username);
	const [invisibleMode, setInvisibleMode] = useState(false);

	useEffect(() => {
		setUsernameDraft(username);
	}, [username]);

	const currentName = soundfonts.find((s) => s.key === currentSoundfont)?.name || "Salamander Grand Piano";

	const openSettings = () => {
		setShowSettings(true);
		onRetryMidi?.();
	};
	const closeSettings = () => setShowSettings(false);

	const handleApplyUsername = () => {
		const trimmed = usernameDraft.trim();
		if (trimmed && trimmed !== username) onUsernameChange?.(trimmed);
	};

	return (
		<>
			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}>
				<div className="flex flex-col items-center">
					<DynamicLiquidGlass width={290} height={60} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
						<h1 className="text-white font-semibold tracking-wide text-lg pointer-events-none truncate px-3">
							{loadingSoundfont === currentSoundfont ? "Loading…" : currentName}
						</h1>
					</DynamicLiquidGlass>
				</div>
			</div>

			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}>
				<div className="flex gap-6 items-center">
					<div onClick={onToggleRecord} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isRecording ? 0.2 : 0.001}
							blur={2}
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="51" height="51" viewBox="0 0 51 51" fill="none">
								<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" />
								<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill="#AA0000" />
							</svg>
						</DynamicLiquidGlass>
					</div>

					<div onClick={openSettings} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass
							width={67}
							height={67}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={showSettings ? 0.15 : 0.001}
						>
							<img src="/icons/Wrench.svg" alt="Settings" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
					</div>

					<div onClick={onLogout} className="cursor-pointer" style={{ pointerEvents: "auto" }}>
						<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
							<img src="/icons/Logout.svg" alt="Logout" style={{ width: "35px", height: "35px", objectFit: "contain" }} />
						</DynamicLiquidGlass>
					</div>
				</div>

				{onToggleChat && !isChatOpen && (
					<div onClick={onToggleChat} className="cursor-pointer relative mt-5">
						<DynamicLiquidGlass
							width={160}
							height={60}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isChatOpen ? 0.15 : 0.001}
						>
							<div className="w-full h-full text-xl flex items-center justify-center text-white gap-2">
								Open chat
								<img src="/icons/message.svg" alt="" />
							</div>
						</DynamicLiquidGlass>
					</div>
				)}

				<div ref={chatAnchorRef} style={{ height: 0 }} />
			</div>

			{showSettings && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeSettings}>
					<div
						onClick={(e) => e.stopPropagation()}
						className="w-full max-w-5xl mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex"
						style={{ height: "80vh", maxHeight: "650px" }}
					>
						<aside className="w-64 shrink-0 border-r border-white/10 px-8 py-10 flex flex-col">
							<h2 className="text-white text-4xl font-light italic mb-14">Settings</h2>
							<nav className="flex flex-col gap-5">
								{TABS.map((tab) => (
									<button
										key={tab}
										onClick={() => setActiveTab(tab)}
										className={`text-xl italic text-left transition-colors ${
											activeTab === tab ? "text-white font-medium" : "text-white/30 hover:text-white/60"
										}`}
									>
										{tab}
									</button>
								))}
							</nav>
						</aside>

						<div className="flex-1 px-12 py-10 overflow-y-auto relative">
							<button
								onClick={closeSettings}
								className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
								aria-label="Close"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>

							{activeTab === "General" && (
								<div className="flex flex-col gap-10 max-w-2xl pt-4">
									<div className="flex items-center gap-5">
										<label className="text-white text-lg italic whitespace-nowrap">
											Master volume <span className="font-bold not-italic ml-2">{masterVolume}%</span>
										</label>
										<SpeakerIcon muted={masterVolume === 0} />
										<input
											type="range"
											min={0}
											max={100}
											value={masterVolume}
											onChange={(e) => onMasterVolumeChange?.(Number(e.target.value))}
											className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
										/>
									</div>

									<div className="flex items-center gap-4">
										<input
											type="text"
											value={usernameDraft}
											onChange={(e) => setUsernameDraft(e.target.value)}
											placeholder="Username"
											className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white italic outline-none focus:border-white/25 transition-colors"
										/>
										<button
											onClick={handleApplyUsername}
											className="px-5 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white italic hover:bg-white/10 transition-colors whitespace-nowrap"
										>
											Change username
										</button>
									</div>

									<div className="flex items-center justify-between pt-2">
										<label className="text-white text-lg italic">Invisible mode</label>
										<Toggle value={invisibleMode} onChange={setInvisibleMode} />
									</div>
								</div>
							)}

							{activeTab === "MIDI" && (
								<div className="flex flex-col gap-4 max-w-2xl pt-4">
									<div className="flex items-center justify-between">
										<span className="text-white/60 text-xs uppercase tracking-widest font-medium">MIDI Inputs</span>
										<button
											onClick={() => onRetryMidi?.()}
											className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
										>
											Refresh
										</button>
									</div>

									{midiError && (
										<div className="text-xs text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 leading-relaxed">
											{midiError}
										</div>
									)}

									{midiDevices.length === 0 && !midiError && (
										<p className="text-white/40 text-sm">No MIDI devices detected. Plug in your keyboard via USB and click Refresh.</p>
									)}

									{midiDevices.length > 0 && (
										<ul className="space-y-2">
											{midiDevices.map((d, i) => (
												<li
													key={`${d}-${i}`}
													className="flex items-center gap-3 text-white text-sm bg-white/5 border border-white/10 rounded-lg px-4 py-3"
												>
													<span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
													<span className="truncate">{d}</span>
												</li>
											))}
										</ul>
									)}

									<p className="text-[10px] text-white/30 leading-relaxed mt-2">
										Brave: enable MIDI at brave://settings/content/midiSysex and reload.
									</p>
								</div>
							)}

							{activeTab === "Keyboard" && (
								<div className="flex flex-col gap-3 max-w-2xl pt-4">
									<span className="text-white/60 text-xs uppercase tracking-widest font-medium mb-1">Soundfont</span>
									<ul className="space-y-2">
										{soundfonts.map((sf) => {
											const isActive = sf.key === currentSoundfont;
											const isLoaded = loadedSoundfonts.includes(sf.key);
											const isLoading = loadingSoundfont === sf.key;
											const dotClass = isActive
												? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
												: isLoaded
													? "bg-blue-400"
													: isLoading
														? "bg-yellow-400 animate-pulse"
														: "bg-white/20";
											const action = isActive ? "Active" : isLoading ? "Loading…" : isLoaded ? "Use" : "Load";

											return (
												<li key={sf.key}>
													<button
														onClick={() => onSelectSoundfont?.(sf.key)}
														disabled={isActive || isLoading}
														className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors ${
															isActive
																? "bg-white/10 border-white/25 text-white cursor-default"
																: "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
														} disabled:cursor-not-allowed`}
													>
														<div className="flex items-center gap-3 min-w-0">
															<span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
															<span className="text-sm truncate">{sf.name}</span>
														</div>
														<span
															className={`text-xs font-medium px-2 py-1 rounded ${
																isActive
																	? "bg-green-500/20 text-green-300"
																	: isLoading
																		? "bg-yellow-500/20 text-yellow-300"
																		: isLoaded
																			? "bg-blue-500/20 text-blue-300"
																			: "bg-white/10 text-white/60"
															}`}
														>
															{action}
														</span>
													</button>
												</li>
											);
										})}
									</ul>
								</div>
							)}

							{activeTab === "Visualisation" && (
								<div className="flex flex-col gap-4 max-w-2xl pt-4">
									<p className="text-white/40 italic text-sm">Visualisation settings coming soon.</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
};
"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { PianoKey } from "@/lib/types";

interface PianoProps {
	pianoKeys: PianoKey[];
	showKeys: boolean;
	onPlayNote: (midi: number, velocity: number) => void;
	onStopNote: (midi: number) => void;
}

export const Piano: React.FC<PianoProps> = ({ pianoKeys, showKeys, onPlayNote, onStopNote }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const isMouseDown = useRef(false);
	const activeKeyRef = useRef<number | null>(null);

	const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys]);
	const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys]);

	const startKey = useCallback(
		(midi: number) => {
			if (activeKeyRef.current === midi) return;
			if (activeKeyRef.current !== null) onStopNote(activeKeyRef.current);
			onPlayNote(midi, 127);
			activeKeyRef.current = midi;
		},
		[onPlayNote, onStopNote],
	);

	const stopActiveKey = useCallback(() => {
		if (activeKeyRef.current !== null) {
			onStopNote(activeKeyRef.current);
			activeKeyRef.current = null;
		}
	}, [onStopNote]);

	const hitTest = useCallback(
		(clientX: number, clientY: number) => {
			const els = document.elementsFromPoint(clientX, clientY);
			for (const el of els) {
				if (!(el instanceof HTMLElement)) continue;
				const midiAttr = el.getAttribute("data-midi");
				if (midiAttr) {
					const midi = parseInt(midiAttr, 10);
					if (!Number.isNaN(midi)) {
						startKey(midi);
						return;
					}
				}
			}
		},
		[startKey],
	);

	useEffect(() => {
		const handleMouseUp = () => {
			isMouseDown.current = false;
			stopActiveKey();
		};
		const handleMouseMove = (e: MouseEvent) => {
			if (!isMouseDown.current) return;
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();
			if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
				stopActiveKey();
				return;
			}
			hitTest(e.clientX, e.clientY);
		};
		window.addEventListener("mouseup", handleMouseUp);
		window.addEventListener("mousemove", handleMouseMove);
		return () => {
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, [hitTest, stopActiveKey]);

	const handleKeyMouseDown = useCallback(
		(midi: number) => {
			isMouseDown.current = true;
			startKey(midi);
		},
		[startKey],
	);

	const blackKeyWidthPct = (100 / 52) * 0.6;

	return (
		<div
			ref={containerRef}
			className="myPiano w-full bg-[#111] relative select-none z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5"
			style={{ height: "150px", flexShrink: 0 }}
		>
			<div className="white-keys-container">
				{whiteKeys.map((key) => (
					<div
						key={key.midi}
						data-midi={key.midi}
						onMouseDown={() => handleKeyMouseDown(key.midi)}
						className="piano-key white"
						style={{ pointerEvents: "auto" }}
					/>
				))}
			</div>

			<div className="black-keys-container absolute top-0 left-0 w-full h-full" style={{ pointerEvents: "none" }}>
				{blackKeys.map((key) => {
					const center = ((key.whiteKeyIndex + 1) * 100) / 52;
					const left = center - blackKeyWidthPct / 2;
					return (
						<div
							key={key.midi}
							data-midi={key.midi}
							onMouseDown={() => handleKeyMouseDown(key.midi)}
							style={{ left: `${left}%`, pointerEvents: "auto" }}
							className="piano-key black"
						/>
					);
				})}
			</div>
		</div>
	);
};
"use client";

import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

interface Player {
	id: string;
	displayName: string;
	colorIndex: number;
	isMe: boolean;
	isFriend?: boolean;
}

interface PlayerListProps {
	players: Player[];
	onAddFriend?: (id: string) => void;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, onAddFriend }) => {
	return (
		<div className="flex flex-col gap-4">
			{players.map((player) => (
				<div key={player.id} className="flex flex-col gap-1.5">
					<div className="flex items-center gap-3">
						<span className="text-white font-bold text-base tracking-wide">{player.isMe ? player.displayName : player.displayName}</span>

						{!player.isMe && player.isFriend && (
							<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-5 h-5 opacity-60">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
							</svg>
						)}

						{!player.isMe && !player.isFriend && onAddFriend && (
							<button
								onClick={() => onAddFriend(player.id)}
								className="flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors text-sm"
							>
								<span className="text-lg leading-none">+</span>
								<span>Add friend</span>
							</button>
						)}
					</div>

					<div
						className="h-3.5 rounded-full"
						style={{
							width: "160px",
							backgroundColor: PLAYER_COLORS_SOLID[player.colorIndex % PLAYER_COLORS_SOLID.length],
							opacity: 0.8,
						}}
					/>
				</div>
			))}
		</div>
	);
};
import { AccessIcon } from "@/components/ui/AccessIcon";
import type { Room, Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
import { useState } from "react";

interface RoomListProps {
	filter: Accessibility;
	setFilter: (filter: Accessibility) => void;
	filteredRooms: Room[];
	setShowCreate: (show: boolean) => void;
	handleJoinRoom: (room: Room) => void;
}

export default function RoomList({ filter, setFilter, filteredRooms, setShowCreate, handleJoinRoom }: RoomListProps) {
	const [isHovered, setIsHovered] = useState(false);
	return (
		<div className="flex flex-col items-center justify-center px-8">
			<div className="w-full max-w-5xl flex items-center justify-between mb-25">
				<button onClick={() => setShowCreate(true)}>
					<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
						<DynamicLiquidGlass
							width={198}
							height={69}
							radius={15}
							refractionLevel={0.8}
							specularOpacity={0.7}
							glassBgOpacity={isHovered ? 0.15 : 0.001}
						>
							<div className="w-full h-full text-xl flex items-center justify-center text-white">Create Room</div>
						</DynamicLiquidGlass>
					</div>
				</button>

				<div className="flex gap-2">
					{(["public", "private", "friends"] as const).map((type) => (
						<button key={type} onClick={() => setFilter(type)} className="hover:opacity-80 transition-opacity">
							<AccessIcon type={type} />
						</button>
					))}
				</div>
			</div>
			<div
				className="w-full max-w-6xl flex flex-col gap-4 relative custom-scrollbar"
				style={{ maxHeight: "65vh", overflowY: "auto", padding: "10px", paddingRight: "15px" }}
			>
				{filteredRooms.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-white">
						<p className="text-sm">No rooms yet. Be the first to create one.</p>
					</div>
				) : (
					filteredRooms.map((room) => {
						const isFull = room.current_players >= room.max_players;
						return (
							<div key={room.id} className="flex justify-center w-full">
								<DynamicLiquidGlass width={1030} height={90} radius={10} refractionLevel={0.8} specularOpacity={0.5} glassBgOpacity={0.001}>
									<div
										onClick={() => !isFull && handleJoinRoom(room)}
										className={`flex items-center justify-between w-full h-full  cursor-pointer rounded-2xl transition-colors group ${
											isFull ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"
										}`}
									>
										<DynamicLiquidGlass width={157} height={90} radius={10} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
											{room.host}
										</DynamicLiquidGlass>

										<div className="flex-1 px-8 text-lg font-semibold italic text-white/90 group-hover:text-white transition-colors truncate text-center">
											{room.name}
										</div>

										<div className="flex items-center gap-6 shrink-0 text-white mt-10">
											<div className="flex flex-col items-center gap-2">
												<AccessIcon type={room.accessibility} glass={false} text={false} />
												<DynamicLiquidGlass width={107} height={46} radius={10} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}>
													<div className="text-s font-mono flex items-start gap-1 mb-3">
														<img src="/icons/Person.svg" alt="" />
														<h2>
															{room.current_players}/{room.max_players}
														</h2>
													</div>
												</DynamicLiquidGlass>
											</div>
										</div>
									</div>
								</DynamicLiquidGlass>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}"use client";

import { useRef, useEffect } from "react";
import { VisNote } from "@/lib/types";

interface VisualizerProps {
	noteLines: VisNote[];
	className?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ noteLines, className = "" }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const noteLinesRef = useRef<VisNote[]>([]);
	useEffect(() => {
		noteLinesRef.current = noteLines;
	}, [noteLines]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;
		const speed = 0.4;

		const resizeCanvas = () => {
			const parent = canvas.parentElement;
			if (!parent) return;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = parent.clientWidth * dpr;
			canvas.height = parent.clientHeight * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		window.addEventListener("resize", resizeCanvas);
		const resizeObserver = new ResizeObserver(resizeCanvas);
		resizeObserver.observe(canvas.parentElement!);
		resizeCanvas();

		const WHITE_NOTE_RATIO = 0.9;
		const BLACK_NOTE_RATIO = 0.6;

		const draw = () => {
			const width = canvas.offsetWidth;
			const height = canvas.offsetHeight;
			const now = performance.now();

			ctx.clearRect(0, 0, width, height);

			const whiteKeyWidth = width / 52;
			const whiteNoteWidth = whiteKeyWidth * WHITE_NOTE_RATIO;
			const whiteSideMargin = (whiteKeyWidth - whiteNoteWidth) / 2;
			const blackNoteWidth = whiteKeyWidth * BLACK_NOTE_RATIO;

			for (let i = 0; i < noteLinesRef.current.length; i++) {
				const note = noteLinesRef.current[i];

				const yEnd = height - (now - note.startTime) * speed;
				const yStart = note.endTime ? height - (now - note.endTime) * speed : height;
				const noteHeight = Math.max(yStart - yEnd, 8);

				if (yStart < -100) continue;

				let x: number, w: number;
				if (note.isBlack) {
					w = blackNoteWidth;
					x = (note.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteNoteWidth;
					x = note.whiteKeyIndex * whiteKeyWidth + whiteSideMargin;
				}

				ctx.fillStyle = note.color;
				ctx.beginPath();
				if (ctx.roundRect) {
					ctx.roundRect(x, yEnd, w, noteHeight, [6, 6, 6, 6]);
				} else {
					ctx.rect(x, yEnd, w, noteHeight);
				}
				ctx.fill();
			}

			animationFrameId = requestAnimationFrame(draw);
		};

		draw();

		return () => {
			window.removeEventListener("resize", resizeCanvas);
			resizeObserver.disconnect();
			cancelAnimationFrame(animationFrameId);
		};
	}, []);

	return (
		<div className={`relative z-10 w-full h-full ${className}`}>
			<canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
		</div>
	);
};export { useChat } from "./useChat";

"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, instruments, DEFAULT_SOUNDFONT } from "../lib/types";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

const SELF = "self";
const DEFAULT_VOLUME_PERCENT = 75;

export type SoundfontOption = { key: string; name: string };

function percentToDb(percent: number): number {
	if (percent <= 0) return -60;
	return -40 + (percent / 100) * 46;
}

export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	const audioStartedRef = useRef(false);
	const samplersRef = useRef<Map<string, Tone.Sampler>>(new Map());
	const samplerRef = useRef<Tone.Sampler | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

	const noteHoldersRef = useRef<Map<number, Set<string>>>(new Map());
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);
	const initializedRef = useRef(false);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);

	const [currentSoundfont, setCurrentSoundfont] = useState<string>(DEFAULT_SOUNDFONT);
	const [loadedSoundfonts, setLoadedSoundfonts] = useState<string[]>([]);
	const [loadingSoundfont, setLoadingSoundfont] = useState<string | null>(null);

	const [masterVolume, setMasterVolumeState] = useState<number>(DEFAULT_VOLUME_PERCENT);

	const setMasterVolume = useCallback((percent: number) => {
		const clamped = Math.max(0, Math.min(100, percent));
		setMasterVolumeState(clamped);
		if (masterVolumeNodeRef.current) {
			masterVolumeNodeRef.current.mute = clamped === 0;
			masterVolumeNodeRef.current.volume.rampTo(percentToDb(clamped), 0.02);
		}
	}, []);

	const soundfonts: SoundfontOption[] = Object.entries(instruments).map(([key, val]) => ({
		key,
		name: val.name,
	}));

	const unlockAudio = useCallback(async () => {
		if (audioStartedRef.current) return;
		try {
			await Tone.start();
			audioStartedRef.current = true;
		} catch (error) {
			console.error("Browser blocked audio start:", error);
		}
	}, []);

	const playNote = useCallback(
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorOverride?: string, solidColorOverride?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Set();
				noteHoldersRef.current.set(midi, holders);
			}
			if (holders.has(playerId)) return;
			holders.add(playerId);
			sustainedNotesRef.current.delete(midi);

			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
			if (keyEl) {
				const solidColor = solidColorOverride ?? PLAYER_COLORS_SOLID[0];
				keyEl.style.setProperty("--active-color", solidColor);
				keyEl.classList.add("active");
			}

			const normalizedVel = vel > 1 ? vel / 127 : vel;

			if (audioStartedRef.current && samplerRef.current && samplerRef.current.loaded) {
				samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), normalizedVel);
			}

			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			if (keyInfo) {
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (keyInfo.isBlack) {
					w = whiteKeyWidth * 0.6;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth;
				}

				const noteColor = colorOverride ?? keyInfo.color;

				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: performance.now(),
					endTime: null,
					isBlack: keyInfo.isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: noteColor,
					x,
					w,
					playerId,
				};

				visNotesRef.current.push(newNote);
				setNoteLines([...visNotesRef.current]);
			}
		},
		[pianoKeys, setNoteLines],
	);

	const stopNote = useCallback((midi: number, playerId: string = SELF) => {
		const holders = noteHoldersRef.current.get(midi);
		if (!holders || !holders.has(playerId)) return;
		holders.delete(playerId);

		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId);
		if (pendingNote) pendingNote.endTime = performance.now();

		if (holders.size === 0) {
			noteHoldersRef.current.delete(midi);
			const keyEl = document.querySelector(`[data-midi="${midi}"]`);
			keyEl?.classList.remove("active");

			if (isSustainOnRef.current) {
				sustainedNotesRef.current.add(midi);
			} else if (samplerRef.current) {
				samplerRef.current.triggerRelease(Tone.Frequency(midi, "midi").toNote(), Tone.immediate());
			}
		}
	}, []);

	const releaseAllForPlayer = useCallback(
		(playerId: string) => {
			const midis: number[] = [];
			noteHoldersRef.current.forEach((holders, midi) => {
				if (holders.has(playerId)) midis.push(midi);
			});
			midis.forEach((m) => stopNote(m, playerId));
		},
		[stopNote],
	);

	const loadSoundfont = useCallback((key: string): Promise<void> => {
		return new Promise((resolve, reject) => {
			if (!instruments[key]) return reject(new Error("Unknown soundfont"));
			if (samplersRef.current.has(key)) return resolve();
			if (!reverbRef.current) return reject(new Error("Audio not initialized"));

			setLoadingSoundfont(key);
			const sampler = createSampler(key, () => {
				setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key]));
				setLoadingSoundfont((prev) => (prev === key ? null : prev));
				resolve();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(key, sampler);
		});
	}, []);

	const selectSoundfont = useCallback(
		async (key: string) => {
			if (!instruments[key]) return;
			if (!samplersRef.current.has(key)) {
				try {
					await loadSoundfont(key);
				} catch {
					return;
				}
			}
			const next = samplersRef.current.get(key);
			if (next) {
				samplerRef.current = next;
				setCurrentSoundfont(key);
			}
		},
		[loadSoundfont],
	);

	const connectMIDI = useCallback(
		(onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v), onStop: (note: number) => void = (n) => stopNote(n)) => {
			const nav = navigator as any;
			if (!nav.requestMIDIAccess) {
				setMidiError("Web MIDI is not enabled in this browser. In Brave, open brave://settings/content/midiSysex and enable MIDI for this site.");
				setMidiDevices([]);
				return;
			}
			nav
				.requestMIDIAccess({ sysex: false })
				.then((m: any) => {
					setMidiError(null);
					const refresh = () => {
						const names: string[] = [];
						m.inputs.forEach((i: any) => {
							names.push(i.name || "Unknown MIDI device");
							i.onmidimessage = (msg: any) => {
								unlockAudio();
								const [cmd, note, vel] = msg.data;
								const command = cmd >> 4;

								if (command === 11 && note === 64) {
									const pedalPressed = vel >= 64;
									isSustainOnRef.current = pedalPressed;
									if (!pedalPressed) {
										sustainedNotesRef.current.forEach((sustainedMidi) => {
											samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
										});
										sustainedNotesRef.current.clear();
									}
								} else if (command === 9 && vel > 0) {
									onPlay(note, vel);
								} else if (command === 8 || (command === 9 && vel === 0)) {
									onStop(note);
								}
							};
						});
						setMidiDevices(names);
					};
					refresh();
					m.onstatechange = refresh;
				})
				.catch((err: any) => {
					setMidiError("MIDI access denied: " + (err?.message || String(err)));
					setMidiDevices([]);
				});
		},
		[playNote, stopNote, unlockAudio],
	);

	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const init = async () => {
			await initAudioContext();

			masterVolumeNodeRef.current = createMasterVolume(percentToDb(DEFAULT_VOLUME_PERCENT));
			reverbRef.current = createReverb(0.2, masterVolumeNodeRef.current);

			setLoadingSoundfont(DEFAULT_SOUNDFONT);
			const sampler = createSampler(DEFAULT_SOUNDFONT, () => {
				setLoadedSoundfonts([DEFAULT_SOUNDFONT]);
				setLoadingSoundfont(null);
				connectMIDI();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(DEFAULT_SOUNDFONT, sampler);
			samplerRef.current = sampler;
		};
		init();
	}, [connectMIDI]);

	return {
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
	};
};import { useState, useCallback } from "react";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

export function useChat(myId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    messages,
    isChatOpen,
    setIsChatOpen,
    addMessage,
  };
}
import { useState, useCallback } from "react";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

export function useChat(myId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    messages,
    isChatOpen,
    setIsChatOpen,
    addMessage,
  };
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Accessibility, Room, CreateStep } from "./useRooms";

export type { CreateStep };

export function getOrCreatePlayerId(): string {
	if (typeof window === "undefined") return "Player-0000";
	const existing = sessionStorage.getItem("playerId");
	if (existing) return existing;
	const newId = `Player-${Math.floor(Math.random() * 9000)}`;
	sessionStorage.setItem("playerId", newId);
	return newId;
}

export const myTempId = getOrCreatePlayerId();

export function useCreateRoom() {
	const router = useRouter();
	const [showCreate, setShowCreate] = useState(false);
	const [createStep, setCreateStep] = useState<CreateStep>("settings");
	const [accessibility, setAccessibility] = useState<Accessibility>("public");
	const [password, setPassword] = useState("");
	const [maxPlayers, setMaxPlayers] = useState(4);
	const [roomName, setRoomName] = useState("");

	const handleCreateRoom = async () => {
		if (!roomName.trim()) return;

		const roomId = Math.random().toString(36).substring(2, 7);
		const newRoom: Room = {
			id: roomId,
			name: roomName.trim(),
			host: myTempId,
			accessibility,
			password: accessibility === "private" ? password : null,
			max_players: maxPlayers,
			current_players: 1,
			created_at: new Date().toISOString(),
		};

		const { error } = await supabase.from("rooms").insert(newRoom);
		if (!error) {
			sessionStorage.setItem("hostedRoomId", roomId);
			router.push(`/jam/${roomId}`);
		}
	};

	const resetCreate = () => {
		setShowCreate(false);
		setCreateStep("settings");
		setAccessibility("public");
		setPassword("");
		setMaxPlayers(4);
		setRoomName("");
	};

	return {
		showCreate,
		setShowCreate,
		createStep,
		setCreateStep,
		accessibility,
		setAccessibility,
		password,
		setPassword,
		maxPlayers,
		setMaxPlayers,
		roomName,
		setRoomName,
		handleCreateRoom,
		resetCreate,
	};
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Room } from "./useRooms";

export function useJoinRoom() {
	const router = useRouter();
	const [joiningRoom, setJoiningRoom] = useState<Room | null>(null);
	const [joinPassword, setJoinPassword] = useState("");
	const [joinError, setJoinError] = useState("");

	const handleJoinRoom = async (room: Room) => {
		if (room.current_players >= room.max_players) return;

		if (room.accessibility === "private") {
			setJoiningRoom(room);
			return;
		}

		await supabase
			.from("rooms")
			.update({ current_players: room.current_players + 1 })
			.eq("id", room.id);

		router.push(`/jam/${room.id}`);
	};

	const handleJoinWithPassword = async () => {
		if (!joiningRoom) return;
		if (joinPassword !== joiningRoom.password) {
			setJoinError("Wrong password");
			return;
		}
		await supabase
			.from("rooms")
			.update({ current_players: joiningRoom.current_players + 1 })
			.eq("id", joiningRoom.id);

		router.push(`/jam/${joiningRoom.id}`);
	};

	const resetJoin = () => {
		setJoiningRoom(null);
		setJoinPassword("");
		setJoinError("");
	};

	return {
		joiningRoom,
		setJoiningRoom,
		joinPassword,
		setJoinPassword,
		joinError,
		setJoinError,
		handleJoinRoom,
		handleJoinWithPassword,
		resetJoin,
	};
}
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type Accessibility = "public" | "private" | "friends";

export type Room = {
	id: string;
	name: string;
	host: string;
	accessibility: Accessibility;
	password: string | null;
	max_players: number;
	current_players: number;
	created_at: string;
};

export type CreateStep = "settings" | "name";

export function useRooms() {
	const [rooms, setRooms] = useState<Room[]>([]);
	const [filter, setFilter] = useState<Accessibility>("public");

	const fetchRooms = useCallback(async () => {
		const { data } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
		if (data) setRooms(data);
	}, []);

	useEffect(() => {
		fetchRooms();

		const channel = supabase
			.channel("rooms-list")
			.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
				fetchRooms();
			})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [fetchRooms]);

	const filteredRooms = rooms.filter((r) => r.accessibility === filter);

	return { rooms, filter, setFilter, filteredRooms, fetchRooms };
}
import { useRef, useState, useCallback, useEffect } from "react";

type SignalPayload = {
	type: "offer" | "answer" | "candidate";
	targetId: string;
	offer?: RTCSessionDescriptionInit;
	answer?: RTCSessionDescriptionInit;
	candidate?: RTCIceCandidateInit;
};

type PeerInfo = {
	pc: RTCPeerConnection;
	dc: RTCDataChannel | null;
	iceQueue: RTCIceCandidateInit[];
	makingOffer: boolean;
	polite: boolean;
};

export type ReceivedNoteHandler = (peerId: string, note: number, velocity: number, isNoteOn: boolean) => void;

const ICE_CONFIG: RTCConfiguration = {
	iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(myId: string, onReceiveNote: ReceivedNoteHandler) {
	const peersRef = useRef<Map<string, PeerInfo>>(new Map());
	const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());

	const onReceiveNoteRef = useRef(onReceiveNote);
	useEffect(() => {
		onReceiveNoteRef.current = onReceiveNote;
	}, [onReceiveNote]);

	const markConnected = useCallback((peerId: string, connected: boolean) => {
		setConnectedPeers((prev) => {
			const next = new Set(prev);
			if (connected) next.add(peerId);
			else next.delete(peerId);
			return next;
		});
	}, []);

	const setupDataChannel = useCallback(
		(peerId: string, dc: RTCDataChannel) => {
			const peer = peersRef.current.get(peerId);
			if (peer) peer.dc = dc;

			dc.onopen = () => markConnected(peerId, true);
			dc.onclose = () => markConnected(peerId, false);
			dc.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === "midi") {
						onReceiveNoteRef.current(peerId, data.note, data.velocity, data.isNoteOn);
					}
				} catch {}
			};
		},
		[markConnected],
	);

	const removePeer = useCallback(
		(peerId: string) => {
			const peer = peersRef.current.get(peerId);
			if (!peer) return;
			try {
				peer.dc?.close();
			} catch {}
			try {
				peer.pc.close();
			} catch {}
			peersRef.current.delete(peerId);
			markConnected(peerId, false);
		},
		[markConnected],
	);

	const createPeerConnection = useCallback(
		(peerId: string, sendSignal: (s: SignalPayload) => void): PeerInfo => {
			const pc = new RTCPeerConnection(ICE_CONFIG);
			const polite = myId < peerId ? false : true;
			const info: PeerInfo = { pc, dc: null, iceQueue: [], makingOffer: false, polite };
			peersRef.current.set(peerId, info);

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					sendSignal({ type: "candidate", targetId: peerId, candidate: e.candidate.toJSON() });
				}
			};
			pc.ondatachannel = (e) => setupDataChannel(peerId, e.channel);
			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
					markConnected(peerId, false);
				}
			};

			return info;
		},
		[myId, markConnected, setupDataChannel],
	);

	const initiateConnection = useCallback(
		async (peerId: string, sendSignal: (s: SignalPayload) => void) => {
			if (peersRef.current.has(peerId)) return;
			const info = createPeerConnection(peerId, sendSignal);
			const dc = info.pc.createDataChannel("piano-notes");
			setupDataChannel(peerId, dc);

			try {
				info.makingOffer = true;
				const offer = await info.pc.createOffer();
				await info.pc.setLocalDescription(offer);
				sendSignal({ type: "offer", targetId: peerId, offer });
			} catch (err) {
				console.error("createOffer failed", err);
			} finally {
				info.makingOffer = false;
			}
		},
		[createPeerConnection, setupDataChannel],
	);

	const handleOffer = useCallback(
		async (peerId: string, offer: RTCSessionDescriptionInit, sendSignal: (s: SignalPayload) => void) => {
			let info = peersRef.current.get(peerId);
			if (!info) {
				info = createPeerConnection(peerId, sendSignal);
			}

			const offerCollision = info.makingOffer || info.pc.signalingState !== "stable";
			if (offerCollision && !info.polite) return;

			try {
				await info.pc.setRemoteDescription(new RTCSessionDescription(offer));
				info.iceQueue.forEach((c) => info!.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
				info.iceQueue = [];

				const answer = await info.pc.createAnswer();
				await info.pc.setLocalDescription(answer);
				sendSignal({ type: "answer", targetId: peerId, answer });
			} catch (err) {
				console.error("handleOffer failed", err);
			}
		},
		[createPeerConnection],
	);

	const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
		const info = peersRef.current.get(peerId);
		if (!info) return;
		if (info.pc.signalingState === "have-local-offer") {
			try {
				await info.pc.setRemoteDescription(new RTCSessionDescription(answer));
				info.iceQueue.forEach((c) => info.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
				info.iceQueue = [];
			} catch (err) {
				console.error("handleAnswer failed", err);
			}
		}
	}, []);

	const handleCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
		const info = peersRef.current.get(peerId);
		if (!info) return;
		if (info.pc.remoteDescription) {
			try {
				await info.pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch {}
		} else {
			info.iceQueue.push(candidate);
		}
	}, []);

	const broadcastNote = useCallback((note: number, velocity: number, isNoteOn: boolean) => {
		const msg = JSON.stringify({ type: "midi", note, velocity, isNoteOn });
		peersRef.current.forEach((peer) => {
			if (peer.dc?.readyState === "open") {
				try {
					peer.dc.send(msg);
				} catch {}
			}
		});
	}, []);

	const hasPeer = useCallback((peerId: string) => peersRef.current.has(peerId), []);
	const knownPeerIds = useCallback(() => Array.from(peersRef.current.keys()), []);

	useEffect(() => {
		return () => {
			peersRef.current.forEach((peer) => {
				try {
					peer.dc?.close();
				} catch {}
				try {
					peer.pc.close();
				} catch {}
			});
			peersRef.current.clear();
		};
	}, []);

	return {
		initiateConnection,
		handleOffer,
		handleAnswer,
		handleCandidate,
		removePeer,
		broadcastNote,
		hasPeer,
		knownPeerIds,
		connectedPeers,
	};
}import * as Tone from "tone";
import { instruments } from "./types";

export const initAudioContext = async () => {
	const context = new Tone.Context({ latencyHint: "interactive" });
	Tone.setContext(context);
	Tone.context.lookAhead = 0;
};

export const createSampler = (instKey: string, onload: () => void): Tone.Sampler => {
	return new Tone.Sampler({
		urls: instruments[instKey].urls,
		baseUrl: instruments[instKey].baseUrl,
		release: 1.5,
		onload,
	});
};

export const createMasterVolume = (db: number): Tone.Volume => {
	return new Tone.Volume(db).toDestination();
};

export const createReverb = (wet: number, output?: Tone.ToneAudioNode): Tone.Reverb => {
	const reverb = new Tone.Reverb({ decay: 2, wet });
	if (output) {
		reverb.connect(output);
	} else {
		reverb.toDestination();
	}
	return reverb;
};import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}


import { PianoKey } from "./types";
import { PLAYER_COLORS } from "./playerColors";

export const generatePiano = (): PianoKey[] => {
	const keys: PianoKey[] = [];
	let whiteKeyIndex = 0;
	for (let midi = 21; midi <= 108; midi++) {
		const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
		const noteName = notes[midi % 12];
		const isBlack = noteName.includes("#");
		keys.push({
			midi,
			noteName: `${noteName}${Math.floor(midi / 12) - 1}`,
			isBlack,
			whiteKeyIndex: !isBlack ? whiteKeyIndex++ : whiteKeyIndex - 1,
			color: PLAYER_COLORS[0],
		});
	}
	return keys;
};
export const PLAYER_COLORS = [
	"rgba(219, 83, 97, 0.55)",   // red
	"rgba(83, 150, 219, 0.55)",  // blue
	"rgba(83, 219, 150, 0.55)",  // green
	"rgba(200, 140, 219, 0.55)", // purple
];

export const PLAYER_COLORS_SOLID = [
	"#db5361",
	"#5396db",
	"#53db96",
	"#c88cdb",
];

export function getColorIndex(usersOnline: string[], myId: string): number {
	const idx = usersOnline.indexOf(myId);
	return idx === -1 ? 0 : idx;
}


export function getSolidColor(index: number): string {
	return PLAYER_COLORS_SOLID[index % PLAYER_COLORS_SOLID.length];
}
export type PianoKey = {
	midi: number;
	noteName: string;
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
};

export type VisNote = {
	id: string;
	midi: number;
	startTime: number;
	endTime: number | null;
	isBlack: boolean;
	whiteKeyIndex: number;
	color: string;
	x: number;
	w: number;
	playerId: string;
};

export const THEME_COLOR = "rgba(219, 83, 97, 0.5)";

export type Instrument = {
	name: string;
	urls: Record<string, string>;
	baseUrl: string;
};

export const instruments: Record<string, Instrument> = {
	salamander_grand: {
		name: "Salamander Grand Piano",
		urls: {
			A0: "A0.mp3",
			C1: "C1.mp3",
			"D#1": "Ds1.mp3",
			"F#1": "Fs1.mp3",
			A1: "A1.mp3",
			C2: "C2.mp3",
			"D#2": "Ds2.mp3",
			"F#2": "Fs2.mp3",
			A2: "A2.mp3",
			C3: "C3.mp3",
			"D#3": "Ds3.mp3",
			"F#3": "Fs3.mp3",
			A3: "A3.mp3",
			C4: "C4.mp3",
			"D#4": "Ds4.mp3",
			"F#4": "Fs4.mp3",
			A4: "A4.mp3",
			C5: "C5.mp3",
			"D#5": "Ds5.mp3",
			"F#5": "Fs5.mp3",
			A5: "A5.mp3",
			C6: "C6.mp3",
			"D#6": "Ds6.mp3",
			"F#6": "Fs6.mp3",
			A6: "A6.mp3",
			C7: "C7.mp3",
			"D#7": "Ds7.mp3",
			"F#7": "Fs7.mp3",
			A7: "A7.mp3",
			C8: "C8.mp3",
		},
		baseUrl: "https://tonejs.github.io/audio/salamander/",
	},
	casio_ep: {
		name: "Casio Electric Piano",
		urls: {
			A1: "A1.mp3",
			A2: "A2.mp3",
			C4: "C4.mp3",
			"D#4": "Ds4.mp3",
			"F#4": "Fs4.mp3",
			A4: "A4.mp3",
		},
		baseUrl: "https://tonejs.github.io/audio/casio/",
	},
};

export const DEFAULT_SOUNDFONT = "salamander_grand";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hasEnvVars() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

## Claude

Got it — I've read through the files. Quick summary of what I'm seeing:

- **Next.js app** with solo mode (`page.tsx`) and multiplayer (`/multiplayer` lobby + `/jam/[roomId]`)
- **Audio**: Tone.js sampler with selectable soundfonts, master volume, sustain pedal support, MIDI input via Web MIDI API (`useAudioEngine`)
- **Multiplayer**: Supabase Realtime channel for presence + WebRTC signaling, peer-to-peer DataChannels for note broadcasting (`useWebRTC`)
- **Rooms**: Supabase `rooms` table with public/private/friends accessibility, password-protected private rooms
- **Chat**: broadcast over the same Supabase channel
- **Visuals**: canvas-based falling-note visualizer, color per player based on join order

Ready when you are — go ahead and describe the issues.

## User

so i am working on the settings panel and specifically my master volume, when my master volume is at zero i still hear the sound coming from the application, i want the master volume to really work as a master volume

## Claude

I see the bug. In your `setMasterVolume` callback in `useAudioEngine.ts`:

```ts
masterVolumeNodeRef.current.mute = clamped === 0;
masterVolumeNodeRef.current.volume.rampTo(percentToDb(clamped), 0.02);
```

When `clamped === 0`:
1. `mute = true` → Tone.Volume immediately sets `volume.value = -Infinity` (and saves the previous value internally).
2. Then `volume.rampTo(-60, 0.02)` runs **right after** and ramps the volume back from `-Infinity` to `-60dB` over 20ms.

So the mute gets undone by the ramp, and `-60dB` is still faintly audible. Let me find your project and fix it.

[Glob **/useAudioEngine.ts]

[Bash: where /R C:\Users\mgiam\Desktop useAudioEngine.ts 2>nul; where /R C:\Users\mgiam\Documents useAudioE]

[PowerShell: Get-ChildItem -Path "C:\Users\mgiam\Desktop","C:\Users\mgiam\Documents","C:\Users\mgiam\source","C:\]

## User

[Request interrupted by user for tool use]

dont use my terminal, just give me the code please

## Claude

Got it. Here's the fix — replace the `setMasterVolume` callback in `hooks/useAudioEngine.ts`:

```ts
const setMasterVolume = useCallback((percent: number) => {
    const clamped = Math.max(0, Math.min(100, percent));
    setMasterVolumeState(clamped);
    const node = masterVolumeNodeRef.current;
    if (!node) return;
    if (clamped === 0) {
        node.mute = true;
    } else {
        node.mute = false;
        node.volume.rampTo(percentToDb(clamped), 0.02);
    }
}, []);
```

**What changed:** when `clamped === 0`, we only set `mute = true` and skip the `rampTo`. When non-zero, we unmute first (which restores the previously saved volume), then ramp to the new target.

**Why your version failed:** `Tone.Volume`'s `mute = true` setter immediately writes `volume.value = -Infinity`. Calling `volume.rampTo(-60, 0.02)` right after ramps it back from `-Infinity` to `-60dB` — undoing the mute. Also, `-60dB` isn't truly silent; it's a faint whisper. So even without the ramp bug, your "0%" floor wouldn't be true silence.

---

**Optional — better curve.** Your `percentToDb` is unusual: 100% gives `+6dB` (a boost that can clip), and 50% gives `-17dB` (very quiet). A standard fader curve maps 100% → 0dB unity:

```ts
function percentToDb(percent: number): number {
    if (percent <= 0) return -Infinity;
    return 40 * Math.log10(percent / 100);
}
```

This gives:
- 100% → 0 dB (unity)
- 75% → −5 dB
- 50% → −12 dB
- 25% → −24 dB
- 0% → silent (handled by mute)

Feels more natural and avoids clipping at max. Up to you whether to swap it in — the mute fix above is the actual bug fix.

## User

"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, instruments, DEFAULT_SOUNDFONT } from "../lib/types";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

const SELF = "self";
const DEFAULT_VOLUME_PERCENT = 75;

export type SoundfontOption = { key: string; name: string };

function percentToDb(percent: number): number {
	if (percent <= 0) return -60;
	return -40 + (percent / 100) * 46;
}

export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	const audioStartedRef = useRef(false);
	const samplersRef = useRef<Map<string, Tone.Sampler>>(new Map());
	const samplerRef = useRef<Tone.Sampler | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

	const noteHoldersRef = useRef<Map<number, Set<string>>>(new Map());
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);
	const initializedRef = useRef(false);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);

	const [currentSoundfont, setCurrentSoundfont] = useState<string>(DEFAULT_SOUNDFONT);
	const [loadedSoundfonts, setLoadedSoundfonts] = useState<string[]>([]);
	const [loadingSoundfont, setLoadingSoundfont] = useState<string | null>(null);

	const [masterVolume, setMasterVolumeState] = useState<number>(DEFAULT_VOLUME_PERCENT);
	const setMasterVolume = useCallback((percent: number) => {
		const clamped = Math.max(0, Math.min(100, percent));
		setMasterVolumeState(clamped);
		const node = masterVolumeNodeRef.current;
		if (!node) return;
		if (clamped === 0) {
			node.mute = true;
		} else {
			node.mute = false;
			node.volume.rampTo(percentToDb(clamped), 0.02);
		}
	}, []);

	function percentToDb(percent: number): number {
		if (percent <= 0) return -Infinity;
		return 40 * Math.log10(percent / 100);
	}
	const soundfonts: SoundfontOption[] = Object.entries(instruments).map(([key, val]) => ({
		key,
		name: val.name,
	}));

	const unlockAudio = useCallback(async () => {
		if (audioStartedRef.current) return;
		try {
			await Tone.start();
			audioStartedRef.current = true;
		} catch (error) {
			console.error("Browser blocked audio start:", error);
		}
	}, []);

	const playNote = useCallback(
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorOverride?: string, solidColorOverride?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Set();
				noteHoldersRef.current.set(midi, holders);
			}
			if (holders.has(playerId)) return;
			holders.add(playerId);
			sustainedNotesRef.current.delete(midi);

			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
			if (keyEl) {
				const solidColor = solidColorOverride ?? PLAYER_COLORS_SOLID[0];
				keyEl.style.setProperty("--active-color", solidColor);
				keyEl.classList.add("active");
			}

			const normalizedVel = vel > 1 ? vel / 127 : vel;

			if (audioStartedRef.current && samplerRef.current && samplerRef.current.loaded) {
				samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), normalizedVel);
			}

			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			if (keyInfo) {
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (keyInfo.isBlack) {
					w = whiteKeyWidth * 0.6;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth;
				}

				const noteColor = colorOverride ?? keyInfo.color;

				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: performance.now(),
					endTime: null,
					isBlack: keyInfo.isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: noteColor,
					x,
					w,
					playerId,
				};

				visNotesRef.current.push(newNote);
				setNoteLines([...visNotesRef.current]);
			}
		},
		[pianoKeys, setNoteLines],
	);

	const stopNote = useCallback((midi: number, playerId: string = SELF) => {
		const holders = noteHoldersRef.current.get(midi);
		if (!holders || !holders.has(playerId)) return;
		holders.delete(playerId);

		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId);
		if (pendingNote) pendingNote.endTime = performance.now();

		if (holders.size === 0) {
			noteHoldersRef.current.delete(midi);
			const keyEl = document.querySelector(`[data-midi="${midi}"]`);
			keyEl?.classList.remove("active");

			if (isSustainOnRef.current) {
				sustainedNotesRef.current.add(midi);
			} else if (samplerRef.current) {
				samplerRef.current.triggerRelease(Tone.Frequency(midi, "midi").toNote(), Tone.immediate());
			}
		}
	}, []);

	const releaseAllForPlayer = useCallback(
		(playerId: string) => {
			const midis: number[] = [];
			noteHoldersRef.current.forEach((holders, midi) => {
				if (holders.has(playerId)) midis.push(midi);
			});
			midis.forEach((m) => stopNote(m, playerId));
		},
		[stopNote],
	);

	const loadSoundfont = useCallback((key: string): Promise<void> => {
		return new Promise((resolve, reject) => {
			if (!instruments[key]) return reject(new Error("Unknown soundfont"));
			if (samplersRef.current.has(key)) return resolve();
			if (!reverbRef.current) return reject(new Error("Audio not initialized"));

			setLoadingSoundfont(key);
			const sampler = createSampler(key, () => {
				setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key]));
				setLoadingSoundfont((prev) => (prev === key ? null : prev));
				resolve();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(key, sampler);
		});
	}, []);

	const selectSoundfont = useCallback(
		async (key: string) => {
			if (!instruments[key]) return;
			if (!samplersRef.current.has(key)) {
				try {
					await loadSoundfont(key);
				} catch {
					return;
				}
			}
			const next = samplersRef.current.get(key);
			if (next) {
				samplerRef.current = next;
				setCurrentSoundfont(key);
			}
		},
		[loadSoundfont],
	);

	const connectMIDI = useCallback(
		(onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v), onStop: (note: number) => void = (n) => stopNote(n)) => {
			const nav = navigator as any;
			if (!nav.requestMIDIAccess) {
				setMidiError("Web MIDI is not enabled in this browser. In Brave, open brave://settings/content/midiSysex and enable MIDI for this site.");
				setMidiDevices([]);
				return;
			}
			nav
				.requestMIDIAccess({ sysex: false })
				.then((m: any) => {
					setMidiError(null);
					const refresh = () => {
						const names: string[] = [];
						m.inputs.forEach((i: any) => {
							names.push(i.name || "Unknown MIDI device");
							i.onmidimessage = (msg: any) => {
								unlockAudio();
								const [cmd, note, vel] = msg.data;
								const command = cmd >> 4;

								if (command === 11 && note === 64) {
									const pedalPressed = vel >= 64;
									isSustainOnRef.current = pedalPressed;
									if (!pedalPressed) {
										sustainedNotesRef.current.forEach((sustainedMidi) => {
											samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
										});
										sustainedNotesRef.current.clear();
									}
								} else if (command === 9 && vel > 0) {
									onPlay(note, vel);
								} else if (command === 8 || (command === 9 && vel === 0)) {
									onStop(note);
								}
							};
						});
						setMidiDevices(names);
					};
					refresh();
					m.onstatechange = refresh;
				})
				.catch((err: any) => {
					setMidiError("MIDI access denied: " + (err?.message || String(err)));
					setMidiDevices([]);
				});
		},
		[playNote, stopNote, unlockAudio],
	);

	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const init = async () => {
			await initAudioContext();

			masterVolumeNodeRef.current = createMasterVolume(percentToDb(DEFAULT_VOLUME_PERCENT));
			reverbRef.current = createReverb(0.2, masterVolumeNodeRef.current);

			setLoadingSoundfont(DEFAULT_SOUNDFONT);
			const sampler = createSampler(DEFAULT_SOUNDFONT, () => {
				setLoadedSoundfonts([DEFAULT_SOUNDFONT]);
				setLoadingSoundfont(null);
				connectMIDI();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(DEFAULT_SOUNDFONT, sampler);
			samplerRef.current = sampler;
		};
		init();
	}, [connectMIDI]);

	return {
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
	};
};
 send me the whole file with your modifications

## Claude

You have `percentToDb` declared twice (once at module level with the old curve, once inside the hook with the new curve). Cleaning that up. Here's the full file:

```ts
"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import * as Tone from "tone";
import { initAudioContext, createSampler, createReverb, createMasterVolume } from "../lib/audio";
import { VisNote, PianoKey, instruments, DEFAULT_SOUNDFONT } from "../lib/types";
import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";

const SELF = "self";
const DEFAULT_VOLUME_PERCENT = 75;

export type SoundfontOption = { key: string; name: string };

function percentToDb(percent: number): number {
	if (percent <= 0) return -Infinity;
	return 40 * Math.log10(percent / 100);
}

export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => {
	const audioStartedRef = useRef(false);
	const samplersRef = useRef<Map<string, Tone.Sampler>>(new Map());
	const samplerRef = useRef<Tone.Sampler | null>(null);
	const reverbRef = useRef<Tone.Reverb | null>(null);
	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

	const noteHoldersRef = useRef<Map<number, Set<string>>>(new Map());
	const sustainedNotesRef = useRef<Set<number>>(new Set());
	const isSustainOnRef = useRef(false);
	const visNotesRef = useRef<VisNote[]>([]);
	const initializedRef = useRef(false);

	const [midiDevices, setMidiDevices] = useState<string[]>([]);
	const [midiError, setMidiError] = useState<string | null>(null);

	const [currentSoundfont, setCurrentSoundfont] = useState<string>(DEFAULT_SOUNDFONT);
	const [loadedSoundfonts, setLoadedSoundfonts] = useState<string[]>([]);
	const [loadingSoundfont, setLoadingSoundfont] = useState<string | null>(null);

	const [masterVolume, setMasterVolumeState] = useState<number>(DEFAULT_VOLUME_PERCENT);

	const setMasterVolume = useCallback((percent: number) => {
		const clamped = Math.max(0, Math.min(100, percent));
		setMasterVolumeState(clamped);
		const node = masterVolumeNodeRef.current;
		if (!node) return;
		if (clamped === 0) {
			node.mute = true;
		} else {
			node.mute = false;
			node.volume.rampTo(percentToDb(clamped), 0.02);
		}
	}, []);

	const soundfonts: SoundfontOption[] = Object.entries(instruments).map(([key, val]) => ({
		key,
		name: val.name,
	}));

	const unlockAudio = useCallback(async () => {
		if (audioStartedRef.current) return;
		try {
			await Tone.start();
			audioStartedRef.current = true;
		} catch (error) {
			console.error("Browser blocked audio start:", error);
		}
	}, []);

	const playNote = useCallback(
		(midi: number, vel: number = 0.7, playerId: string = SELF, colorOverride?: string, solidColorOverride?: string) => {
			let holders = noteHoldersRef.current.get(midi);
			if (!holders) {
				holders = new Set();
				noteHoldersRef.current.set(midi, holders);
			}
			if (holders.has(playerId)) return;
			holders.add(playerId);
			sustainedNotesRef.current.delete(midi);

			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null;
			if (keyEl) {
				const solidColor = solidColorOverride ?? PLAYER_COLORS_SOLID[0];
				keyEl.style.setProperty("--active-color", solidColor);
				keyEl.classList.add("active");
			}

			const normalizedVel = vel > 1 ? vel / 127 : vel;

			if (audioStartedRef.current && samplerRef.current && samplerRef.current.loaded) {
				samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), normalizedVel);
			}

			const keyInfo = pianoKeys.find((k) => k.midi === midi);
			if (keyInfo) {
				const whiteKeyWidth = window.innerWidth / 52;
				let x, w;
				if (keyInfo.isBlack) {
					w = whiteKeyWidth * 0.6;
					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2;
				} else {
					w = whiteKeyWidth;
					x = keyInfo.whiteKeyIndex * whiteKeyWidth;
				}

				const noteColor = colorOverride ?? keyInfo.color;

				const newNote: VisNote = {
					id: Math.random().toString(),
					midi,
					startTime: performance.now(),
					endTime: null,
					isBlack: keyInfo.isBlack,
					whiteKeyIndex: keyInfo.whiteKeyIndex,
					color: noteColor,
					x,
					w,
					playerId,
				};

				visNotesRef.current.push(newNote);
				setNoteLines([...visNotesRef.current]);
			}
		},
		[pianoKeys, setNoteLines],
	);

	const stopNote = useCallback((midi: number, playerId: string = SELF) => {
		const holders = noteHoldersRef.current.get(midi);
		if (!holders || !holders.has(playerId)) return;
		holders.delete(playerId);

		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId);
		if (pendingNote) pendingNote.endTime = performance.now();

		if (holders.size === 0) {
			noteHoldersRef.current.delete(midi);
			const keyEl = document.querySelector(`[data-midi="${midi}"]`);
			keyEl?.classList.remove("active");

			if (isSustainOnRef.current) {
				sustainedNotesRef.current.add(midi);
			} else if (samplerRef.current) {
				samplerRef.current.triggerRelease(Tone.Frequency(midi, "midi").toNote(), Tone.immediate());
			}
		}
	}, []);

	const releaseAllForPlayer = useCallback(
		(playerId: string) => {
			const midis: number[] = [];
			noteHoldersRef.current.forEach((holders, midi) => {
				if (holders.has(playerId)) midis.push(midi);
			});
			midis.forEach((m) => stopNote(m, playerId));
		},
		[stopNote],
	);

	const loadSoundfont = useCallback((key: string): Promise<void> => {
		return new Promise((resolve, reject) => {
			if (!instruments[key]) return reject(new Error("Unknown soundfont"));
			if (samplersRef.current.has(key)) return resolve();
			if (!reverbRef.current) return reject(new Error("Audio not initialized"));

			setLoadingSoundfont(key);
			const sampler = createSampler(key, () => {
				setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key]));
				setLoadingSoundfont((prev) => (prev === key ? null : prev));
				resolve();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(key, sampler);
		});
	}, []);

	const selectSoundfont = useCallback(
		async (key: string) => {
			if (!instruments[key]) return;
			if (!samplersRef.current.has(key)) {
				try {
					await loadSoundfont(key);
				} catch {
					return;
				}
			}
			const next = samplersRef.current.get(key);
			if (next) {
				samplerRef.current = next;
				setCurrentSoundfont(key);
			}
		},
		[loadSoundfont],
	);

	const connectMIDI = useCallback(
		(onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v), onStop: (note: number) => void = (n) => stopNote(n)) => {
			const nav = navigator as any;
			if (!nav.requestMIDIAccess) {
				setMidiError("Web MIDI is not enabled in this browser. In Brave, open brave://settings/content/midiSysex and enable MIDI for this site.");
				setMidiDevices([]);
				return;
			}
			nav
				.requestMIDIAccess({ sysex: false })
				.then((m: any) => {
					setMidiError(null);
					const refresh = () => {
						const names: string[] = [];
						m.inputs.forEach((i: any) => {
							names.push(i.name || "Unknown MIDI device");
							i.onmidimessage = (msg: any) => {
								unlockAudio();
								const [cmd, note, vel] = msg.data;
								const command = cmd >> 4;

								if (command === 11 && note === 64) {
									const pedalPressed = vel >= 64;
									isSustainOnRef.current = pedalPressed;
									if (!pedalPressed) {
										sustainedNotesRef.current.forEach((sustainedMidi) => {
											samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate());
										});
										sustainedNotesRef.current.clear();
									}
								} else if (command === 9 && vel > 0) {
									onPlay(note, vel);
								} else if (command === 8 || (command === 9 && vel === 0)) {
									onStop(note);
								}
							};
						});
						setMidiDevices(names);
					};
					refresh();
					m.onstatechange = refresh;
				})
				.catch((err: any) => {
					setMidiError("MIDI access denied: " + (err?.message || String(err)));
					setMidiDevices([]);
				});
		},
		[playNote, stopNote, unlockAudio],
	);

	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;

		const init = async () => {
			await initAudioContext();

			masterVolumeNodeRef.current = createMasterVolume(percentToDb(DEFAULT_VOLUME_PERCENT));
			reverbRef.current = createReverb(0.2, masterVolumeNodeRef.current);

			setLoadingSoundfont(DEFAULT_SOUNDFONT);
			const sampler = createSampler(DEFAULT_SOUNDFONT, () => {
				setLoadedSoundfonts([DEFAULT_SOUNDFONT]);
				setLoadingSoundfont(null);
				connectMIDI();
			});
			sampler.connect(reverbRef.current);
			samplersRef.current.set(DEFAULT_SOUNDFONT, sampler);
			samplerRef.current = sampler;
		};
		init();
	}, [connectMIDI]);

	return {
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
	};
};
```

Changes from your version:
1. Single `percentToDb` at module level (logarithmic curve, 100% = unity 0dB).
2. `setMasterVolume` mutes at 0 without the conflicting `rampTo`.
3. Removed the duplicate `percentToDb` declaration inside the hook.
