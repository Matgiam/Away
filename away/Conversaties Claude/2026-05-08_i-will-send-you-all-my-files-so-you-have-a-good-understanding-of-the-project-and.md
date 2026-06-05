# i will send you all my files so you have a good understanding of the project and then i will tell you about my issues: "

*Started: 2026-05-08 16:02 UTC*

## User

Hey so i am building a webapplication where you can play piano in solo or multiplayer mode. i will send you all my files so you have a good understanding of the project and then i will tell you about my issues: "use client";  import { useEffect, useState, useRef, useMemo, useCallback } from "react"; import { useParams, useRouter } from "next/navigation"; import { supabase } from "@/lib/supabase"; import { createClient } from "@/lib/supabase/client"; import { Piano } from "@/components/multiplayer/Piano"; import { generatePiano } from "@/lib/piano"; import { useAudioEngine } from "@/hooks/useAudioEngine"; import { VisNote } from "@/lib/types"; import { Visualizer } from "@/components/multiplayer/Visualizer"; import { Navigation } from "@/components/layout/Navigation"; import { SilkBackground } from "@/components/effects/SilkBackground"; import { useWebRTC } from "@/hooks/useWebRTC"; import { getOrCreatePlayerId } from "@/hooks/useCreateRoom"; import { ChatPanel } from "@/components/chat/ChatPanel"; import { useChat } from "@/hooks/useChat"; import { PlayerList } from "@/components/multiplayer/PlayerList"; import { PLAYER_COLORS, getSolidColor } from "@/lib/playerColors"; import type { ChatMessage } from "@/hooks/useChat";  type PresencePlayer = { 	displayName: string; 	joinedAt: number; };  type PlayerEntry = { 	id: string; 	displayName: string; 	colorIndex: number; 	isMe: boolean; 	isFriend: boolean; };  async function decrementOrDelete(roomId: string) { 	const { data } = await supabase.from("rooms").select("current_players").eq("id", roomId).single(); 	if (!data) return; 	if (data.current_players <= 1) { 		await supabase.from("rooms").delete().eq("id", roomId); 	} else { 		await supabase 			.from("rooms") 			.update({ current_players: data.current_players - 1 }) 			.eq("id", roomId); 	} }  export default function JamRoom() { 	const params = useParams(); 	const router = useRouter(); 	const roomId = params.roomId as string;  	const [showKeys, setShowKeys] = useState(true); 	const [noteLines, setNoteLines] = useState<VisNote[]>([]); 	const pianoKeys = useMemo(() => generatePiano(), []);  	const myTempId = useRef(getOrCreatePlayerId()); 	const joinedAtRef = useRef(Date.now());  	const { 		playNote, 		stopNote, 		unlockAudio, 		connectMIDI, 		releaseAllForPlayer, 		midiDevices, 		midiError, 		soundfonts, 		currentSoundfont, 		loadedSoundfonts, 		loadingSoundfont, 		selectSoundfont, 		masterVolume, 		setMasterVolume, 	} = useAudioEngine(pianoKeys, setNoteLines);  	const [user, setUser] = useState<any>(null); 	const [isLoggedIn, setIsLoggedIn] = useState(false); 	const [myName, setMyName] = useState("");  	const [players, setPlayers] = useState<PlayerEntry[]>([]); 	const playersRef = useRef<PlayerEntry[]>([]); 	useEffect(() => { 		playersRef.current = players; 	}, [players]);  	const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);  	const chatAnchorRef = useRef<HTMLDivElement>(null); 	const [chatTopPx, setChatTopPx] = useState(0);  	useEffect(() => { 		const updateChatTop = () => { 			if (chatAnchorRef.current) { 				const rect = chatAnchorRef.current.getBoundingClientRect(); 				setChatTopPx(rect.bottom + 12); 			} 		}; 		updateChatTop(); 		const observer = new ResizeObserver(updateChatTop); 		observer.observe(document.documentElement); 		return () => observer.disconnect(); 	}, []);  	useEffect(() => { 		const REFRESH_KEY = "jamRoomRefreshed"; 		const wasRefreshed = sessionStorage.getItem(REFRESH_KEY); 		if (wasRefreshed === roomId) { 			sessionStorage.removeItem(REFRESH_KEY); 			(async () => { 				await decrementOrDelete(roomId); 				router.replace("/multiplayer"); 			})(); 			return; 		} 		const handleBeforeUnload = () => { 			sessionStorage.setItem(REFRESH_KEY, roomId); 		}; 		window.addEventListener("beforeunload", handleBeforeUnload); 		return () => window.removeEventListener("beforeunload", handleBeforeUnload); 	}, [roomId, router]);  	useEffect(() => { 		const checkUser = async () => { 			const supabaseClient = createClient(); 			const { data } = await supabaseClient.auth.getUser(); 			if (data.user) { 				setUser(data.user); 				setIsLoggedIn(true); 				const name = data.user.email?.split("@")[0] || data.user.id.substring(0, 8); 				setMyName(name); 				sessionStorage.setItem("away_user", JSON.stringify({ id: data.user.id, email: data.user.email })); 			} else { 				const savedUser = sessionStorage.getItem("away_user"); 				if (savedUser) { 					const parsed = JSON.parse(savedUser); 					setMyName(parsed.email?.split("@")[0] || parsed.id.substring(0, 8)); 				} 			} 		}; 		checkUser(); 	}, []);  	const myNameRef = useRef(myName); 	useEffect(() => { 		myNameRef.current = myName; 		const channel = roomChannelRef.current; 		if (channel && myName) { 			channel.track({ 				displayName: myName, 				joinedAt: joinedAtRef.current, 			}); 		} 	}, [myName]);  	const myColorIndex = useMemo(() => players.findIndex((p) => p.id === myTempId.current), [players]); 	const myColor = useMemo(() => PLAYER_COLORS[Math.max(myColorIndex, 0) % PLAYER_COLORS.length], [myColorIndex]); 	const mySolidColor = useMemo(() => getSolidColor(Math.max(myColorIndex, 0)), [myColorIndex]);  	const myColorRef = useRef(myColor); 	const mySolidColorRef = useRef(mySolidColor); 	useEffect(() => { 		myColorRef.current = myColor; 	}, [myColor]); 	useEffect(() => { 		mySolidColorRef.current = mySolidColor; 	}, [mySolidColor]);  	const onReceivePeerNote = useCallback( 		(peerId: string, note: number, velocity: number, isNoteOn: boolean) => { 			const player = playersRef.current.find((p) => p.id === peerId); 			const colorIndex = player?.colorIndex ?? 0; 			const peerColor = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]; 			const peerSolid = getSolidColor(colorIndex); 			if (isNoteOn) { 				playNote(note, velocity, peerId, peerColor, peerSolid); 			} else { 				stopNote(note, peerId); 			} 		}, 		[playNote, stopNote], 	);  	const { initiateConnection, handleOffer, handleAnswer, handleCandidate, removePeer, broadcastNote, hasPeer, knownPeerIds } = useWebRTC( 		myTempId.current, 		onReceivePeerNote, 	);  	const handleLocalPlay = useCallback( 		(note: number, velocity: number = 127) => { 			playNote(note, velocity, "self", myColorRef.current, mySolidColorRef.current); 			broadcastNote(note, velocity, true); 		}, 		[playNote, broadcastNote], 	);  	const handleLocalStop = useCallback( 		(note: number) => { 			stopNote(note, "self"); 			broadcastNote(note, 0, false); 		}, 		[stopNote, broadcastNote], 	);  	const { messages, isChatOpen, setIsChatOpen, addMessage } = useChat(myTempId.current);  	const handleLoginClick = useCallback(() => { 		sessionStorage.setItem("redirect_after_login", `/jam/${roomId}`); 		router.push("/auth/login"); 	}, [router, roomId]);  	const handleOpenChat = useCallback(() => setIsChatOpen(true), [setIsChatOpen]); 	const handleCloseChat = useCallback(() => setIsChatOpen(false), [setIsChatOpen]);  	const handleSendMessage = useCallback( 		(text: string) => { 			const channel = roomChannelRef.current; 			if (!channel) return; 			const msg: ChatMessage = { 				id: Math.random().toString(36).substring(2), 				senderId: isLoggedIn ? user?.id || myTempId.current : myTempId.current, 				senderName: isLoggedIn ? myName : myTempId.current, 				text, 				timestamp: Date.now(), 			}; 			addMessage(msg); 			channel.send({ type: "broadcast", event: "chat-message", payload: msg }); 		}, 		[addMessage, isLoggedIn, user, myName], 	);  	const handleClick = useCallback(() => unlockAudio(), [unlockAudio]);  	const initiateConnectionRef = useRef(initiateConnection); 	const handleOfferRef = useRef(handleOffer); 	const handleAnswerRef = useRef(handleAnswer); 	const handleCandidateRef = useRef(handleCandidate); 	const removePeerRef = useRef(removePeer); 	const hasPeerRef = useRef(hasPeer); 	const knownPeerIdsRef = useRef(knownPeerIds); 	const releaseAllForPlayerRef = useRef(releaseAllForPlayer); 	const handleLocalPlayRef = useRef(handleLocalPlay); 	const handleLocalStopRef = useRef(handleLocalStop); 	const connectMIDIRef = useRef(connectMIDI); 	const addMessageRef = useRef(addMessage);  	useEffect(() => { 		initiateConnectionRef.current = initiateConnection; 	}, [initiateConnection]); 	useEffect(() => { 		handleOfferRef.current = handleOffer; 	}, [handleOffer]); 	useEffect(() => { 		handleAnswerRef.current = handleAnswer; 	}, [handleAnswer]); 	useEffect(() => { 		handleCandidateRef.current = handleCandidate; 	}, [handleCandidate]); 	useEffect(() => { 		removePeerRef.current = removePeer; 	}, [removePeer]); 	useEffect(() => { 		hasPeerRef.current = hasPeer; 	}, [hasPeer]); 	useEffect(() => { 		knownPeerIdsRef.current = knownPeerIds; 	}, [knownPeerIds]); 	useEffect(() => { 		releaseAllForPlayerRef.current = releaseAllForPlayer; 	}, [releaseAllForPlayer]); 	useEffect(() => { 		handleLocalPlayRef.current = handleLocalPlay; 	}, [handleLocalPlay]); 	useEffect(() => { 		handleLocalStopRef.current = handleLocalStop; 	}, [handleLocalStop]); 	useEffect(() => { 		connectMIDIRef.current = connectMIDI; 	}, [connectMIDI]); 	useEffect(() => { 		addMessageRef.current = addMessage; 	}, [addMessage]);  	useEffect(() => { 		unlockAudio(); 		connectMIDIRef.current( 			(note, vel) => handleLocalPlayRef.current(note, vel), 			(note) => handleLocalStopRef.current(note), 		); 	}, [unlockAudio]);  	useEffect(() => { 		const room = supabase.channel(`jam-room-${roomId}`, { 			config: { presence: { key: myTempId.current } }, 		}); 		roomChannelRef.current = room;  		const sendSignal = (payload: any) => { 			room.send({ 				type: "broadcast", 				event: "webrtc-signal", 				payload: { ...payload, senderId: myTempId.current }, 			}); 		};  		room.on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => { 			if (payload.senderId === myTempId.current) return; 			if (payload.targetId && payload.targetId !== myTempId.current) return;  			const senderId = payload.senderId as string; 			if (payload.type === "offer") { 				await handleOfferRef.current(senderId, payload.offer, sendSignal); 			} else if (payload.type === "answer") { 				await handleAnswerRef.current(senderId, payload.answer); 			} else if (payload.type === "candidate") { 				await handleCandidateRef.current(senderId, payload.candidate); 			} 		});  		room.on("broadcast", { event: "chat-message" }, ({ payload }) => { 			if (payload.senderId === myTempId.current) return; 			addMessageRef.current(payload as ChatMessage); 		});  		room.on("presence", { event: "sync" }, () => { 			const state = room.presenceState<PresencePlayer>();  			const entries = Object.entries(state).map(([userId, presences]) => { 				const data = presences[0] as PresencePlayer; 				return { 					id: userId, 					displayName: data?.displayName || userId, 					joinedAt: data?.joinedAt ?? 0, 				}; 			});  			entries.sort((a, b) => a.joinedAt - b.joinedAt);  			const newPlayers: PlayerEntry[] = entries.map((e, index) => ({ 				id: e.id, 				displayName: e.displayName, 				colorIndex: index, 				isMe: e.id === myTempId.current, 				isFriend: false, 			})); 			setPlayers(newPlayers);  			const presentIds = new Set(newPlayers.map((p) => p.id));  			newPlayers.forEach((p) => { 				if (p.id === myTempId.current) return; 				if (hasPeerRef.current(p.id)) return; 				if (myTempId.current < p.id) { 					initiateConnectionRef.current(p.id, sendSignal); 				} 			});  			knownPeerIdsRef.current().forEach((pid) => { 				if (!presentIds.has(pid)) { 					releaseAllForPlayerRef.current(pid); 					removePeerRef.current(pid); 				} 			}); 		});  		room.subscribe(async (status) => { 			if (status === "SUBSCRIBED") { 				await room.track({ 					displayName: myNameRef.current || myTempId.current, 					joinedAt: joinedAtRef.current, 				}); 			} 		});  		return () => { 			roomChannelRef.current = null; 			try { 				room.untrack(); 			} catch {} 			supabase.removeChannel(room); 		}; 	}, [roomId]);  	const handleLeave = useCallback(async () => { 		await decrementOrDelete(roomId); 		sessionStorage.removeItem("hostedRoomId"); 		router.push("/multiplayer"); 	}, [roomId, router]);  	return ( 		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative" onClick={handleClick}> 			<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} />  			<Navigation 				onLogout={handleLeave} 				isChatOpen={isChatOpen} 				onToggleChat={isChatOpen ? handleCloseChat : handleOpenChat} 				chatAnchorRef={chatAnchorRef} 				midiDevices={midiDevices} 				midiError={midiError} 				onRetryMidi={() => 					connectMIDIRef.current( 						(note, vel) => handleLocalPlayRef.current(note, vel), 						(note) => handleLocalStopRef.current(note), 					) 				} 				soundfonts={soundfonts} 				currentSoundfont={currentSoundfont} 				loadedSoundfonts={loadedSoundfonts} 				loadingSoundfont={loadingSoundfont} 				onSelectSoundfont={selectSoundfont} 				masterVolume={masterVolume} 				onMasterVolumeChange={setMasterVolume} 				username={myName} 				onUsernameChange={setMyName} 			/>  			<div className="absolute inset-0 flex flex-row items-stretch"> 				<div className="flex flex-col flex-1 min-w-0"> 					<div className="absolute top-6 left-8 z-50"> 						<PlayerList players={players} onAddFriend={(id) => console.log("add friend", id)} /> 					</div> 					<Visualizer noteLines={noteLines} /> 					<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={handleLocalPlay} onStopNote={handleLocalStop} /> 				</div>  				{isChatOpen && chatTopPx > 0 && ( 					<div 						className="flex flex-col border-l border-white/8 bg-[#0a0118]/80 backdrop-blur-xl" 						style={{ 							width: "300px", 							flexShrink: 0, 							marginTop: `${chatTopPx}px`, 							zIndex: 60, 						}} 					> 						<ChatPanel 							messages={messages} 							myId={isLoggedIn ? user?.id || myTempId.current : myTempId.current} 							myName={myName} 							isLoggedIn={isLoggedIn} 							onSend={handleSendMessage} 							onClose={handleCloseChat} 							onLoginClick={handleLoginClick} 						/> 					</div> 				)} 			</div> 		</div> 	); }"use client";  import { SilkBackground } from "@/components/effects/SilkBackground"; import { useRooms } from "@/hooks/useRooms"; import { useCreateRoom } from "@/hooks/useCreateRoom"; import { useJoinRoom } from "@/hooks/useJoinRoom"; import BackButton from "@/components/multiplayer/BackButton"; import RoomList from "@/components/multiplayer/RoomList"; import CreateRoomModal from "@/components/multiplayer/CreateRoomModal"; import JoinRoomModal from "@/components/multiplayer/JoinRoomModal";  export default function MultiplayerLobby() { 	const { filter, setFilter, filteredRooms } = useRooms(); 	const createRoomProps = useCreateRoom(); 	const joinRoomProps = useJoinRoom();  	return ( 		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative"> 			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} /> 			<BackButton /> 			<div className="absolute inset-0 z-10 flex flex-col mt-30"> 				<RoomList 					filter={filter} 					setFilter={setFilter} 					filteredRooms={filteredRooms} 					setShowCreate={createRoomProps.setShowCreate} 					handleJoinRoom={joinRoomProps.handleJoinRoom} 				/> 			</div>  			<CreateRoomModal {...createRoomProps} /> 			<JoinRoomModal {...joinRoomProps} /> 		</div> 	); } import type { Metadata } from "next"; import { Geist, Geist_Mono } from "next/font/google"; import "./globals.css";  const geistSans = Geist({   variable: "--font-geist-sans",   subsets: ["latin"], });  const geistMono = Geist_Mono({   variable: "--font-geist-mono",   subsets: ["latin"], });  export const metadata: Metadata = {   title: "Create Next App",   description: "Generated by create next app", };  export default function RootLayout({   children, }: Readonly<{   children: React.ReactNode; }>) {   return (     <html       lang="en"       className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}     >       <body className="min-h-full flex flex-col">{children}</body>     </html>   ); } "use client";  import { useState, useMemo } from "react"; import { useRouter } from "next/navigation"; import { Piano } from "@/components/multiplayer/Piano"; import { generatePiano } from "../lib/piano"; import { useAudioEngine } from "../hooks/useAudioEngine"; import { VisNote } from "../lib/types"; import { Visualizer } from "@/components/multiplayer/Visualizer"; import { Navigation } from "@/components/layout/Navigation"; import { SilkBackground } from "@/components/effects/SilkBackground";  export default function App() { 	const [showKeys, setShowKeys] = useState(true); 	const [noteLines, setNoteLines] = useState<VisNote[]>([]); 	const [showHomeScreen, setShowHomeScreen] = useState(true); 	const pianoKeys = useMemo(() => generatePiano(), []);  	const router = useRouter();  	const { 		playNote, 		stopNote, 		unlockAudio, 		connectMIDI, 		midiDevices, 		midiError, 		soundfonts, 		currentSoundfont, 		loadedSoundfonts, 		loadingSoundfont, 		selectSoundfont, 		masterVolume, 		setMasterVolume, 	} = useAudioEngine(pianoKeys, setNoteLines);  	const handleMultiplayerClick = () => router.push("/multiplayer"); 	const handleProfileClick = () => router.push("/protected/profile");  	return ( 		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative"> 			{showHomeScreen ? ( 				<> 					<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} /> 					<div className="absolute inset-0 z-10"> 						<div className="absolute bottom-0 left-0 right-0 h-32"></div> 						<div className="absolute right-30 mt-30"> 							<div className="flex flex-col items-end"> 								<h1 className="text-[96px] font-black text-white tracking-wider mb-2 title">Away</h1> 								<p 									className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-20" 									onClick={() => { 										setShowHomeScreen(false); 										unlockAudio(); 									}} 								> 									Solo mode 								</p> 								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleMultiplayerClick}> 									Multiplayer mode 								</p> 								<p className="text-2xl italic text-gray-400 cursor-pointer hover:text-white transition-colors mt-5" onClick={handleProfileClick}> 									Profile 								</p> 							</div> 						</div> 					</div> 				</> 			) : ( 				<> 					<SilkBackground color="#0b0416" scale={1} noiseIntensity={1.3} speed={3} rotation={270} /> 					<div className="absolute inset-0 z-10 flex flex-col"> 						<Navigation 							onLogout={() => setShowHomeScreen(true)} 							midiDevices={midiDevices} 							midiError={midiError} 							onRetryMidi={() => connectMIDI()} 							soundfonts={soundfonts} 							currentSoundfont={currentSoundfont} 							loadedSoundfonts={loadedSoundfonts} 							loadingSoundfont={loadingSoundfont} 							onSelectSoundfont={selectSoundfont} 							masterVolume={masterVolume} 							onMasterVolumeChange={setMasterVolume} 						/> 						<Visualizer noteLines={noteLines} /> 						<Piano pianoKeys={pianoKeys} showKeys={showKeys} onPlayNote={playNote} onStopNote={stopNote} /> 					</div> 				</> 			)} 		</div> 	); }"use client";  import { useState, useRef, useEffect } from "react"; import type { ChatMessage } from "@/hooks/useChat";  interface ChatPanelProps {   messages: ChatMessage[];   myId: string;   myName: string;   isLoggedIn: boolean;   onSend: (text: string) => void;   onClose: () => void;   onLoginClick: () => void; }  export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, myId, myName, isLoggedIn, onSend, onClose, onLoginClick }) => {   const [input, setInput] = useState("");   const bottomRef = useRef<HTMLDivElement>(null);    useEffect(() => {     bottomRef.current?.scrollIntoView({ behavior: "smooth" });   }, [messages]);    const handleSend = () => {     const trimmed = input.trim();     if (!trimmed) return;     onSend(trimmed);     setInput("");   };    return (     <div       className="flex flex-col h-full border-l border-white/8 bg-[#0a0118]/80 backdrop-blur-xl relative z-6000"       style={{ width: "300px", flexShrink: 0 }}     >       {/* Header */}       <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">         <span className="text-white/60 text-xs uppercase tracking-widest font-medium">Live Chat</span>         <button           onClick={onClose}           className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"         >           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">             <path d="M18 6L6 18M6 6l12 12" />           </svg>         </button>       </div>        {/* Messages Area - Always Visible */}       <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">         {messages.length === 0 && <p className="text-white/20 text-xs text-center mt-8">No messages yet. Say something!</p>}         {messages.map((msg) => {           const isMe = msg.senderId === myId;           return (             <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>               <span className="text-[10px] text-white/30 font-mono px-1">{isMe ? myName || "You" : msg.senderName}</span>               <div                 className={`px-3 py-2 rounded-xl text-sm max-w-[220px] break-words leading-relaxed ${                   isMe ? "bg-white/10 text-white rounded-tr-none" : "bg-white/5 text-white/80 rounded-tl-none border border-white/8"                 }`}               >                 {msg.text}               </div>             </div>           );         })}         <div ref={bottomRef} />       </div>        {/* Conditionally Render Input OR Login Button */}       <div className="px-4 py-4 border-t border-white/8">         {isLoggedIn ? (           <div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/8 px-3 py-2 focus-within:border-white/20 transition-colors">             <input               type="text"               value={input}               onChange={(e) => setInput(e.target.value)}               onKeyDown={(e) => e.key === "Enter" && handleSend()}               placeholder="Type message here"               className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none"             />             <button onClick={handleSend} disabled={!input.trim()} className="text-white/30 hover:text-white transition-colors disabled:opacity-20">               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">                 <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />               </svg>             </button>           </div>         ) : (           <div className="flex flex-col items-center justify-center gap-3 py-2">             <p className="text-white/40 text-xs">You need to be logged in to chat</p>             <button               onClick={onLoginClick}               className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors"             >               Log in to send messages             </button>           </div>         )}       </div>     </div>   ); };  "use client";  import React, { useState, useEffect } from "react"; import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass"; import type { SoundfontOption } from "@/hooks/useAudioEngine";  type TabKey = "General" | "MIDI" | "Keyboard" | "Visualisation";  const TABS: TabKey[] = ["General", "MIDI", "Keyboard", "Visualisation"];  interface NavigationProps { 	onLogout?: () => void; 	isChatOpen?: boolean; 	onToggleChat?: () => void; 	chatAnchorRef?: React.RefObject<HTMLDivElement | null>; 	midiDevices?: string[]; 	midiError?: string | null; 	onRetryMidi?: () => void; 	soundfonts?: SoundfontOption[]; 	currentSoundfont?: string; 	loadedSoundfonts?: string[]; 	loadingSoundfont?: string | null; 	onSelectSoundfont?: (key: string) => void; 	masterVolume?: number; 	onMasterVolumeChange?: (v: number) => void; 	username?: string; 	onUsernameChange?: (name: string) => void; 	onToggleRecord?: () => void; 	isRecording?: boolean; }  const SpeakerIcon = ({ muted }: { muted?: boolean }) => ( 	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-white/70"> 		<path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" /> 		{!muted && ( 			<> 				<path d="M15.54 8.46a5 5 0 010 7.07" strokeLinecap="round" /> 				<path d="M19.07 4.93a10 10 0 010 14.14" strokeLinecap="round" /> 			</> 		)} 	</svg> );  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => ( 	<button 		onClick={() => onChange(!value)} 		className={`relative w-14 h-7 rounded-full transition-colors ${value ? "bg-purple-500" : "bg-white/10 border border-white/15"}`} 	> 		<span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${value ? "translate-x-7" : "translate-x-0.5"}`} /> 	</button> );  export const Navigation = ({ 	onLogout, 	isChatOpen, 	onToggleChat, 	chatAnchorRef, 	midiDevices = [], 	midiError = null, 	onRetryMidi, 	soundfonts = [], 	currentSoundfont, 	loadedSoundfonts = [], 	loadingSoundfont = null, 	onSelectSoundfont, 	masterVolume = 75, 	onMasterVolumeChange, 	username = "", 	onUsernameChange, 	onToggleRecord, 	isRecording = false, }: NavigationProps) => { 	const [showSettings, setShowSettings] = useState(false); 	const [activeTab, setActiveTab] = useState<TabKey>("General"); 	const [usernameDraft, setUsernameDraft] = useState(username); 	const [invisibleMode, setInvisibleMode] = useState(false);  	useEffect(() => { 		setUsernameDraft(username); 	}, [username]);  	const currentName = soundfonts.find((s) => s.key === currentSoundfont)?.name || "Salamander Grand Piano";  	const openSettings = () => { 		setShowSettings(true); 		onRetryMidi?.(); 	}; 	const closeSettings = () => setShowSettings(false);  	const handleApplyUsername = () => { 		const trimmed = usernameDraft.trim(); 		if (trimmed && trimmed !== username) onUsernameChange?.(trimmed); 	};  	return ( 		<> 			<div style={{ position: "absolute", top: "2%", right: "1%", zIndex: 50 }}> 				<div className="flex flex-col items-center"> 					<DynamicLiquidGlass width={290} height={60} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}> 						<h1 className="text-white font-semibold tracking-wide text-lg pointer-events-none truncate px-3"> 							{loadingSoundfont === currentSoundfont ? "Loading…" : currentName} 						</h1> 					</DynamicLiquidGlass> 				</div> 			</div>  			<div style={{ position: "absolute", top: "11%", right: "1%", zIndex: 50 }}> 				<div className="flex gap-6 items-center"> 					<div onClick={onToggleRecord} className="cursor-pointer" style={{ pointerEvents: "auto" }}> 						<DynamicLiquidGlass 							width={67} 							height={67} 							radius={15} 							refractionLevel={0.8} 							specularOpacity={0.7} 							glassBgOpacity={isRecording ? 0.2 : 0.001} 							blur={2} 						> 							<svg xmlns="__http://www.w3.org/2000/svg____["](http://www.w3.org/2000/svg%22)__ width="51" height="51" viewBox="0 0 51 51" fill="none"> 								<rect width="51" height="51" rx="10" fill="black" fillOpacity="0.01" /> 								<ellipse cx="25.5" cy="26" rx="9.5" ry="9" fill="#AA0000" /> 							</svg> 						</DynamicLiquidGlass> 					</div>  					<div onClick={openSettings} className="cursor-pointer" style={{ pointerEvents: "auto" }}> 						<DynamicLiquidGlass 							width={67} 							height={67} 							radius={15} 							refractionLevel={0.8} 							specularOpacity={0.7} 							glassBgOpacity={showSettings ? 0.15 : 0.001} 						> 							<img src="/icons/Wrench.svg" alt="Settings" style={{ width: "35px", height: "35px", objectFit: "contain" }} /> 						</DynamicLiquidGlass> 					</div>  					<div onClick={onLogout} className="cursor-pointer" style={{ pointerEvents: "auto" }}> 						<DynamicLiquidGlass width={67} height={67} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}> 							<img src="/icons/Logout.svg" alt="Logout" style={{ width: "35px", height: "35px", objectFit: "contain" }} /> 						</DynamicLiquidGlass> 					</div> 				</div>  				{onToggleChat && !isChatOpen && ( 					<div onClick={onToggleChat} className="cursor-pointer relative mt-5"> 						<DynamicLiquidGlass 							width={160} 							height={60} 							radius={15} 							refractionLevel={0.8} 							specularOpacity={0.7} 							glassBgOpacity={isChatOpen ? 0.15 : 0.001} 						> 							<div className="w-full h-full text-xl flex items-center justify-center text-white gap-2"> 								Open chat 								<img src="/icons/message.svg" alt="" /> 							</div> 						</DynamicLiquidGlass> 					</div> 				)}  				<div ref={chatAnchorRef} style={{ height: 0 }} /> 			</div>  			{showSettings && ( 				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeSettings}> 					<div 						onClick={(e) => e.stopPropagation()} 						className="w-full max-w-5xl mx-4 rounded-2xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl shadow-2xl overflow-hidden flex" 						style={{ height: "80vh", maxHeight: "650px" }} 					> 						<aside className="w-64 shrink-0 border-r border-white/10 px-8 py-10 flex flex-col"> 							<h2 className="text-white text-4xl font-light italic mb-14">Settings</h2> 							<nav className="flex flex-col gap-5"> 								{TABS.map((tab) => ( 									<button 										key={tab} 										onClick={() => setActiveTab(tab)} 										className={`text-xl italic text-left transition-colors ${ 											activeTab === tab ? "text-white font-medium" : "text-white/30 hover:text-white/60" 										}`} 									> 										{tab} 									</button> 								))} 							</nav> 						</aside>  						<div className="flex-1 px-12 py-10 overflow-y-auto relative"> 							<button 								onClick={closeSettings} 								className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white" 								aria-label="Close" 							> 								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"> 									<path d="M18 6L6 18M6 6l12 12" /> 								</svg> 							</button>  							{activeTab === "General" && ( 								<div className="flex flex-col gap-10 max-w-2xl pt-4"> 									<div className="flex items-center gap-5"> 										<label className="text-white text-lg italic whitespace-nowrap"> 											Master volume <span className="font-bold not-italic ml-2">{masterVolume}%</span> 										</label> 										<SpeakerIcon muted={masterVolume === 0} /> 										<input 											type="range" 											min={0} 											max={100} 											value={masterVolume} 											onChange={(e) => onMasterVolumeChange?.(Number(e.target.value))} 											className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white" 										/> 									</div>  									<div className="flex items-center gap-4"> 										<input 											type="text" 											value={usernameDraft} 											onChange={(e) => setUsernameDraft(e.target.value)} 											placeholder="Username" 											className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white italic outline-none focus:border-white/25 transition-colors" 										/> 										<button 											onClick={handleApplyUsername} 											className="px-5 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white italic hover:bg-white/10 transition-colors whitespace-nowrap" 										> 											Change username 										</button> 									</div>  									<div className="flex items-center justify-between pt-2"> 										<label className="text-white text-lg italic">Invisible mode</label> 										<Toggle value={invisibleMode} onChange={setInvisibleMode} /> 									</div> 								</div> 							)}  							{activeTab === "MIDI" && ( 								<div className="flex flex-col gap-4 max-w-2xl pt-4"> 									<div className="flex items-center justify-between"> 										<span className="text-white/60 text-xs uppercase tracking-widest font-medium">MIDI Inputs</span> 										<button 											onClick={() => onRetryMidi?.()} 											className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5" 										> 											Refresh 										</button> 									</div>  									{midiError && ( 										<div className="text-xs text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 leading-relaxed"> 											{midiError} 										</div> 									)}  									{midiDevices.length === 0 && !midiError && ( 										<p className="text-white/40 text-sm">No MIDI devices detected. Plug in your keyboard via USB and click Refresh.</p> 									)}  									{midiDevices.length > 0 && ( 										<ul className="space-y-2"> 											{midiDevices.map((d, i) => ( 												<li 													key={`${d}-${i}`} 													className="flex items-center gap-3 text-white text-sm bg-white/5 border border-white/10 rounded-lg px-4 py-3" 												> 													<span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" /> 													<span className="truncate">{d}</span> 												</li> 											))} 										</ul> 									)}  									<p className="text-[10px] text-white/30 leading-relaxed mt-2"> 										Brave: enable MIDI at brave://settings/content/midiSysex and reload. 									</p> 								</div> 							)}  							{activeTab === "Keyboard" && ( 								<div className="flex flex-col gap-3 max-w-2xl pt-4"> 									<span className="text-white/60 text-xs uppercase tracking-widest font-medium mb-1">Soundfont</span> 									<ul className="space-y-2"> 										{soundfonts.map((sf) => { 											const isActive = sf.key === currentSoundfont; 											const isLoaded = loadedSoundfonts.includes(sf.key); 											const isLoading = loadingSoundfont === sf.key; 											const dotClass = isActive 												? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" 												: isLoaded 													? "bg-blue-400" 													: isLoading 														? "bg-yellow-400 animate-pulse" 														: "bg-white/20"; 											const action = isActive ? "Active" : isLoading ? "Loading…" : isLoaded ? "Use" : "Load";  											return ( 												<li key={sf.key}> 													<button 														onClick={() => onSelectSoundfont?.(sf.key)} 														disabled={isActive || isLoading} 														className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors ${ 															isActive 																? "bg-white/10 border-white/25 text-white cursor-default" 																: "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white" 														} disabled:cursor-not-allowed`} 													> 														<div className="flex items-center gap-3 min-w-0"> 															<span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} /> 															<span className="text-sm truncate">{sf.name}</span> 														</div> 														<span 															className={`text-xs font-medium px-2 py-1 rounded ${ 																isActive 																	? "bg-green-500/20 text-green-300" 																	: isLoading 																		? "bg-yellow-500/20 text-yellow-300" 																		: isLoaded 																			? "bg-blue-500/20 text-blue-300" 																			: "bg-white/10 text-white/60" 															}`} 														> 															{action} 														</span> 													</button> 												</li> 											); 										})} 									</ul> 								</div> 							)}  							{activeTab === "Visualisation" && ( 								<div className="flex flex-col gap-4 max-w-2xl pt-4"> 									<p className="text-white/40 italic text-sm">Visualisation settings coming soon.</p> 								</div> 							)} 						</div> 					</div> 				</div> 			)} 		</> 	); }; "use client";  import { useRef, useMemo, useCallback, useEffect } from "react"; import { PianoKey } from "@/lib/types";  interface PianoProps { 	pianoKeys: PianoKey[]; 	showKeys: boolean; 	onPlayNote: (midi: number, velocity: number) => void; 	onStopNote: (midi: number) => void; }  export const Piano: React.FC<PianoProps> = ({ pianoKeys, showKeys, onPlayNote, onStopNote }) => { 	const containerRef = useRef<HTMLDivElement>(null); 	const isMouseDown = useRef(false); 	const activeKeyRef = useRef<number | null>(null);  	const whiteKeys = useMemo(() => pianoKeys.filter((k) => !k.isBlack), [pianoKeys]); 	const blackKeys = useMemo(() => pianoKeys.filter((k) => k.isBlack), [pianoKeys]);  	const startKey = useCallback( 		(midi: number) => { 			if (activeKeyRef.current === midi) return; 			if (activeKeyRef.current !== null) onStopNote(activeKeyRef.current); 			onPlayNote(midi, 127); 			activeKeyRef.current = midi; 		}, 		[onPlayNote, onStopNote], 	);  	const stopActiveKey = useCallback(() => { 		if (activeKeyRef.current !== null) { 			onStopNote(activeKeyRef.current); 			activeKeyRef.current = null; 		} 	}, [onStopNote]);  	const hitTest = useCallback( 		(clientX: number, clientY: number) => { 			const els = document.elementsFromPoint(clientX, clientY); 			for (const el of els) { 				if (!(el instanceof HTMLElement)) continue; 				const midiAttr = el.getAttribute("data-midi"); 				if (midiAttr) { 					const midi = parseInt(midiAttr, 10); 					if (!Number.isNaN(midi)) { 						startKey(midi); 						return; 					} 				} 			} 		}, 		[startKey], 	);  	useEffect(() => { 		const handleMouseUp = () => { 			isMouseDown.current = false; 			stopActiveKey(); 		}; 		const handleMouseMove = (e: MouseEvent) => { 			if (!isMouseDown.current) return; 			const container = containerRef.current; 			if (!container) return; 			const rect = container.getBoundingClientRect(); 			if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) { 				stopActiveKey(); 				return; 			} 			hitTest(e.clientX, e.clientY); 		}; 		window.addEventListener("mouseup", handleMouseUp); 		window.addEventListener("mousemove", handleMouseMove); 		return () => { 			window.removeEventListener("mouseup", handleMouseUp); 			window.removeEventListener("mousemove", handleMouseMove); 		}; 	}, [hitTest, stopActiveKey]);  	const handleKeyMouseDown = useCallback( 		(midi: number) => { 			isMouseDown.current = true; 			startKey(midi); 		}, 		[startKey], 	);  	const blackKeyWidthPct = (100 / 52) * 0.6;  	return ( 		<div 			ref={containerRef} 			className="myPiano w-full bg-[#111] relative select-none z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5" 			style={{ height: "150px", flexShrink: 0 }} 		> 			<div className="white-keys-container"> 				{whiteKeys.map((key) => ( 					<div 						key={key.midi} 						data-midi={key.midi} 						onMouseDown={() => handleKeyMouseDown(key.midi)} 						className="piano-key white" 						style={{ pointerEvents: "auto" }} 					/> 				))} 			</div>  			<div className="black-keys-container absolute top-0 left-0 w-full h-full" style={{ pointerEvents: "none" }}> 				{blackKeys.map((key) => { 					const center = ((key.whiteKeyIndex + 1) * 100) / 52; 					const left = center - blackKeyWidthPct / 2; 					return ( 						<div 							key={key.midi} 							data-midi={key.midi} 							onMouseDown={() => handleKeyMouseDown(key.midi)} 							style={{ left: `${left}%`, pointerEvents: "auto" }} 							className="piano-key black" 						/> 					); 				})} 			</div> 		</div> 	); }; "use client";  import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";  interface Player { 	id: string; 	displayName: string; 	colorIndex: number; 	isMe: boolean; 	isFriend?: boolean; }  interface PlayerListProps { 	players: Player[]; 	onAddFriend?: (id: string) => void; }  export const PlayerList: React.FC<PlayerListProps> = ({ players, onAddFriend }) => { 	return ( 		<div className="flex flex-col gap-4"> 			{players.map((player) => ( 				<div key={player.id} className="flex flex-col gap-1.5"> 					<div className="flex items-center gap-3"> 						<span className="text-white font-bold text-base tracking-wide">{player.isMe ? player.displayName : player.displayName}</span>  						{!player.isMe && player.isFriend && ( 							<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-5 h-5 opacity-60"> 								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /> 								<circle cx="9" cy="7" r="4" /> 								<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> 							</svg> 						)}  						{!player.isMe && !player.isFriend && onAddFriend && ( 							<button 								onClick={() => onAddFriend(player.id)} 								className="flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors text-sm" 							> 								<span className="text-lg leading-none">+</span> 								<span>Add friend</span> 							</button> 						)} 					</div>  					<div 						className="h-3.5 rounded-full" 						style={{ 							width: "160px", 							backgroundColor: PLAYER_COLORS_SOLID[player.colorIndex % PLAYER_COLORS_SOLID.length], 							opacity: 0.8, 						}} 					/> 				</div> 			))} 		</div> 	); }; import { AccessIcon } from "@/components/ui/AccessIcon"; import type { Room, Accessibility } from "@/hooks/useRooms"; import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass"; import { useState } from "react";  interface RoomListProps { 	filter: Accessibility; 	setFilter: (filter: Accessibility) => void; 	filteredRooms: Room[]; 	setShowCreate: (show: boolean) => void; 	handleJoinRoom: (room: Room) => void; }  export default function RoomList({ filter, setFilter, filteredRooms, setShowCreate, handleJoinRoom }: RoomListProps) { 	const [isHovered, setIsHovered] = useState(false); 	return ( 		<div className="flex flex-col items-center justify-center px-8"> 			<div className="w-full max-w-5xl flex items-center justify-between mb-25"> 				<button onClick={() => setShowCreate(true)}> 					<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}> 						<DynamicLiquidGlass 							width={198} 							height={69} 							radius={15} 							refractionLevel={0.8} 							specularOpacity={0.7} 							glassBgOpacity={isHovered ? 0.15 : 0.001} 						> 							<div className="w-full h-full text-xl flex items-center justify-center text-white">Create Room</div> 						</DynamicLiquidGlass> 					</div> 				</button>  				<div className="flex gap-2"> 					{(["public", "private", "friends"] as const).map((type) => ( 						<button key={type} onClick={() => setFilter(type)} className="hover:opacity-80 transition-opacity"> 							<AccessIcon type={type} /> 						</button> 					))} 				</div> 			</div> 			<div 				className="w-full max-w-6xl flex flex-col gap-4 relative custom-scrollbar" 				style={{ maxHeight: "65vh", overflowY: "auto", padding: "10px", paddingRight: "15px" }} 			> 				{filteredRooms.length === 0 ? ( 					<div className="flex flex-col items-center justify-center py-20 text-white"> 						<p className="text-sm">No rooms yet. Be the first to create one.</p> 					</div> 				) : ( 					filteredRooms.map((room) => { 						const isFull = room.current_players >= room.max_players; 						return ( 							<div key={room.id} className="flex justify-center w-full"> 								<DynamicLiquidGlass width={1030} height={90} radius={10} refractionLevel={0.8} specularOpacity={0.5} glassBgOpacity={0.001}> 									<div 										onClick={() => !isFull && handleJoinRoom(room)} 										className={`flex items-center justify-between w-full h-full  cursor-pointer rounded-2xl transition-colors group ${ 											isFull ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5" 										}`} 									> 										<DynamicLiquidGlass width={157} height={90} radius={10} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}> 											{room.host} 										</DynamicLiquidGlass>  										<div className="flex-1 px-8 text-lg font-semibold italic text-white/90 group-hover:text-white transition-colors truncate text-center"> 											{room.name} 										</div>  										<div className="flex items-center gap-6 shrink-0 text-white mt-10"> 											<div className="flex flex-col items-center gap-2"> 												<AccessIcon type={room.accessibility} glass={false} text={false} /> 												<DynamicLiquidGlass width={107} height={46} radius={10} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={0.001}> 													<div className="text-s font-mono flex items-start gap-1 mb-3"> 														<img src="/icons/Person.svg" alt="" /> 														<h2> 															{room.current_players}/{room.max_players} 														</h2> 													</div> 												</DynamicLiquidGlass> 											</div> 										</div> 									</div> 								</DynamicLiquidGlass> 							</div> 						); 					}) 				)} 			</div> 		</div> 	); }"use client";  import { useRef, useEffect } from "react"; import { VisNote } from "@/lib/types";  interface VisualizerProps { 	noteLines: VisNote[]; 	className?: string; }  export const Visualizer: React.FC<VisualizerProps> = ({ noteLines, className = "" }) => { 	const canvasRef = useRef<HTMLCanvasElement>(null); 	const noteLinesRef = useRef<VisNote[]>([]); 	useEffect(() => { 		noteLinesRef.current = noteLines; 	}, [noteLines]);  	useEffect(() => { 		const canvas = canvasRef.current; 		if (!canvas) return; 		const ctx = canvas.getContext("2d"); 		if (!ctx) return;  		let animationFrameId: number; 		const speed = 0.4;  		const resizeCanvas = () => { 			const parent = canvas.parentElement; 			if (!parent) return; 			const dpr = window.devicePixelRatio || 1; 			canvas.width = parent.clientWidth * dpr; 			canvas.height = parent.clientHeight * dpr; 			ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 		};  		window.addEventListener("resize", resizeCanvas); 		const resizeObserver = new ResizeObserver(resizeCanvas); 		resizeObserver.observe(canvas.parentElement!); 		resizeCanvas();  		const WHITE_NOTE_RATIO = 0.9; 		const BLACK_NOTE_RATIO = 0.6;  		const draw = () => { 			const width = canvas.offsetWidth; 			const height = canvas.offsetHeight; 			const now = performance.now();  			ctx.clearRect(0, 0, width, height);  			const whiteKeyWidth = width / 52; 			const whiteNoteWidth = whiteKeyWidth * WHITE_NOTE_RATIO; 			const whiteSideMargin = (whiteKeyWidth - whiteNoteWidth) / 2; 			const blackNoteWidth = whiteKeyWidth * BLACK_NOTE_RATIO;  			for (let i = 0; i < noteLinesRef.current.length; i++) { 				const note = noteLinesRef.current[i];  				const yEnd = height - (now - note.startTime) * speed; 				const yStart = note.endTime ? height - (now - note.endTime) * speed : height; 				const noteHeight = Math.max(yStart - yEnd, 8);  				if (yStart < -100) continue;  				let x: number, w: number; 				if (note.isBlack) { 					w = blackNoteWidth; 					x = (note.whiteKeyIndex + 1) * whiteKeyWidth - w / 2; 				} else { 					w = whiteNoteWidth; 					x = note.whiteKeyIndex * whiteKeyWidth + whiteSideMargin; 				}  				ctx.fillStyle = note.color; 				ctx.beginPath(); 				if (ctx.roundRect) { 					ctx.roundRect(x, yEnd, w, noteHeight, [6, 6, 6, 6]); 				} else { 					ctx.rect(x, yEnd, w, noteHeight); 				} 				ctx.fill(); 			}  			animationFrameId = requestAnimationFrame(draw); 		};  		draw();  		return () => { 			window.removeEventListener("resize", resizeCanvas); 			resizeObserver.disconnect(); 			cancelAnimationFrame(animationFrameId); 		}; 	}, []);  	return ( 		<div className={`relative z-10 w-full h-full ${className}`}> 			<canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} /> 		</div> 	); };export { useChat } from "./useChat";  "use client";  import { useRef, useCallback, useEffect, useState } from "react"; import * as Tone from "tone"; import { initAudioContext, createSampler, createReverb, createMasterVolume } from "../lib/audio"; import { VisNote, PianoKey, instruments, DEFAULT_SOUNDFONT } from "../lib/types"; import { PLAYER_COLORS_SOLID } from "@/lib/playerColors";  const SELF = "self"; const DEFAULT_VOLUME_PERCENT = 75;  export type SoundfontOption = { key: string; name: string };  function percentToDb(percent: number): number { 	if (percent <= 0) return -60; 	return -40 + (percent / 100) * 46; }  export const useAudioEngine = (pianoKeys: PianoKey[], setNoteLines: React.Dispatch<React.SetStateAction<VisNote[]>>) => { 	const audioStartedRef = useRef(false); 	const samplersRef = useRef<Map<string, Tone.Sampler>>(new Map()); 	const samplerRef = useRef<Tone.Sampler | null>(null); 	const reverbRef = useRef<Tone.Reverb | null>(null); 	const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);  	const noteHoldersRef = useRef<Map<number, Set<string>>>(new Map()); 	const sustainedNotesRef = useRef<Set<number>>(new Set()); 	const isSustainOnRef = useRef(false); 	const visNotesRef = useRef<VisNote[]>([]); 	const initializedRef = useRef(false);  	const [midiDevices, setMidiDevices] = useState<string[]>([]); 	const [midiError, setMidiError] = useState<string | null>(null);  	const [currentSoundfont, setCurrentSoundfont] = useState<string>(DEFAULT_SOUNDFONT); 	const [loadedSoundfonts, setLoadedSoundfonts] = useState<string[]>([]); 	const [loadingSoundfont, setLoadingSoundfont] = useState<string | null>(null);  	const [masterVolume, setMasterVolumeState] = useState<number>(DEFAULT_VOLUME_PERCENT);  	const setMasterVolume = useCallback((percent: number) => { 		const clamped = Math.max(0, Math.min(100, percent)); 		setMasterVolumeState(clamped); 		if (masterVolumeNodeRef.current) { 			masterVolumeNodeRef.current.mute = clamped === 0; 			masterVolumeNodeRef.current.volume.rampTo(percentToDb(clamped), 0.02); 		} 	}, []);  	const soundfonts: SoundfontOption[] = Object.entries(instruments).map(([key, val]) => ({ 		key, 		name: val.name, 	}));  	const unlockAudio = useCallback(async () => { 		if (audioStartedRef.current) return; 		try { 			await Tone.start(); 			audioStartedRef.current = true; 		} catch (error) { 			console.error("Browser blocked audio start:", error); 		} 	}, []);  	const playNote = useCallback( 		(midi: number, vel: number = 0.7, playerId: string = SELF, colorOverride?: string, solidColorOverride?: string) => { 			let holders = noteHoldersRef.current.get(midi); 			if (!holders) { 				holders = new Set(); 				noteHoldersRef.current.set(midi, holders); 			} 			if (holders.has(playerId)) return; 			holders.add(playerId); 			sustainedNotesRef.current.delete(midi);  			const keyEl = document.querySelector(`[data-midi="${midi}"]`) as HTMLElement | null; 			if (keyEl) { 				const solidColor = solidColorOverride ?? PLAYER_COLORS_SOLID[0]; 				keyEl.style.setProperty("--active-color", solidColor); 				keyEl.classList.add("active"); 			}  			const normalizedVel = vel > 1 ? vel / 127 : vel;  			if (audioStartedRef.current && samplerRef.current && samplerRef.current.loaded) { 				samplerRef.current.triggerAttack(Tone.Frequency(midi, "midi").toNote(), Tone.immediate(), normalizedVel); 			}  			const keyInfo = pianoKeys.find((k) => k.midi === midi); 			if (keyInfo) { 				const whiteKeyWidth = window.innerWidth / 52; 				let x, w; 				if (keyInfo.isBlack) { 					w = whiteKeyWidth * 0.6; 					x = (keyInfo.whiteKeyIndex + 1) * whiteKeyWidth - w / 2; 				} else { 					w = whiteKeyWidth; 					x = keyInfo.whiteKeyIndex * whiteKeyWidth; 				}  				const noteColor = colorOverride ?? keyInfo.color;  				const newNote: VisNote = { 					id: Math.random().toString(), 					midi, 					startTime: performance.now(), 					endTime: null, 					isBlack: keyInfo.isBlack, 					whiteKeyIndex: keyInfo.whiteKeyIndex, 					color: noteColor, 					x, 					w, 					playerId, 				};  				visNotesRef.current.push(newNote); 				setNoteLines([...visNotesRef.current]); 			} 		}, 		[pianoKeys, setNoteLines], 	);  	const stopNote = useCallback((midi: number, playerId: string = SELF) => { 		const holders = noteHoldersRef.current.get(midi); 		if (!holders || !holders.has(playerId)) return; 		holders.delete(playerId);  		const pendingNote = visNotesRef.current.findLast((n) => n.midi === midi && n.endTime === null && n.playerId === playerId); 		if (pendingNote) pendingNote.endTime = performance.now();  		if (holders.size === 0) { 			noteHoldersRef.current.delete(midi); 			const keyEl = document.querySelector(`[data-midi="${midi}"]`); 			keyEl?.classList.remove("active");  			if (isSustainOnRef.current) { 				sustainedNotesRef.current.add(midi); 			} else if (samplerRef.current) { 				samplerRef.current.triggerRelease(Tone.Frequency(midi, "midi").toNote(), Tone.immediate()); 			} 		} 	}, []);  	const releaseAllForPlayer = useCallback( 		(playerId: string) => { 			const midis: number[] = []; 			noteHoldersRef.current.forEach((holders, midi) => { 				if (holders.has(playerId)) midis.push(midi); 			}); 			midis.forEach((m) => stopNote(m, playerId)); 		}, 		[stopNote], 	);  	const loadSoundfont = useCallback((key: string): Promise<void> => { 		return new Promise((resolve, reject) => { 			if (!instruments[key]) return reject(new Error("Unknown soundfont")); 			if (samplersRef.current.has(key)) return resolve(); 			if (!reverbRef.current) return reject(new Error("Audio not initialized"));  			setLoadingSoundfont(key); 			const sampler = createSampler(key, () => { 				setLoadedSoundfonts((prev) => (prev.includes(key) ? prev : [...prev, key])); 				setLoadingSoundfont((prev) => (prev === key ? null : prev)); 				resolve(); 			}); 			sampler.connect(reverbRef.current); 			samplersRef.current.set(key, sampler); 		}); 	}, []);  	const selectSoundfont = useCallback( 		async (key: string) => { 			if (!instruments[key]) return; 			if (!samplersRef.current.has(key)) { 				try { 					await loadSoundfont(key); 				} catch { 					return; 				} 			} 			const next = samplersRef.current.get(key); 			if (next) { 				samplerRef.current = next; 				setCurrentSoundfont(key); 			} 		}, 		[loadSoundfont], 	);  	const connectMIDI = useCallback( 		(onPlay: (note: number, velocity: number) => void = (n, v) => playNote(n, v), onStop: (note: number) => void = (n) => stopNote(n)) => { 			const nav = navigator as any; 			if (!nav.requestMIDIAccess) { 				setMidiError("Web MIDI is not enabled in this browser. In Brave, open brave://settings/content/midiSysex and enable MIDI for this site."); 				setMidiDevices([]); 				return; 			} 			nav 				.requestMIDIAccess({ sysex: false }) 				.then((m: any) => { 					setMidiError(null); 					const refresh = () => { 						const names: string[] = []; 						m.inputs.forEach((i: any) => { 							names.push(i.name || "Unknown MIDI device"); 							i.onmidimessage = (msg: any) => { 								unlockAudio(); 								const [cmd, note, vel] = msg.data; 								const command = cmd >> 4;  								if (command === 11 && note === 64) { 									const pedalPressed = vel >= 64; 									isSustainOnRef.current = pedalPressed; 									if (!pedalPressed) { 										sustainedNotesRef.current.forEach((sustainedMidi) => { 											samplerRef.current?.triggerRelease(Tone.Frequency(sustainedMidi, "midi").toNote(), Tone.immediate()); 										}); 										sustainedNotesRef.current.clear(); 									} 								} else if (command === 9 && vel > 0) { 									onPlay(note, vel); 								} else if (command === 8 || (command === 9 && vel === 0)) { 									onStop(note); 								} 							}; 						}); 						setMidiDevices(names); 					}; 					refresh(); 					m.onstatechange = refresh; 				}) 				.catch((err: any) => { 					setMidiError("MIDI access denied: " + (err?.message || String(err))); 					setMidiDevices([]); 				}); 		}, 		[playNote, stopNote, unlockAudio], 	);  	useEffect(() => { 		if (initializedRef.current) return; 		initializedRef.current = true;  		const init = async () => { 			await initAudioContext();  			masterVolumeNodeRef.current = createMasterVolume(percentToDb(DEFAULT_VOLUME_PERCENT)); 			reverbRef.current = createReverb(0.2, masterVolumeNodeRef.current);  			setLoadingSoundfont(DEFAULT_SOUNDFONT); 			const sampler = createSampler(DEFAULT_SOUNDFONT, () => { 				setLoadedSoundfonts([DEFAULT_SOUNDFONT]); 				setLoadingSoundfont(null); 				connectMIDI(); 			}); 			sampler.connect(reverbRef.current); 			samplersRef.current.set(DEFAULT_SOUNDFONT, sampler); 			samplerRef.current = sampler; 		}; 		init(); 	}, [connectMIDI]);  	return { 		playNote, 		stopNote, 		unlockAudio, 		connectMIDI, 		releaseAllForPlayer, 		midiDevices, 		midiError, 		soundfonts, 		currentSoundfont, 		loadedSoundfonts, 		loadingSoundfont, 		selectSoundfont, 		masterVolume, 		setMasterVolume, 	}; };import { useState, useCallback } from "react";  export type ChatMessage = {   id: string;   senderId: string;   senderName: string;   text: string;   timestamp: number; };  export function useChat(myId: string) {   const [messages, setMessages] = useState<ChatMessage[]>([]);   const [isChatOpen, setIsChatOpen] = useState(false);    const addMessage = useCallback((msg: ChatMessage) => {     setMessages((prev) => [...prev, msg]);   }, []);    return {     messages,     isChatOpen,     setIsChatOpen,     addMessage,   }; } import { useState, useCallback } from "react";  export type ChatMessage = {   id: string;   senderId: string;   senderName: string;   text: string;   timestamp: number; };  export function useChat(myId: string) {   const [messages, setMessages] = useState<ChatMessage[]>([]);   const [isChatOpen, setIsChatOpen] = useState(false);    const addMessage = useCallback((msg: ChatMessage) => {     setMessages((prev) => [...prev, msg]);   }, []);    return {     messages,     isChatOpen,     setIsChatOpen,     addMessage,   }; }  "use client";  import { useState } from "react"; import { useRouter } from "next/navigation"; import { supabase } from "@/lib/supabase"; import type { Accessibility, Room, CreateStep } from "./useRooms";  export type { CreateStep };  export function getOrCreatePlayerId(): string { 	if (typeof window === "undefined") return "Player-0000"; 	const existing = sessionStorage.getItem("playerId"); 	if (existing) return existing; 	const newId = `Player-${Math.floor(Math.random() * 9000)}`; 	sessionStorage.setItem("playerId", newId); 	return newId; }  export const myTempId = getOrCreatePlayerId();  export function useCreateRoom() { 	const router = useRouter(); 	const [showCreate, setShowCreate] = useState(false); 	const [createStep, setCreateStep] = useState<CreateStep>("settings"); 	const [accessibility, setAccessibility] = useState<Accessibility>("public"); 	const [password, setPassword] = useState(""); 	const [maxPlayers, setMaxPlayers] = useState(4); 	const [roomName, setRoomName] = useState("");  	const handleCreateRoom = async () => { 		if (!roomName.trim()) return;  		const roomId = Math.random().toString(36).substring(2, 7); 		const newRoom: Room = { 			id: roomId, 			name: roomName.trim(), 			host: myTempId, 			accessibility, 			password: accessibility === "private" ? password : null, 			max_players: maxPlayers, 			current_players: 1, 			created_at: new Date().toISOString(), 		};  		const { error } = await supabase.from("rooms").insert(newRoom); 		if (!error) { 			sessionStorage.setItem("hostedRoomId", roomId); 			router.push(`/jam/${roomId}`); 		} 	};  	const resetCreate = () => { 		setShowCreate(false); 		setCreateStep("settings"); 		setAccessibility("public"); 		setPassword(""); 		setMaxPlayers(4); 		setRoomName(""); 	};  	return { 		showCreate, 		setShowCreate, 		createStep, 		setCreateStep, 		accessibility, 		setAccessibility, 		password, 		setPassword, 		maxPlayers, 		setMaxPlayers, 		roomName, 		setRoomName, 		handleCreateRoom, 		resetCreate, 	}; } "use client";  import { useState } from "react"; import { useRouter } from "next/navigation"; import { supabase } from "@/lib/supabase"; import type { Room } from "./useRooms";  export function useJoinRoom() { 	const router = useRouter(); 	const [joiningRoom, setJoiningRoom] = useState<Room | null>(null); 	const [joinPassword, setJoinPassword] = useState(""); 	const [joinError, setJoinError] = useState("");  	const handleJoinRoom = async (room: Room) => { 		if (room.current_players >= room.max_players) return;  		if (room.accessibility === "private") { 			setJoiningRoom(room); 			return; 		}  		await supabase 			.from("rooms") 			.update({ current_players: room.current_players + 1 }) 			.eq("id", room.id);  		router.push(`/jam/${room.id}`); 	};  	const handleJoinWithPassword = async () => { 		if (!joiningRoom) return; 		if (joinPassword !== joiningRoom.password) { 			setJoinError("Wrong password"); 			return; 		} 		await supabase 			.from("rooms") 			.update({ current_players: joiningRoom.current_players + 1 }) 			.eq("id", joiningRoom.id);  		router.push(`/jam/${joiningRoom.id}`); 	};  	const resetJoin = () => { 		setJoiningRoom(null); 		setJoinPassword(""); 		setJoinError(""); 	};  	return { 		joiningRoom, 		setJoiningRoom, 		joinPassword, 		setJoinPassword, 		joinError, 		setJoinError, 		handleJoinRoom, 		handleJoinWithPassword, 		resetJoin, 	}; } "use client";  import { useState, useEffect, useCallback } from "react"; import { supabase } from "@/lib/supabase";  export type Accessibility = "public" | "private" | "friends";  export type Room = { 	id: string; 	name: string; 	host: string; 	accessibility: Accessibility; 	password: string | null; 	max_players: number; 	current_players: number; 	created_at: string; };  export type CreateStep = "settings" | "name";  export function useRooms() { 	const [rooms, setRooms] = useState<Room[]>([]); 	const [filter, setFilter] = useState<Accessibility>("public");  	const fetchRooms = useCallback(async () => { 		const { data } = await supabase.from("rooms").select("*").order("created_at", { ascending: false }); 		if (data) setRooms(data); 	}, []);  	useEffect(() => { 		fetchRooms();  		const channel = supabase 			.channel("rooms-list") 			.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => { 				fetchRooms(); 			}) 			.subscribe();  		return () => { 			supabase.removeChannel(channel); 		}; 	}, [fetchRooms]);  	const filteredRooms = rooms.filter((r) => r.accessibility === filter);  	return { rooms, filter, setFilter, filteredRooms, fetchRooms }; } import { useRef, useState, useCallback, useEffect } from "react";  type SignalPayload = { 	type: "offer" | "answer" | "candidate"; 	targetId: string; 	offer?: RTCSessionDescriptionInit; 	answer?: RTCSessionDescriptionInit; 	candidate?: RTCIceCandidateInit; };  type PeerInfo = { 	pc: RTCPeerConnection; 	dc: RTCDataChannel | null; 	iceQueue: RTCIceCandidateInit[]; 	makingOffer: boolean; 	polite: boolean; };  export type ReceivedNoteHandler = (peerId: string, note: number, velocity: number, isNoteOn: boolean) => void;  const ICE_CONFIG: RTCConfiguration = { 	iceServers: [{ urls: "stun:stun.l.google.com:19302" }], };  export function useWebRTC(myId: string, onReceiveNote: ReceivedNoteHandler) { 	const peersRef = useRef<Map<string, PeerInfo>>(new Map()); 	const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());  	const onReceiveNoteRef = useRef(onReceiveNote); 	useEffect(() => { 		onReceiveNoteRef.current = onReceiveNote; 	}, [onReceiveNote]);  	const markConnected = useCallback((peerId: string, connected: boolean) => { 		setConnectedPeers((prev) => { 			const next = new Set(prev); 			if (connected) next.add(peerId); 			else next.delete(peerId); 			return next; 		}); 	}, []);  	const setupDataChannel = useCallback( 		(peerId: string, dc: RTCDataChannel) => { 			const peer = peersRef.current.get(peerId); 			if (peer) peer.dc = dc;  			dc.onopen = () => markConnected(peerId, true); 			dc.onclose = () => markConnected(peerId, false); 			dc.onmessage = (event) => { 				try { 					const data = JSON.parse(event.data); 					if (data.type === "midi") { 						onReceiveNoteRef.current(peerId, data.note, data.velocity, data.isNoteOn); 					} 				} catch {} 			}; 		}, 		[markConnected], 	);  	const removePeer = useCallback( 		(peerId: string) => { 			const peer = peersRef.current.get(peerId); 			if (!peer) return; 			try { 				peer.dc?.close(); 			} catch {} 			try { 				peer.pc.close(); 			} catch {} 			peersRef.current.delete(peerId); 			markConnected(peerId, false); 		}, 		[markConnected], 	);  	const createPeerConnection = useCallback( 		(peerId: string, sendSignal: (s: SignalPayload) => void): PeerInfo => { 			const pc = new RTCPeerConnection(ICE_CONFIG); 			const polite = myId < peerId ? false : true; 			const info: PeerInfo = { pc, dc: null, iceQueue: [], makingOffer: false, polite }; 			peersRef.current.set(peerId, info);  			pc.onicecandidate = (e) => { 				if (e.candidate) { 					sendSignal({ type: "candidate", targetId: peerId, candidate: e.candidate.toJSON() }); 				} 			}; 			pc.ondatachannel = (e) => setupDataChannel(peerId, e.channel); 			pc.onconnectionstatechange = () => { 				if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") { 					markConnected(peerId, false); 				} 			};  			return info; 		}, 		[myId, markConnected, setupDataChannel], 	);  	const initiateConnection = useCallback( 		async (peerId: string, sendSignal: (s: SignalPayload) => void) => { 			if (peersRef.current.has(peerId)) return; 			const info = createPeerConnection(peerId, sendSignal); 			const dc = info.pc.createDataChannel("piano-notes"); 			setupDataChannel(peerId, dc);  			try { 				info.makingOffer = true; 				const offer = await info.pc.createOffer(); 				await info.pc.setLocalDescription(offer); 				sendSignal({ type: "offer", targetId: peerId, offer }); 			} catch (err) { 				console.error("createOffer failed", err); 			} finally { 				info.makingOffer = false; 			} 		}, 		[createPeerConnection, setupDataChannel], 	);  	const handleOffer = useCallback( 		async (peerId: string, offer: RTCSessionDescriptionInit, sendSignal: (s: SignalPayload) => void) => { 			let info = peersRef.current.get(peerId); 			if (!info) { 				info = createPeerConnection(peerId, sendSignal); 			}  			const offerCollision = info.makingOffer || info.pc.signalingState !== "stable"; 			if (offerCollision && !info.polite) return;  			try { 				await info.pc.setRemoteDescription(new RTCSessionDescription(offer)); 				info.iceQueue.forEach((c) => info!.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})); 				info.iceQueue = [];  				const answer = await info.pc.createAnswer(); 				await info.pc.setLocalDescription(answer); 				sendSignal({ type: "answer", targetId: peerId, answer }); 			} catch (err) { 				console.error("handleOffer failed", err); 			} 		}, 		[createPeerConnection], 	);  	const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => { 		const info = peersRef.current.get(peerId); 		if (!info) return; 		if (info.pc.signalingState === "have-local-offer") { 			try { 				await info.pc.setRemoteDescription(new RTCSessionDescription(answer)); 				info.iceQueue.forEach((c) => info.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})); 				info.iceQueue = []; 			} catch (err) { 				console.error("handleAnswer failed", err); 			} 		} 	}, []);  	const handleCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => { 		const info = peersRef.current.get(peerId); 		if (!info) return; 		if (info.pc.remoteDescription) { 			try { 				await info.pc.addIceCandidate(new RTCIceCandidate(candidate)); 			} catch {} 		} else { 			info.iceQueue.push(candidate); 		} 	}, []);  	const broadcastNote = useCallback((note: number, velocity: number, isNoteOn: boolean) => { 		const msg = JSON.stringify({ type: "midi", note, velocity, isNoteOn }); 		peersRef.current.forEach((peer) => { 			if (peer.dc?.readyState === "open") { 				try { 					peer.dc.send(msg); 				} catch {} 			} 		}); 	}, []);  	const hasPeer = useCallback((peerId: string) => peersRef.current.has(peerId), []); 	const knownPeerIds = useCallback(() => Array.from(peersRef.current.keys()), []);  	useEffect(() => { 		return () => { 			peersRef.current.forEach((peer) => { 				try { 					peer.dc?.close(); 				} catch {} 				try { 					peer.pc.close(); 				} catch {} 			}); 			peersRef.current.clear(); 		}; 	}, []);  	return { 		initiateConnection, 		handleOffer, 		handleAnswer, 		handleCandidate, 		removePeer, 		broadcastNote, 		hasPeer, 		knownPeerIds, 		connectedPeers, 	}; }import * as Tone from "tone"; import { instruments } from "./types";  export const initAudioContext = async () => { 	const context = new Tone.Context({ latencyHint: "interactive" }); 	Tone.setContext(context); 	Tone.context.lookAhead = 0; };  export const createSampler = (instKey: string, onload: () => void): Tone.Sampler => { 	return new Tone.Sampler({ 		urls: instruments[instKey].urls, 		baseUrl: instruments[instKey].baseUrl, 		release: 1.5, 		onload, 	}); };  export const createMasterVolume = (db: number): Tone.Volume => { 	return new Tone.Volume(db).toDestination(); };  export const createReverb = (wet: number, output?: Tone.ToneAudioNode): Tone.Reverb => { 	const reverb = new Tone.Reverb({ decay: 2, wet }); 	if (output) { 		reverb.connect(output); 	} else { 		reverb.toDestination(); 	} 	return reverb; };import { createBrowserClient } from "@supabase/ssr";  export function createClient() {   return createBrowserClient(     process.env.NEXT_PUBLIC_SUPABASE_URL!,     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   ); }   import { PianoKey } from "./types"; import { PLAYER_COLORS } from "./playerColors";  export const generatePiano = (): PianoKey[] => { 	const keys: PianoKey[] = []; 	let whiteKeyIndex = 0; 	for (let midi = 21; midi <= 108; midi++) { 		const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; 		const noteName = notes[midi % 12]; 		const isBlack = noteName.includes("#"); 		keys.push({ 			midi, 			noteName: `${noteName}${Math.floor(midi / 12) - 1}`, 			isBlack, 			whiteKeyIndex: !isBlack ? whiteKeyIndex++ : whiteKeyIndex - 1, 			color: PLAYER_COLORS[0], 		}); 	} 	return keys; }; export const PLAYER_COLORS = [ 	"rgba(219, 83, 97, 0.55)",   // red 	"rgba(83, 150, 219, 0.55)",  // blue 	"rgba(83, 219, 150, 0.55)",  // green 	"rgba(200, 140, 219, 0.55)", // purple ];  export const PLAYER_COLORS_SOLID = [ 	"#db5361", 	"#5396db", 	"#53db96", 	"#c88cdb", ];  export function getColorIndex(usersOnline: string[], myId: string): number { 	const idx = usersOnline.indexOf(myId); 	return idx === -1 ? 0 : idx; }   export function getSolidColor(index: number): string { 	return PLAYER_COLORS_SOLID[index % PLAYER_COLORS_SOLID.length]; } export type PianoKey = { 	midi: number; 	noteName: string; 	isBlack: boolean; 	whiteKeyIndex: number; 	color: string; };  export type VisNote = { 	id: string; 	midi: number; 	startTime: number; 	endTime: number | null; 	isBlack: boolean; 	whiteKeyIndex: number; 	color: string; 	x: number; 	w: number; 	playerId: string; };  export const THEME_COLOR = "rgba(219, 83, 97, 0.5)";  export type Instrument = { 	name: string; 	urls: Record<string, string>; 	baseUrl: string; };  export const instruments: Record<string, Instrument> = { 	salamander_grand: { 		name: "Salamander Grand Piano", 		urls: { 			A0: "A0.mp3", 			C1: "C1.mp3", 			"D#1": "Ds1.mp3", 			"F#1": "Fs1.mp3", 			A1: "A1.mp3", 			C2: "C2.mp3", 			"D#2": "Ds2.mp3", 			"F#2": "Fs2.mp3", 			A2: "A2.mp3", 			C3: "C3.mp3", 			"D#3": "Ds3.mp3", 			"F#3": "Fs3.mp3", 			A3: "A3.mp3", 			C4: "C4.mp3", 			"D#4": "Ds4.mp3", 			"F#4": "Fs4.mp3", 			A4: "A4.mp3", 			C5: "C5.mp3", 			"D#5": "Ds5.mp3", 			"F#5": "Fs5.mp3", 			A5: "A5.mp3", 			C6: "C6.mp3", 			"D#6": "Ds6.mp3", 			"F#6": "Fs6.mp3", 			A6: "A6.mp3", 			C7: "C7.mp3", 			"D#7": "Ds7.mp3", 			"F#7": "Fs7.mp3", 			A7: "A7.mp3", 			C8: "C8.mp3", 		}, 		baseUrl: "__https://tonejs.github.io/audio/salamander/____["](https://tonejs.github.io/audio/salamander/%22)__, 	}, 	casio_ep: { 		name: "Casio Electric Piano", 		urls: { 			A1: "A1.mp3", 			A2: "A2.mp3", 			C4: "C4.mp3", 			"D#4": "Ds4.mp3", 			"F#4": "Fs4.mp3", 			A4: "A4.mp3", 		}, 		baseUrl: "__https://tonejs.github.io/audio/casio/____["](https://tonejs.github.io/audio/casio/%22)__, 	}, };  export const DEFAULT_SOUNDFONT = "salamander_grand"; import { clsx, type ClassValue } from "clsx"; import { twMerge } from "tailwind-merge";  export function cn(...inputs: ClassValue[]) {   return twMerge(clsx(inputs)); }  export function hasEnvVars() {   return (     process.env.NEXT_PUBLIC_SUPABASE_URL &&     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   ); }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=Could not authenticate`);
}
import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // redirect user to specified redirect URL or root of app
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-muted-foreground">
          Code error: {params.error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          An unspecified error occurred.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
"use client";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    const checkRedirect = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.push("/");
        return;
      }
      const savedRedirect = sessionStorage.getItem("redirect_after_login");
      if (savedRedirect) {
        setRedirectTo(savedRedirect);
      }
    };
    checkRedirect();
  }, [router]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-gray-200">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In</h1>
        </div>
        <form onSubmit={handleSignIn} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Email"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-sm text-white/40">
          Don't have an account?{" "}
          <a href="/auth/sign-up" className="text-white">Sign up</a>
        </p>
      </div>
    </div>
  );
}import { SignUpForm } from "@/components/auth/sign-up-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Thank you for signing up!
              </CardTitle>
              <CardDescription>Check your email to confirm</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You&apos;ve successfully signed up. Please check your email to
                confirm your account before signing in.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-gray-200">
      <div className="w-full max-w-md space-y-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Check Your Email</h1>
        <p className="text-white/60">
          We've sent you a verification link. Please check your email and click the link to verify your account.
        </p>
        <a
          href="/auth/sign-in"
          className="inline-block text-sm text-white hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>Password reset instructions sent</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If you registered using your email and password, you will receive
              a password reset email.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Reset Your Password</CardTitle>
            <CardDescription>
              Type in your email and we&apos;ll send you a link to reset your
              password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send reset email"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  redirectTo = "/",
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      sessionStorage.removeItem("redirect_after_login");
      router.push(redirectTo);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return <Button onClick={logout}>Logout</Button>;
}
a

"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/protected`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">Repeat Password</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating an account..." : "Sign up"}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignUp}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-white/60">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-white/60">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none"
          placeholder="Enter your password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
      <p className="text-center text-sm text-white/40">
        Don't have an account?{" "}
        <a href="/auth/sign-up" className="text-white hover:underline">
          Sign up
        </a>
      </p>
    </form>
  );
}
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/auth/verify");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-white/60">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-white/60">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none"
          placeholder="Minimum 6 characters"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Sign Up"}
      </button>
      <p className="text-center text-sm text-white/40">
        Already have an account?{" "}
        <a href="/auth/sign-in" className="text-white hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/protected");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            Please enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save new password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DeployButton() {
  return (
    <>
      <Link
        href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&project-name=nextjs-with-supabase&repository-name=nextjs-with-supabase&demo-title=nextjs-with-supabase&demo-description=This+starter+configures+Supabase+Auth+to+use+cookies%2C+making+the+user%27s+session+available+throughout+the+entire+Next.js+app+-+Client+Components%2C+Server+Components%2C+Route+Handlers%2C+Server+Actions+and+Middleware.&demo-url=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2F&external-id=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&demo-image=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2Fopengraph-image.png"
        target="_blank"
      >
        <Button className="flex items-center gap-2" size="sm">
          <svg
            className="h-3 w-3"
            viewBox="0 0 76 65"
            fill="hsl(var(--background)/1)"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="inherit" />
          </svg>
          <span>Deploy to Vercel</span>
        </Button>
      </Link>
    </>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <Badge variant={"outline"} className="font-normal">
        Supabase environment variables required
      </Badge>
      <div className="flex gap-2">
        <Button size="sm" variant={"outline"} disabled>
          Sign in
        </Button>
        <Button size="sm" variant={"default"} disabled>
          Sign up
        </Button>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { Button } from "../ui/button";

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export function CodeBlock({ code }: { code: string }) {
  const [icon, setIcon] = useState(CopyIcon);

  const copy = async () => {
    await navigator?.clipboard?.writeText(code);
    setIcon(CheckIcon);
    setTimeout(() => setIcon(CopyIcon), 2000);
  };

  return (
    <pre className="bg-muted rounded-md p-6 my-6 relative">
      <Button
        size="icon"
        onClick={copy}
        variant={"outline"}
        className="absolute right-2 top-2"
      >
        {icon}
      </Button>
      <code className="text-xs p-3">{code}</code>
    </pre>
  );
}
import { TutorialStep } from "@/components/tutorial/tutorial-step";

export function ConnectSupabaseSteps() {
  return (
    <ol className="flex flex-col gap-6">
      <TutorialStep title="Create Supabase project">
        <p>
          Head over to{" "}
          <a
            href="https://app.supabase.com/project/_/settings/api"
            target="_blank"
            className="font-bold hover:underline text-foreground/80"
            rel="noreferrer"
          >
            database.new
          </a>{" "}
          and create a new Supabase project.
        </p>
      </TutorialStep>

      <TutorialStep title="Declare environment variables">
        <p>
          Rename the{" "}
          <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
            .env.example
          </span>{" "}
          file in your Next.js app to{" "}
          <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
            .env.local
          </span>{" "}
          and populate with values from{" "}
          <a
            href="https://app.supabase.com/project/_/settings/api"
            target="_blank"
            className="font-bold hover:underline text-foreground/80"
            rel="noreferrer"
          >
            your Supabase project&apos;s API Settings
          </a>
          .
        </p>
      </TutorialStep>

      <TutorialStep title="Restart your Next.js development server">
        <p>
          You may need to quit your Next.js development server and run{" "}
          <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
            npm run dev
          </span>{" "}
          again to load the new environment variables.
        </p>
      </TutorialStep>

      <TutorialStep title="Refresh the page">
        <p>
          You may need to refresh the page for Next.js to load the new
          environment variables.
        </p>
      </TutorialStep>
    </ol>
  );
}
import { TutorialStep } from "@/components/tutorial/tutorial-step";
import { CodeBlock } from "@/components/tutorial/code-block";

const create = `create table notes (
  id bigserial primary key,
  title text
);

insert into notes(title)
values
  ('Today I created a Supabase project.'),
  ('I added some data and queried it from Next.js.'),
  ('It was awesome!');
`.trim();

const rls = `alter table notes enable row level security;
create policy "Allow public read access" on notes
for select
using (true);`.trim();

const server = `import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: notes } = await supabase.from('notes').select()

  return <pre>{JSON.stringify(notes, null, 2)}</pre>
}
`.trim();

const client = `'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Page() {
  const [notes, setNotes] = useState<any[] | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getData = async () => {
      const { data } = await supabase.from('notes').select()
      setNotes(data)
    }
    getData()
  }, [])

  return <pre>{JSON.stringify(notes, null, 2)}</pre>
}
`.trim();

export function FetchDataSteps() {
  return (
    <ol className="flex flex-col gap-6">
      <TutorialStep title="Create some tables and insert some data">
        <p>
          Head over to the{" "}
          <a
            href="https://supabase.com/dashboard/project/_/editor"
            className="font-bold hover:underline text-foreground/80"
            target="_blank"
            rel="noreferrer"
          >
            Table Editor
          </a>{" "}
          for your Supabase project to create a table and insert some example
          data. If you&apos;re stuck for creativity, you can copy and paste the
          following into the{" "}
          <a
            href="https://supabase.com/dashboard/project/_/sql/new"
            className="font-bold hover:underline text-foreground/80"
            target="_blank"
            rel="noreferrer"
          >
            SQL Editor
          </a>{" "}
          and click RUN!
        </p>
        <CodeBlock code={create} />
      </TutorialStep>

      <TutorialStep title="Enable Row Level Security (RLS)">
        <p>
          Supabase enables Row Level Security (RLS) by default. To query data
          from your <code>notes</code> table, you need to add a policy. You can
          do this in the{" "}
          <a
            href="https://supabase.com/dashboard/project/_/editor"
            className="font-bold hover:underline text-foreground/80"
            target="_blank"
            rel="noreferrer"
          >
            Table Editor
          </a>{" "}
          or via the{" "}
          <a
            href="https://supabase.com/dashboard/project/_/sql/new"
            className="font-bold hover:underline text-foreground/80"
            target="_blank"
            rel="noreferrer"
          >
            SQL Editor
          </a>
          .
        </p>
        <p>
          For example, you can run the following SQL to allow public read
          access:
        </p>
        <CodeBlock code={rls} />
        <p>
          You can learn more about RLS in the{" "}
          <a
            href="https://supabase.com/docs/guides/auth/row-level-security"
            className="font-bold hover:underline text-foreground/80"
            target="_blank"
            rel="noreferrer"
          >
            Supabase docs
          </a>
          .
        </p>
      </TutorialStep>

      <TutorialStep title="Query Supabase data from Next.js">
        <p>
          To create a Supabase client and query data from an Async Server
          Component, create a new page.tsx file at{" "}
          <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
            /app/notes/page.tsx
          </span>{" "}
          and add the following.
        </p>
        <CodeBlock code={server} />
        <p>Alternatively, you can use a Client Component.</p>
        <CodeBlock code={client} />
      </TutorialStep>

      <TutorialStep title="Explore the Supabase UI Library">
        <p>
          Head over to the{" "}
          <a
            href="https://supabase.com/ui"
            className="font-bold hover:underline text-foreground/80"
          >
            Supabase UI library
          </a>{" "}
          and try installing some blocks. For example, you can install a
          Realtime Chat block by running:
        </p>
        <CodeBlock
          code={
            "npx shadcn@latest add https://supabase.com/ui/r/realtime-chat-nextjs.json"
          }
        />
      </TutorialStep>

      <TutorialStep title="Build in a weekend and scale to millions!">
        <p>You&apos;re ready to launch your product to the world! 🚀</p>
      </TutorialStep>
    </ol>
  );
}
import Link from "next/link";
import { TutorialStep } from "@/components/tutorial/tutorial-step";
import { ArrowUpRight } from "lucide-react";

export function SignUpUserSteps() {
  return (
    <ol className="flex flex-col gap-6">
      {process.env.VERCEL_ENV === "preview" ||
      process.env.VERCEL_ENV === "production" ? (
        <TutorialStep title="Set up redirect urls">
          <p>It looks like this App is hosted on Vercel.</p>
          <p className="mt-4">
            This particular deployment is
            <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
              &quot;{process.env.VERCEL_ENV}&quot;
            </span>{" "}
            on
            <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
              https://{process.env.VERCEL_URL}
            </span>
            .
          </p>
          <p className="mt-4">
            You will need to{" "}
            <Link
              className="text-primary hover:text-foreground"
              href={
                "https://supabase.com/dashboard/project/_/auth/url-configuration"
              }
            >
              update your Supabase project
            </Link>{" "}
            with redirect URLs based on your Vercel deployment URLs.
          </p>
          <ul className="mt-4">
            <li>
              -{" "}
              <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
                http://localhost:3000/**
              </span>
            </li>
            <li>
              -{" "}
              <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
                {`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/**`}
              </span>
            </li>
            <li>
              -{" "}
              <span className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-medium text-secondary-foreground border">
                {`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(
                  ".vercel.app",
                  "",
                )}-*-[vercel-team-url].vercel.app/**`}
              </span>{" "}
              (Vercel Team URL can be found in{" "}
              <Link
                className="text-primary hover:text-foreground"
                href="https://vercel.com/docs/accounts/create-a-team#find-your-team-id"
                target="_blank"
              >
                Vercel Team settings
              </Link>
              )
            </li>
          </ul>
          <Link
            href="https://supabase.com/docs/guides/auth/redirect-urls#vercel-preview-urls"
            target="_blank"
            className="text-primary/50 hover:text-primary flex items-center text-sm gap-1 mt-4"
          >
            Redirect URLs Docs <ArrowUpRight size={14} />
          </Link>
        </TutorialStep>
      ) : null}
      <TutorialStep title="Sign up your first user">
        <p>
          Head over to the{" "}
          <Link
            href="auth/sign-up"
            className="font-bold hover:underline text-foreground/80"
          >
            Sign up
          </Link>{" "}
          page and sign up your first user. It&apos;s okay if this is just you
          for now. Your awesome idea will have plenty of users later!
        </p>
      </TutorialStep>
    </ol>
  );
}
import { Checkbox } from "../ui/checkbox";

export function TutorialStep({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative">
      <Checkbox
        id={title}
        name={title}
        className={`absolute top-[3px] mr-2 peer`}
      />
      <label
        htmlFor={title}
        className={`relative text-base text-foreground peer-checked:line-through font-medium`}
      >
        <span className="ml-8">{title}</span>
        <div
          className={`ml-8 text-sm peer-checked:line-through font-normal text-muted-foreground`}
        >
          {children}
        </div>
      </label>
    </li>
  );
}
import { useState } from "react"; // 1. Import useState
import type { Accessibility } from "@/hooks/useRooms";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface AccessIconProps {
	type: "public" | "private" | "friends";
	glass?: boolean;
	text?: boolean;
}

export function AccessIcon({ type, glass = true, text = true }: AccessIconProps) {
	const [isHovered, setIsHovered] = useState(false);

	const iconClass = "w-10 h-6";
	const icons: Record<"public" | "private" | "friends", any> = {
		public: <img src="/icons/globe.svg" alt="" className={iconClass} />,
		private: <img src="/icons/lock.svg" alt="" className={iconClass} />,
		friends: <img src="/icons/friends.svg" alt="" className={iconClass} />,
	};

	const content = (
		<div className="flex flex-col items-center gap-2">
			{icons[type]}
			<span className="text-[10px] uppercase tracking-wider font-medium text-white/70">{type}</span>
		</div>
	);
	const noText = <div className="flex flex-col items-center">{icons[type]}</div>;

	if (!text && !glass) return noText;

	return (
		<div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="cursor-pointer">
			<DynamicLiquidGlass width={85} height={80} radius={15} refractionLevel={0.8} specularOpacity={0.7} glassBgOpacity={isHovered ? 0.15 : 0.001}>
				<div className="w-full h-full flex items-center justify-center">{content}</div>
			</DynamicLiquidGlass>
		</div>
	);
}
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
export function NextLogo() {
  return (
    <svg
      aria-label="Next.js logotype"
      height="68"
      role="img"
      viewBox="0 0 394 79"
      width="100"
    >
      <path
        d="M261.919 0.0330722H330.547V12.7H303.323V79.339H289.71V12.7H261.919V0.0330722Z"
        fill="currentColor"
      />
      <path
        d="M149.052 0.0330722V12.7H94.0421V33.0772H138.281V45.7441H94.0421V66.6721H149.052V79.339H80.43V12.7H80.4243V0.0330722H149.052Z"
        fill="currentColor"
      />
      <path
        d="M183.32 0.0661486H165.506L229.312 79.3721H247.178L215.271 39.7464L247.127 0.126654L229.312 0.154184L206.352 28.6697L183.32 0.0661486Z"
        fill="currentColor"
      />
      <path
        d="M201.6 56.7148L192.679 45.6229L165.455 79.4326H183.32L201.6 56.7148Z"
        fill="currentColor"
      />
      <path
        clipRule="evenodd"
        d="M80.907 79.339L17.0151 0H0V79.3059H13.6121V16.9516L63.8067 79.339H80.907Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        d="M333.607 78.8546C332.61 78.8546 331.762 78.5093 331.052 77.8186C330.342 77.1279 329.991 76.2917 330 75.3011C329.991 74.3377 330.342 73.5106 331.052 72.8199C331.762 72.1292 332.61 71.7838 333.607 71.7838C334.566 71.7838 335.405 72.1292 336.115 72.8199C336.835 73.5106 337.194 74.3377 337.204 75.3011C337.194 75.9554 337.028 76.5552 336.696 77.0914C336.355 77.6368 335.922 78.064 335.377 78.373C334.842 78.6911 334.252 78.8546 333.607 78.8546Z"
        fill="currentColor"
      />
      <path
        d="M356.84 45.4453H362.872V68.6846C362.863 70.8204 362.401 72.6472 361.498 74.1832C360.585 75.7191 359.321 76.8914 357.698 77.7185C356.084 78.5364 354.193 78.9546 352.044 78.9546C350.079 78.9546 348.318 78.6001 346.75 77.9094C345.182 77.2187 343.937 76.1826 343.024 74.8193C342.101 73.456 341.649 71.7565 341.649 69.7207H347.691C347.7 70.6114 347.903 71.3838 348.29 72.0291C348.677 72.6744 349.212 73.1651 349.895 73.5105C350.586 73.8559 351.38 74.0286 352.274 74.0286C353.243 74.0286 354.073 73.8286 354.746 73.4196C355.419 73.0197 355.936 72.4199 356.296 71.6201C356.646 70.8295 356.831 69.8479 356.84 68.6846V45.4453Z"
        fill="currentColor"
      />
      <path
        d="M387.691 54.5338C387.544 53.1251 386.898 52.0254 385.773 51.2438C384.638 50.4531 383.172 50.0623 381.373 50.0623C380.11 50.0623 379.022 50.2532 378.118 50.6258C377.214 51.0075 376.513 51.5164 376.033 52.1617C375.554 52.807 375.314 53.5432 375.295 54.3703C375.295 55.061 375.461 55.6608 375.784 56.1607C376.107 56.6696 376.54 57.0968 377.103 57.4422C377.656 57.7966 378.274 58.0874 378.948 58.3237C379.63 58.56 380.313 58.76 380.995 58.9236L384.14 59.6961C385.404 59.9869 386.631 60.3778 387.802 60.8776C388.973 61.3684 390.034 61.9955 390.965 62.7498C391.897 63.5042 392.635 64.413 393.179 65.4764C393.723 66.5397 394 67.7848 394 69.2208C394 71.1566 393.502 72.8562 392.496 74.3285C391.491 75.7917 390.043 76.9369 388.143 77.764C386.252 78.582 383.965 79 381.272 79C378.671 79 376.402 78.6002 374.493 77.8004C372.575 77.0097 371.08 75.8463 370.001 74.3194C368.922 72.7926 368.341 70.9294 368.258 68.7391H374.235C374.318 69.8842 374.687 70.8386 375.314 71.6111C375.95 72.3745 376.78 72.938 377.795 73.3197C378.819 73.6923 379.962 73.8832 381.226 73.8832C382.545 73.8832 383.707 73.6832 384.712 73.2924C385.708 72.9016 386.492 72.3564 387.055 71.6475C387.627 70.9476 387.913 70.1206 387.922 69.1754C387.913 68.312 387.654 67.5939 387.156 67.0304C386.649 66.467 385.948 65.9944 385.053 65.6127C384.15 65.231 383.098 64.8856 381.899 64.5857L378.081 63.6223C375.323 62.9225 373.137 61.8592 371.541 60.4323C369.937 59.0054 369.143 57.115 369.143 54.7429C369.143 52.798 369.678 51.0894 370.758 49.6261C371.827 48.1629 373.294 47.0268 375.148 46.2179C377.011 45.4 379.114 45 381.456 45C383.836 45 385.92 45.4 387.719 46.2179C389.517 47.0268 390.929 48.1538 391.952 49.5897C392.976 51.0257 393.511 52.6707 393.539 54.5338H387.691Z"
        fill="currentColor"
      />
    </svg>
  );
}export function SupabaseLogo() {
  return (
    <svg
      aria-label="Supabase logo"
      width="140"
      height="30"
      viewBox="0 0 115 23"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_4671_51136)">
        <g clipPath="url(#clip1_4671_51136)">
          <path
            d="M13.4028 21.8652C12.8424 22.5629 11.7063 22.1806 11.6928 21.2898L11.4954 8.25948H20.3564C21.9614 8.25948 22.8565 10.0924 21.8585 11.3353L13.4028 21.8652Z"
            fill="url(#paint0_linear_4671_51136)"
          />
          <path
            d="M13.4028 21.8652C12.8424 22.5629 11.7063 22.1806 11.6928 21.2898L11.4954 8.25948H20.3564C21.9614 8.25948 22.8565 10.0924 21.8585 11.3353L13.4028 21.8652Z"
            fill="url(#paint1_linear_4671_51136)"
            fillOpacity="0.2"
          />
          <path
            d="M9.79895 0.89838C10.3593 0.200591 11.4954 0.582929 11.5089 1.47383L11.5955 14.5041H2.84528C1.24026 14.5041 0.345103 12.6711 1.34316 11.4283L9.79895 0.89838Z"
            fill="#3ECF8E"
          />
        </g>
        <path
          d="M30.5894 13.3913C30.7068 14.4766 31.7052 16.3371 34.6026 16.3371C37.1279 16.3371 38.3418 14.7479 38.3418 13.1976C38.3418 11.8022 37.3824 10.6588 35.4836 10.2712L34.1131 9.98049C33.5846 9.88359 33.2323 9.5929 33.2323 9.12777C33.2323 8.58512 33.7804 8.17818 34.4656 8.17818C35.5618 8.17818 35.9729 8.89521 36.0513 9.45725L38.2243 8.97275C38.1069 7.94561 37.1867 6.22083 34.446 6.22083C32.3709 6.22083 30.844 7.63555 30.844 9.34094C30.844 10.6781 31.6856 11.7828 33.5454 12.1898L34.8179 12.4805C35.5618 12.6355 35.8555 12.9844 35.8555 13.4107C35.8555 13.9146 35.4444 14.3603 34.583 14.3603C33.4476 14.3603 32.8797 13.6626 32.8212 12.9068L30.5894 13.3913Z"
          fill="currentColor"
        />
        <path
          d="M46.6623 16.0464H49.1486C49.1094 15.717 49.0506 15.0581 49.0506 14.3216V6.51154H46.4468V12.0542C46.4468 13.1588 45.7813 13.934 44.6263 13.934C43.4126 13.934 42.8643 13.0813 42.8643 12.0154V6.51154H40.2606V12.5387C40.2606 14.6123 41.5918 16.2984 43.9215 16.2984C44.9393 16.2984 46.0556 15.9108 46.5841 15.0193C46.5841 15.4069 46.6231 15.8526 46.6623 16.0464Z"
          fill="currentColor"
        />
        <path
          d="M54.433 19.7286V15.1162C54.9027 15.7558 55.8817 16.279 57.213 16.279C59.9341 16.279 61.7545 14.1472 61.7545 11.2596C61.7545 8.43021 60.1298 6.29842 57.3108 6.29842C55.8623 6.29842 54.7855 6.93792 54.3548 7.67439V6.51159H51.8295V19.7286H54.433ZM59.19 11.279C59.19 12.9845 58.133 13.9728 56.8017 13.9728C55.4708 13.9728 54.394 12.9651 54.394 11.279C54.394 9.59299 55.4708 8.6046 56.8017 8.6046C58.133 8.6046 59.19 9.59299 59.19 11.279Z"
          fill="currentColor"
        />
        <path
          d="M63.229 13.4495C63.229 14.9417 64.4818 16.3177 66.5375 16.3177C67.9662 16.3177 68.8865 15.6588 69.3758 14.9029C69.3758 15.2712 69.4149 15.7944 69.4737 16.0464H71.862C71.8033 15.7169 71.7449 15.0386 71.7449 14.5348V9.84482C71.7449 7.92622 70.6093 6.22083 67.5555 6.22083C64.9713 6.22083 63.5811 7.86807 63.4248 9.36033L65.7347 9.84482C65.8131 9.0115 66.4395 8.29445 67.5747 8.29445C68.6713 8.29445 69.1998 8.85646 69.1998 9.53475C69.1998 9.86421 69.0238 10.1355 68.4755 10.2131L66.1068 10.5619C64.5015 10.7945 63.229 11.744 63.229 13.4495ZM67.0854 14.3991C66.2438 14.3991 65.8325 13.8565 65.8325 13.2945C65.8325 12.558 66.361 12.1898 67.0268 12.0929L69.1998 11.7634V12.1898C69.1998 13.8759 68.1818 14.3991 67.0854 14.3991Z"
          fill="currentColor"
        />
        <path
          d="M76.895 16.0465V14.8837C77.4038 15.6976 78.4217 16.279 79.7531 16.279C82.4941 16.279 84.2951 14.1278 84.2951 11.2403C84.2951 8.4108 82.6701 6.25965 79.851 6.25965C78.4217 6.25965 77.3648 6.8798 76.934 7.55806V2.01546H74.3696V16.0465H76.895ZM81.6911 11.2596C81.6911 13.0038 80.6341 13.9728 79.3028 13.9728C77.9912 13.9728 76.895 12.9845 76.895 11.2596C76.895 9.51543 77.9912 8.56584 79.3028 8.56584C80.6341 8.56584 81.6911 9.51543 81.6911 11.2596Z"
          fill="currentColor"
        />
        <path
          d="M85.7692 13.4495C85.7692 14.9417 87.022 16.3177 89.0776 16.3177C90.5065 16.3177 91.4269 15.6588 91.916 14.9029C91.916 15.2712 91.9554 15.7944 92.014 16.0464H94.4023C94.3439 15.7169 94.2851 15.0386 94.2851 14.5348V9.84482C94.2851 7.92622 93.1495 6.22083 90.0955 6.22083C87.5115 6.22083 86.1216 7.86807 85.965 9.36033L88.2747 9.84482C88.3533 9.0115 88.9798 8.29445 90.1149 8.29445C91.2115 8.29445 91.74 8.85646 91.74 9.53475C91.74 9.86421 91.5638 10.1355 91.0156 10.2131L88.647 10.5619C87.0418 10.7945 85.7692 11.744 85.7692 13.4495ZM89.6258 14.3991C88.784 14.3991 88.3727 13.8565 88.3727 13.2945C88.3727 12.558 88.9012 12.1898 89.5671 12.0929L91.74 11.7634V12.1898C91.74 13.8759 90.722 14.3991 89.6258 14.3991Z"
          fill="currentColor"
        />
        <path
          d="M96.087 13.3913C96.2042 14.4766 97.2028 16.3371 100.1 16.3371C102.626 16.3371 103.839 14.7479 103.839 13.1976C103.839 11.8022 102.88 10.6588 100.981 10.2712L99.6105 9.98049C99.082 9.88359 98.7299 9.5929 98.7299 9.12777C98.7299 8.58512 99.2778 8.17818 99.963 8.17818C101.06 8.17818 101.471 8.89521 101.549 9.45725L103.722 8.97275C103.604 7.94561 102.684 6.22083 99.9436 6.22083C97.8683 6.22083 96.3416 7.63555 96.3416 9.34094C96.3416 10.6781 97.183 11.7828 99.043 12.1898L100.316 12.4805C101.06 12.6355 101.353 12.9844 101.353 13.4107C101.353 13.9146 100.942 14.3603 100.081 14.3603C98.9451 14.3603 98.3776 13.6626 98.3188 12.9068L96.087 13.3913Z"
          fill="currentColor"
        />
        <path
          d="M107.794 10.1937C107.852 9.32158 108.596 8.31381 109.947 8.31381C111.435 8.31381 112.062 9.24406 112.101 10.1937H107.794ZM112.355 12.6743C112.042 13.527 111.376 14.1278 110.163 14.1278C108.87 14.1278 107.794 13.2169 107.735 11.9573H114.626C114.626 11.9184 114.665 11.5309 114.665 11.1626C114.665 8.10064 112.884 6.22083 109.908 6.22083C107.441 6.22083 105.17 8.19753 105.17 11.2402C105.17 14.4572 107.5 16.3371 110.143 16.3371C112.512 16.3371 114.039 14.9611 114.528 13.3138L112.355 12.6743Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_4671_51136"
          x1="11.4954"
          y1="11.1486"
          x2="19.3439"
          y2="14.4777"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#249361" />
          <stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_4671_51136"
          x1="8.00382"
          y1="6.42177"
          x2="11.5325"
          y2="13.1398"
          gradientUnits="userSpaceOnUse"
        >
          <stop />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
        <clipPath id="clip0_4671_51136">
          <rect
            width="113.85"
            height="21.8943"
            fill="currentColor"
            transform="translate(0.922119 0.456161)"
          />
        </clipPath>
        <clipPath id="clip1_4671_51136">
          <rect
            width="21.3592"
            height="21.8943"
            fill="currentColor"
            transform="translate(0.919006 0.497101)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const ICON_SIZE = 16;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={"sm"}>
          {theme === "light" ? (
            <Sun
              key="light"
              size={ICON_SIZE}
              className={"text-muted-foreground"}
            />
          ) : theme === "dark" ? (
            <Moon
              key="dark"
              size={ICON_SIZE}
              className={"text-muted-foreground"}
            />
          ) : (
            <Laptop
              key="system"
              size={ICON_SIZE}
              className={"text-muted-foreground"}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="start">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(e) => setTheme(e)}
        >
          <DropdownMenuRadioItem className="flex gap-2" value="light">
            <Sun size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex gap-2" value="dark">
            <Moon size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem className="flex gap-2" value="system">
            <Laptop size={ICON_SIZE} className="text-muted-foreground" />{" "}
            <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	// If the env vars are not set, skip proxy check. You can remove this
	// once you setup the project.
	if (!hasEnvVars) {
		return supabaseResponse;
	}

	// With Fluid compute, don't put this client in a global environment
	// variable. Always create a new one on each request.
	const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				supabaseResponse = NextResponse.next({
					request,
				});
				cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
			},
		},
	});

	// Do not run code between createServerClient and
	// supabase.auth.getClaims(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	// IMPORTANT: If you remove getClaims() and you use server-side rendering
	// with the Supabase client, your users may be randomly logged out.
	const { data } = await supabase.auth.getClaims();
	const user = data?.claims;

	if (request.nextUrl.pathname !== "/" && !user && !request.nextUrl.pathname.startsWith("/login") && !request.nextUrl.pathname.startsWith("/auth")) {
		// no user, potentially respond by redirecting the user to the login page
		const url = request.nextUrl.clone();
		url.pathname = "/auth/login";
		return NextResponse.redirect(url);
	}

	// IMPORTANT: You *must* return the supabaseResponse object as it is.
	// If you're creating a new response object with NextResponse.next() make sure to:
	// 1. Pass the request in it, like so:
	//    const myNewResponse = NextResponse.next({ request })
	// 2. Copy over the cookies, like so:
	//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
	// 3. Change the myNewResponse object to fit your needs, but avoid changing
	//    the cookies!
	// 4. Finally:
	//    return myNewResponse
	// If this is not done, you may be causing the browser and server to go out
	// of sync and terminate the user's session prematurely!

	return supabaseResponse;
}
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
I want for all my auth pages to have the same design as my application AND when i log in dont redirect me to localhost:3000 but to the online website hosted by vercel (https://away-rho.vercel.app/)

## Claude

I'll help you fix both issues. Let me first locate your project files.

[Bash: dir /b C:\Users\mgiam 2>nul | findstr /v /i "appdata documents downloads pictures music videos deskt]

[Bash: dir C:\Users\mgiam /b /ad]

[PowerShell: Get-ChildItem -Path "C:\Users\mgiam" -Directory | Select-Object Name]

[PowerShell: Get-ChildItem -Path "C:\Users\mgiam" -Directory -Force | Select-Object -ExpandProperty Name]

[PowerShell: @("Desktop", "Documents", "Downloads", "IdeaProjects") | ForEach-Object { $p = "C:\Users\mgiam\$_"; ]

Found your project. Let me explore its structure.

[Bash: cd "C:\Users\mgiam\Desktop\Away" && ls]

[PowerShell: Get-ChildItem -Path "C:\Users\mgiam\Desktop\Away" -Force | Select-Object Name, Mode]

[Bash: ls -la "C:/Users/mgiam/Desktop/Away/"]

Let me find the actual Next.js project.

[Bash: find "C:/Users/mgiam/Desktop" -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" 2>/dev/]

[Bash: find "C:/Users/mgiam/Desktop" -maxdepth 5 -name "package.json" -not -path "*/node_modules/*" 2>/dev/]

[Bash: find "C:/Users/mgiam/Desktop" -maxdepth 5 -name "package.json" -not -path "*/node_modules/*" 2>/dev/]

[Bash: ls "C:/Users/mgiam/Desktop/MCT 3/FINAL WORK/code/" 2>/dev/null && echo "---" && ls "C:/Users/mgiam/D]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/demo/my-app/app/" && echo "---components---" && ls]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/demos/supabase auth/my-app/" 2>/dev/null && echo "---ap]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/demos/supabase auth/my-app/app/auth/" && echo "---" && ]

[Bash: find "C:/Users/mgiam/Desktop" -type d -name "jam" 2>/dev/null | head -5]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/" && echo "---" && ls "C:/Users/mgi]

Found your project. Let me set up tasks and explore the auth structure.

[ToolSearch(query, max_results)]

[TodoWrite]

[Bash: cd "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away" && ls app/auth/ && echo "---" && l]

[Bash: cd "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away" && ls components/auth/ && echo "--]

[Bash: cd "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away" && ls app/auth/login/ app/auth/sig]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/login-form.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/effects/SilkBackground.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/login/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/sign-up-form.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/forgot-password-form.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/update-password-form.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/sign-up/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/error/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/sign-up-success/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/sign-in/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/forgot-password/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/update-password/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/verify/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/effects/DynamicLiquidglass.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/SignInForm.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/supabase.ts]

[TodoWrite]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/utils.ts]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/multiplayer/" && echo "-]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/multiplayer/BackButton.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/layout.tsx]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/" 2>/dev/null]

Now I have everything I need. Let me start implementing.

**Step 1: Add the site URL helper**

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/utils.ts]

**Step 2: Create the auth layout with SilkBackground**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/layout.tsx]

[Bash: head -3 "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/multiplayer/BackBut]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/layout.tsx]

**Step 3: Redesign LoginForm to match the app theme**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/login-form.tsx]

**Step 4: Redesign SignUpForm**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/sign-up-form.tsx]

**Step 5: Redesign ForgotPasswordForm**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/forgot-password-form.tsx]

**Step 6: Redesign UpdatePasswordForm**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/update-password-form.tsx]

**Step 7: Update each auth page to remove duplicate wrappers**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/login/page.tsx]

[TodoWrite]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/sign-up/page.tsx]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/forgot-password/page.tsx]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/update-password/page.tsx]

**Step 8: Redesign error page, sign-up-success page, verify page**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/error/page.tsx]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/sign-up-success/page.tsx]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/verify/page.tsx]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/" && echo "---supabase---" && l]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/callback/route.ts]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/sign-in/page.tsx]

[TodoWrite]

[Grep window\.location\.origin]

[Grep from.*SignUpForm|from.*SignInForm]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/layout.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/proxy.ts]

[TodoWrite]

Done. Here's a summary of what changed and what you need to do to fix the redirect.

## Design changes

**New shared layout** — [app/auth/layout.tsx](app/auth/layout.tsx) wraps every `/auth/*` page with the same `SilkBackground` + `BackButton` + `bg-[#050505]` styling as your main app. Pages no longer need their own wrappers.

**Redesigned forms** — all four auth forms now use a glass-morphism card (`bg-[#0a0118]/80 backdrop-blur-xl` + `border-white/10`), italic light typography, white-on-dark inputs, and matching buttons:
- [components/auth/login-form.tsx](components/auth/login-form.tsx)
- [components/auth/sign-up-form.tsx](components/auth/sign-up-form.tsx)
- [components/auth/forgot-password-form.tsx](components/auth/forgot-password-form.tsx)
- [components/auth/update-password-form.tsx](components/auth/update-password-form.tsx)

**Redesigned pages** — `error`, `sign-up-success`, `verify`, `sign-in` (now reuses `LoginForm`), and the `login`/`sign-up`/`forgot-password`/`update-password` pages were simplified to just render the form (the layout handles the chrome).

## Redirect fix

I added a `getSiteURL()` helper in [lib/utils.ts](lib/utils.ts) and switched the auth forms from `window.location.origin` to `getSiteURL()`. It checks (in order): `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_VERCEL_URL` → `window.location.origin`.

**But the code change alone won't fix it.** The real reason you're being redirected to localhost is that **Supabase uses the "Site URL" configured in its dashboard for OAuth callbacks and email links** — `redirectTo` in code only works if the URL is in the allowlist. You need to do these two things:

### 1. In your Vercel project settings
Add this environment variable:
```
NEXT_PUBLIC_SITE_URL=https://away-rho.vercel.app
```
(redeploy after adding it)

### 2. In your Supabase dashboard
Go to **Authentication → URL Configuration**:
- **Site URL**: `https://away-rho.vercel.app`
- **Redirect URLs** (allowlist) — add all of these:
  - `https://away-rho.vercel.app/**`
  - `http://localhost:3000/**` (so local dev still works)

If you use Google OAuth, also make sure `https://<your-project>.supabase.co/auth/v1/callback` is in your Google Cloud OAuth client's allowed redirect URIs (this is on Google's side, not Supabase's).

Once both are set, password resets, email confirmations, and Google sign-in will all redirect back to your Vercel deployment.

## User

redesign also the profile page like this

## Claude

Let me find the profile page first.

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/"]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/layout.tsx]

[Grep friends|achievements|notes_played|time_played|stats]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/public/icons/" 2>/dev/null]

Now I'll redesign the profile page. First, let me simplify the protected layout so it doesn't add Supabase template chrome.

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/layout.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/page.tsx]

[TodoWrite]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/page.tsx]

Now the main profile page redesign. I'll create a small disconnect button component first, then the page.

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/auth/"]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

Now the disconnect button as a small client component:

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/DisconnectButton.tsx]

[TodoWrite]

Done. Here's what changed:

**Profile page redesigned** — [app/protected/profile/page.tsx](app/protected/profile/page.tsx) now matches your screenshot:
- Big italic "Matgiam" username header (pulled from `user_metadata.username` if set, else the email prefix)
- Four glass-morphism panels on the same `SilkBackground` purple theme as the rest of the app:
  - **Personal information** — username, email, "Linked to" with Google G icon (or mail icon for email signup), and a `Disconnect` button
  - **Friends (5)** — list with green/gray online dots
  - **Achievements** — 4×5 grid with mouse + piano icons unlocked
  - **Statistics** — time played, notes played, connexions

**Disconnect button** — [app/protected/profile/DisconnectButton.tsx](app/protected/profile/DisconnectButton.tsx) is a small client component that calls `supabase.auth.signOut()` and routes back to `/auth/login`.

**Cleanup:**
- [app/protected/layout.tsx](app/protected/layout.tsx) — stripped the Supabase starter template chrome (nav, deploy button, footer) so the profile page can take the full screen.
- [app/protected/page.tsx](app/protected/page.tsx) — replaced the tutorial page with a redirect to `/protected/profile`, so users landing here after email confirmation go straight to their profile.

**One thing to know about the data**: friends, achievements, and statistics are hardcoded mock values right now (matching your screenshot exactly: FLAR0/DR4GON/MIRU online, WAZO/Trinity offline, 70h20m50s, 153427, 150). Wire them to real tables when you're ready by swapping the `FRIENDS`, `UNLOCKED_ACHIEVEMENTS`, and `STATS` constants for Supabase queries.

## User

Error:   × You're importing a component that needs `useRouter`. This React hook only works in a client component. To fix, mark the file (or its parent) with the `"use client"` directive.
./components/multiplayer/BackButton.tsx

```
Error:   × You're importing a component that needs `useRouter`. This React hook only works in a client component. To fix, mark the file (or its parent) with the `"use client"` directive.
  │ 
  │  Learn more: https://nextjs.org/docs/app/api-reference/directives/use-client
  │ 
  │ 
   ╭─[C:\Users\mgiam\Desktop\FINAL WORK MATTEO\code\Away\Away\away\components\multiplayer\BackButton.tsx:1:1]
 1 │ import { useRouter } from "next/navigation";
   ·          ─────────
 2 │ import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";
 3 │ 
 3 │ export default function BackButton() {
   ╰────
```

## Claude

The profile page is a server component that imports `BackButton`, which needs `"use client"`. Let me add it.

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/multiplayer/BackButton.tsx]

Fixed. Added `"use client"` to [BackButton.tsx](components/multiplayer/BackButton.tsx). It uses `useRouter`, so the file needs to be a client component on its own — it can't rely on its parent's directive because the profile page is a server component.

## User

there is an horizontal overflow, remove that and make sure i dont have to scroll down, i want to see everything in the viewport height

## Claude

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

I'll restructure the layout to use a fixed-height grid that fills the viewport without scrolling.

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

Done. Here's what I changed to fix the overflow and fit-to-viewport:

**Horizontal overflow:**
- `w-screen` → `w-full` (w-screen is 100vw and *includes* scrollbar width, which often forces a horizontal scrollbar)
- Added `min-w-0` to flex/grid containers so children can shrink below their content width
- Long text uses `truncate` instead of `break-all`

**No vertical scroll:**
- `min-h-screen` → `h-screen overflow-hidden` (locks page to viewport)
- Wrapped content in `flex flex-col`, then made the grid `flex-1 min-h-0` so it fills remaining space
- Switched to `grid-rows-[1fr_auto]` with Achievements as `row-span-2` — that single panel now stretches the full height of both rows on the right, exactly like your screenshot
- Achievements squares dropped `aspect-square` and now use `grid-rows-4` to flex into whatever height the panel gets
- Tightened paddings (`pt-14 pb-6 px-8`, panels `p-5`) and gaps (`gap-4`)
- Title reduced from `text-7xl` → `text-5xl` so the header doesn't eat the viewport

The grid layout matches the screenshot: Personal info + Friends top-left, Statistics bottom-left under them, Achievements panel spanning the full right column.

## User

when i log in i get redirected still to a localhost http://localhost:3000/?code=ff00d97d-f37f-4b3b-bf9a-308704dc01f8 i want to be redirected to the online app please https://away-rho.vercel.app/

## Claude

This isn't a code issue — the code I wrote is doing the right thing. **Supabase is overriding your `redirectTo` URL** because it's not in the allowlist, so it falls back to whatever **Site URL** is configured in your Supabase dashboard (currently `http://localhost:3000`).

The give-away is the URL: `localhost:3000/?code=...` lands at `/`, not `/auth/callback` — that's Supabase ignoring `redirectTo` and using Site URL. **No code change can fix this**; it has to be done in the Supabase dashboard.

## Fix it in Supabase (this is the actual fix)

Go to https://supabase.com/dashboard/project/_/auth/url-configuration:

1. **Site URL** → change to:
   ```
   https://away-rho.vercel.app
   ```

2. **Redirect URLs** → make sure both are in the list:
   ```
   https://away-rho.vercel.app/**
   http://localhost:3000/**
   ```

3. Click **Save**.

That's the only step that actually matters. Test logging in again on the live site after saving — Google OAuth will now land on `https://away-rho.vercel.app/auth/callback?code=...`, which exchanges the code for a session and routes you to `/`.

## Vercel env var (do this too, but it's secondary)

In your Vercel project → Settings → Environment Variables, add:
```
NEXT_PUBLIC_SITE_URL = https://away-rho.vercel.app
```
Then redeploy. This makes `getSiteURL()` produce the right URL even on preview deployments where `window.location.origin` would be a `*.vercel.app` preview domain.

## Why you keep seeing localhost

Until step 1 is done, every OAuth flow — even from the live site — will end at `localhost:3000` because Supabase substitutes its Site URL whenever the requested `redirectTo` isn't on the allowlist. The code is fine; the dashboard isn't.

## User

https://away-rho.vercel.app/?code=2c5ce631-4949-4b84-b54b-cba2cf1849c7 when i connect i have this now, what is de code= representing ? and when i click on profile i still get redirected to the auth/sign and not the profile page. also in the solo mode when i go to the settings i dont see my username. and also when I join a room while being connected i stilll see player-xxx instead of my current username and this also in the roomlist

## Claude

Let me check the middleware and how the OAuth code is being routed.

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/" | grep -i -E "middleware|proxy"]

[TodoWrite]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/proxy.ts]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/supabase/proxy.ts]

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/" | head -30]

[Grep redirect.*auth/sign-in|push.*auth/sign-in]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Grep auth/sign]

Let me fix all these issues. First, handle the `?code=` at root and fix the callback redirect.

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/callback/route.ts]

Now I'll split the root page into a server component (handles `?code=`) + client component (the UI):

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/HomeClient.tsx]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/page.tsx]

[TodoWrite]

Now let me fix the jam room and create-room hooks to use the authenticated username.

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/hooks/useCreateRoom.ts]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/hooks/useCreateRoom.ts]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

I'll fix the jam room to load the username synchronously from sessionStorage and correctly track presence with the authenticated name.

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

Now I'll update HomeClient to persist user info so other pages can pick it up synchronously:

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/HomeClient.tsx]

[TodoWrite]

All four issues are fixed. Here's the breakdown:

## What `?code=` is

It's a **Supabase PKCE exchange code**, the temporary token Supabase gives back after Google authenticates you. It has to be exchanged for an actual session cookie via `supabase.auth.exchangeCodeForSession(code)`. Until that happens, you're not actually logged in — that's why **profile** kept bouncing you back to the auth page.

The reason it lands at `/?code=...` and not `/auth/callback?code=...` is that Supabase appends the code to whatever **Site URL** is configured in the dashboard, *not* always to the `redirectTo` you pass in code. So even with my code fix, the route `/auth/callback` is being skipped.

## What I changed to handle it

**[app/page.tsx](app/page.tsx)** is now a server component that detects `?code=` in the URL, exchanges it for a session, then redirects to a clean `/`. The interactive UI moved to **[app/HomeClient.tsx](app/HomeClient.tsx)** as a client component. So now:
- `/?code=abc123` → server exchanges code, sets cookie, redirects to `/`
- `/` → renders HomeClient

**Profile redirect**: `/auth/callback`'s error fallback now goes to `/auth/login` instead of the deleted `/auth/sign-in` ([app/auth/callback/route.ts:17](app/auth/callback/route.ts:17)).

**Solo mode settings shows username**: HomeClient now loads the user, passes `username` and `onUsernameChange` to `<Navigation>` ([app/HomeClient.tsx](app/HomeClient.tsx)). Settings → General → Username will now show your name.

**Jam room & room list show real username**:
- [hooks/useCreateRoom.ts](hooks/useCreateRoom.ts) — added `getDisplayName()` that reads the auth user (falls back to `Player-XXXX` for guests). The room's `host` field uses this on creation, so the room list shows your real name.
- [app/jam/[roomId]/page.tsx](app/jam/[roomId]/page.tsx) — `myName` now initializes synchronously from `sessionStorage`, eliminating the race where presence got tracked as `Player-XXXX` before auth loaded. Also reads `user_metadata.username` so future custom usernames will work.
- [app/HomeClient.tsx](app/HomeClient.tsx) and the jam room both write `{id, email, username}` to `sessionStorage["away_user"]` so any subsequent page sees the authenticated identity instantly.

## One thing to verify on your end

After deploying, check that `https://away-rho.vercel.app/**` is in **Authentication → URL Configuration → Redirect URLs** in Supabase. If it isn't, Supabase will keep ignoring `redirectTo` and falling back to Site URL — which still works with my new server-side `?code=` handler at `/`, but it's cleaner if `/auth/callback` is used directly.

## User

when i log in it works perfectly but when i log in with google i still get redirected to the auth/signup etc i dont see my name in the room etc can you fix the problem with google please because i see the user in my supabase etc

## Claude

Let me investigate what's different about the Google OAuth flow.

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/supabase/server.ts]

Found the issue. The root server component **can't set cookies** — Next.js Server Components can only read them. So when Google OAuth code is exchanged at `/`, the session is created on Supabase's side but never written to the browser cookie. Email/password works because that happens client-side.

The fix: redirect `?code=` to `/auth/callback` (a Route Handler, which **can** set cookies).

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/page.tsx]

Let me check that the `/auth/callback` route uses the correct Supabase client:

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/supabase-server.ts]

Let me make the callback route bulletproof by explicitly attaching cookies to the redirect response:

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/auth/callback/route.ts]

The root cause: **Server Components can't write cookies to the browser** in Next.js. So when my old root page tried to do `exchangeCodeForSession()` directly, the session was created on Supabase's side (that's why you see the user in your dashboard), but the browser session cookie was silently discarded — so the rest of the app thought you weren't logged in.

That also explains the cascading issues you saw:
- Profile redirects to login → because cookie wasn't set, `getUser()` returns null
- Username not showing in jam rooms → same reason, `getUser()` returns null

## Fixes

**[app/page.tsx](app/page.tsx)** — when `?code=` is present, redirect to `/auth/callback?code=...&next=/` (a Route Handler) instead of trying to exchange the code in the server component itself. Route Handlers CAN set cookies.

**[app/auth/callback/route.ts](app/auth/callback/route.ts)** — rewrote to use the explicit pattern: create the `NextResponse.redirect()` first, then have the Supabase client write cookies onto that response. This guarantees the session cookie reaches the browser before the redirect happens.

The new flow:
1. Google → Supabase → `https://away-rho.vercel.app/?code=abc`
2. Server component at `/` redirects to `/auth/callback?code=abc&next=/`
3. Route handler exchanges the code, writes cookies onto the redirect response, sends you to `/`
4. HomeClient runs `getUser()` → cookies are set → username loads → saved to `sessionStorage`
5. Navigate to multiplayer/profile/jam → username is already there

Email/password login was already working because `signInWithPassword` runs in the browser via the client SDK, which can set cookies directly. Only the OAuth round-trip needed the route handler intermediary.

After deploying this, Google login should:
- Drop you on the home screen logged in (no detour to auth pages)
- Show your name in the navigation settings, profile page, room list host column, and jam room player list

## User

ok now lets make the friend system. i want to be able to add the users as friends and see when they are online or offline in my profile. make this work perfectly

## Claude

I'll build the friend system end-to-end. Let me plan the work first.

[TodoWrite]

Let me first check what the player list looks like and the components that need updating.

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/multiplayer/PlayerList.tsx]

**Step 1: SQL schema**

[Bash: ls "C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/" | grep -iE "supabase|sql|db"]

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/db/friends_schema.sql]

**Step 2: Friend query helpers**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/lib/friends.ts]

**Step 3: Reactive friends hook with realtime updates**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/hooks/useFriends.ts]

**Step 4: Online presence hook**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/hooks/useOnlinePresence.ts]

[TodoWrite]

**Step 5: FriendsPanel client component**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/FriendsPanel.tsx]

Now update the profile page to use the real component:

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/protected/profile/page.tsx]

**Step 6: Wire jam room to broadcast userId via presence**

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[TodoWrite]

Now let me wire up the jam room: add userId to presence, mark friends, and wire the "Add friend" button.

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

Now update the presence sync handler and the initial track call to include userId, and wire "Add friend":

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

Now add the friends-list integration to the jam room (so we can mark friends and send friend requests):

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

Now let me add the friends ref and the useFriends hook to the jam room. Let me find a good spot:

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

Now wire `handleAddFriend` and `pendingFriendIds` into the PlayerList:

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

**Step 7: Update the PlayerList to support real userId-based friend requests**

[Write C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/multiplayer/PlayerList.tsx]

**Step 8: Sync username changes back to the profiles table**

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/layout/Navigation.tsx]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/components/layout/Navigation.tsx]

[TodoWrite]

Now wire `updateMyUsername` into both HomeClient and the jam room so name changes persist to the database:

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/HomeClient.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/HomeClient.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/HomeClient.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/HomeClient.tsx]

Now do the same for the jam room:

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Grep onUsernameChange]

[Read C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/app/jam/[roomId]/page.tsx]

Let me also make `getDisplayName` prefer the profiles table since OAuth users' `user_metadata` may not have a username initially:

[Edit C:/Users/mgiam/Desktop/FINAL WORK MATTEO/code/Away/Away/away/hooks/useCreateRoom.ts]

[TodoWrite]

Done. Here's the complete friend system.

## Action required: run the SQL once

Open **Supabase → SQL Editor**, paste the entire contents of [db/friends_schema.sql](db/friends_schema.sql), and run it. This creates:
- `profiles` table (mirror of `auth.users` with username) + auto-create trigger on signup + backfill for existing users
- `friendships` table (`requester_id`, `addressee_id`, `status`)
- RLS policies (only the addressee can accept; both parties can remove)
- Realtime publication on `friendships` so the UI updates without refreshing

## How it works

**Sending a request** ([app/jam/[roomId]/page.tsx](app/jam/[roomId]/page.tsx))
- The jam room now broadcasts your auth `userId` alongside `displayName` in presence.
- The `+ Add friend` button only appears when *you're* logged in **and** the other player is logged in (has `userId` in their presence). It shows `Request sent` after clicking.

**Accepting** ([app/protected/profile/FriendsPanel.tsx](app/protected/profile/FriendsPanel.tsx))
- Pending requests appear at the top of the Friends panel with ✓ / ✕ buttons.
- Accept flips status to `accepted`; decline deletes the row. Both parties see the change instantly via realtime.

**Online/offline** ([hooks/useOnlinePresence.ts](hooks/useOnlinePresence.ts))
- Anyone with the profile page open joins a global `online-users` Supabase presence channel keyed by their auth user ID.
- `FriendsPanel` checks `online.has(friend.userId)` and renders the green dot if present.
- The presence drops automatically when the tab closes.

**Reactive friend state** ([hooks/useFriends.ts](hooks/useFriends.ts))
- Listens to `postgres_changes` on the `friendships` table filtered to rows where you're the requester or addressee. Any insert/update/delete refreshes the list — no polling.

**Username sync** ([lib/friends.ts](lib/friends.ts) → `updateMyUsername`)
- When you change your username in Settings, both `profiles.username` and `auth.user_metadata.username` are updated, so the new name shows up in the room list (host column), jam room presence, friend's online list, and your profile.

## Quick verification path

1. Run the SQL.
2. Sign up two accounts (`A` and `B`) — Google OAuth or email/password both work.
3. Open `A` in one browser, `B` in another (or use incognito).
4. `A` joins a multiplayer room → `B` joins the same room → `A` sees `+ Add friend` next to `B` → click it.
5. `B` opens **Profile** → sees `A`'s pending request at the top of Friends → clicks ✓.
6. Both now see each other in the Friends panel; `A`'s dot turns green for `B` because `B`'s profile page is open.

If the dot doesn't turn green, double-check that **Realtime** is enabled for the `online-users` *Realtime channel* in Supabase → it's a presence channel, no DB config needed, but the project's realtime feature must be on (it is by default).

## User

last thing for today: let the stastistics also be working zo time player, notes played and amounts of connexions

## Claude

Let me build the stats tracking system.

[TodoWrite]

You've hit your limit · resets 9:50pm (Europe/Brussels)
