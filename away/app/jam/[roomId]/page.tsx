"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { Piano } from "@/components/multiplayer/Piano";
import { Visualizer } from "@/components/multiplayer/Visualizer";
import { Navigation } from "@/components/layout/Navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import { useAudioEngineContext } from "@/components/providers/AudioEngineProvider";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useWebRTC } from "@/hooks/useWebRTC";
import { getOrCreatePlayerId } from "@/hooks/useCreateRoom";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useChat } from "@/hooks/useChat";
import { PlayerList } from "@/components/multiplayer/PlayerList";
import { ProfileModal } from "@/components/layout/ProfileModal";
import type { ChatMessage } from "@/hooks/useChat";
import { sendRoomMessage } from "@/lib/messages";
import { useFriends } from "@/hooks/useFriends";
import { acceptFriendRequest, removeFriendship, sendFriendRequest, updateMyUsername } from "@/lib/friends";
import { saveSessionStats } from "@/lib/stats";
import { incrementTotalNotes, checkAndUnlockAchievements } from "@/lib/achievements";
import { AchievementBanner } from "@/components/achievements/AchievementBanner";
import type { Achievement } from "@/lib/achievements";

type PresencePlayer = {
	displayName: string;
	joinedAt: number;
	userId?: string;
	noteColorHex?: string;
};

type PlayerEntry = {
	id: string;
	userId?: string;
	displayName: string;
	colorIndex: number;
	noteColorHex?: string;
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

	const myTempId = useRef(getOrCreatePlayerId());
	const joinedAtRef = useRef(Date.now());
	const notesPlayedRef = useRef(0);
	const [bannerAchievement, setBannerAchievement] = useState<Achievement | null>(null);

	const {
		pianoKeys,
		noteLines,
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
		noteColor,
		setNoteColor,
		setSustain,
		keyboardInputEnabled,
		setKeyboardInputEnabled,
		keybinds,
		setKeybinds,
		keybindBaseMidi,
		setKeybindBaseMidi,
		keybindPreset,
		setKeybindPreset,
		settings,
		updateSetting,
		resetSettings,
	} = useAudioEngineContext();

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

	const [pendingFriendIds, setPendingFriendIds] = useState<Set<string>>(new Set());

	const [profileTarget, setProfileTarget] = useState<PlayerEntry | null>(null);
	const handleViewProfile = useCallback((playerId: string) => {
		const found = playersRef.current.find((p) => p.id === playerId);
		if (found) setProfileTarget(found);
	}, []);
	const handleCloseProfile = useCallback(() => setProfileTarget(null), []);

	const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
	const isRedirectingRef = useRef(false);

	const chatAnchorRef = useRef<HTMLDivElement>(null);
	const [chatPos, setChatPos] = useState<{ top: number; right: number } | null>(null);

	useEffect(() => {
		const updateChatPos = () => {
			if (!chatAnchorRef.current) return;
			const rect = chatAnchorRef.current.getBoundingClientRect();
			setChatPos({
				top: rect.bottom + 12,
				right: Math.max(12, window.innerWidth - rect.right),
			});
		};
		updateChatPos();
		const observer = new ResizeObserver(updateChatPos);
		observer.observe(document.documentElement);
		window.addEventListener("resize", updateChatPos);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateChatPos);
		};
	}, []);

	useEffect(() => {
		const REFRESH_KEY = "jamRoomRefreshed";
		const wasRefreshed = sessionStorage.getItem(REFRESH_KEY);
		if (wasRefreshed === roomId) {
			sessionStorage.removeItem(REFRESH_KEY);
			isRedirectingRef.current = true;
			(async () => {
				await decrementOrDelete(roomId);
				router.replace("/multiplayer");
			})();
			return;
		}
		const handleBeforeUnload = () => {
			sessionStorage.setItem(REFRESH_KEY, roomId);
			roomChannelRef.current?.untrack();
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
				const { data: profile } = await supabaseClient
					.from("profiles")
					.select("username")
					.eq("id", data.user.id)
					.maybeSingle();
				const username =
					profile?.username ||
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
	const myUserIdRef = useRef<string | null>(null);
	const noteColorRef = useRef(noteColor);
	useEffect(() => {
		noteColorRef.current = noteColor;
	}, [noteColor]);

	const trackPresence = useCallback(() => {
		const channel = roomChannelRef.current;
		if (!channel || !myNameRef.current) return;
		channel.track({
			displayName: myNameRef.current,
			joinedAt: joinedAtRef.current,
			userId: myUserIdRef.current ?? undefined,
			noteColorHex: noteColorRef.current,
		});
	}, []);

	useEffect(() => {
		myNameRef.current = myName;
		trackPresence();
	}, [myName, trackPresence]);

	useEffect(() => {
		myUserIdRef.current = user?.id ?? null;
		trackPresence();
	}, [user, trackPresence]);

	useEffect(() => {
		trackPresence();
		setPlayers((prev) =>
			prev.map((p) => (p.isMe ? { ...p, noteColorHex: noteColor } : p)),
		);
	}, [noteColor, trackPresence]);

	const { friends, pending: incomingFriendRequests, outgoing: outgoingFriendRequests } = useFriends(user?.id ?? null);
	const friendUserIdsRef = useRef<Set<string>>(new Set());
	useEffect(() => {
		friendUserIdsRef.current = new Set(friends.map((f) => f.userId));
		setPlayers((prev) =>
			prev.map((p) => ({
				...p,
				isFriend: !!p.userId && friendUserIdsRef.current.has(p.userId),
			})),
		);
	}, [friends]);

	const incomingRequestByUserId = useMemo(
		() => new Map(incomingFriendRequests.map((r) => [r.requesterId, r.friendshipId])),
		[incomingFriendRequests],
	);

	const outgoingUserIds = useMemo(
		() => new Set(outgoingFriendRequests.map((r) => r.addresseeId)),
		[outgoingFriendRequests],
	);

	const combinedPendingIds = useMemo(() => {
		const next = new Set(outgoingUserIds);
		pendingFriendIds.forEach((id) => next.add(id));
		return next;
	}, [outgoingUserIds, pendingFriendIds]);

	const handleAddFriend = useCallback(
		async (targetUserId: string) => {
			if (!user) return;
			setPendingFriendIds((prev) => new Set(prev).add(targetUserId));
			const result = await sendFriendRequest(targetUserId);
			if (!result.ok) {
				setPendingFriendIds((prev) => {
					const next = new Set(prev);
					next.delete(targetUserId);
					return next;
				});
			}
		},
		[user],
	);

	const handleAcceptFriend = useCallback((friendshipId: string) => {
		acceptFriendRequest(friendshipId);
	}, []);

	const handleDeclineFriend = useCallback((friendshipId: string) => {
		removeFriendship(friendshipId);
	}, []);

	const handleUsernameChange = useCallback(
		(next: string) => {
			setMyName(next);
			if (isLoggedIn) updateMyUsername(next);
			try {
				const saved = sessionStorage.getItem("away_user");
				if (saved) {
					const parsed = JSON.parse(saved);
					sessionStorage.setItem("away_user", JSON.stringify({ ...parsed, username: next }));
				}
			} catch {}
		},
		[isLoggedIn],
	);

	const showPlayerColorsRef = useRef(settings.showPlayerColors);
	useEffect(() => {
		showPlayerColorsRef.current = settings.showPlayerColors;
	}, [settings.showPlayerColors]);

	const onReceivePeerNote = useCallback(
		(peerId: string, note: number, velocity: number, isNoteOn: boolean) => {
			const player = playersRef.current.find((p) => p.id === peerId);
			const colorIndex = player?.colorIndex ?? 0;
			const noteColorHex = showPlayerColorsRef.current ? player?.noteColorHex : noteColorRef.current;
			if (isNoteOn) {
				playNote(note, velocity, peerId, colorIndex, noteColorHex);
			} else {
				stopNote(note, peerId);
			}
		},
		[playNote, stopNote],
	);

	const { initiateConnection, handleOffer, handleAnswer, handleCandidate, removePeer, hasPeer, knownPeerIds } = useWebRTC(
		myTempId.current,
		onReceivePeerNote,
	);

	const handleLocalPlay = useCallback(
		(note: number, velocity: number = 127) => {
			notesPlayedRef.current += 1;
			playNote(note, velocity, "self");
			broadcastNoteSupabaseRef.current(note, velocity, true);
			const total = incrementTotalNotes();
			const newAch = checkAndUnlockAchievements(total);
			if (newAch.length > 0) {
				setBannerAchievement(newAch[0]);
			}
		},
		[playNote],
	);

	const handleLocalStop = useCallback(
		(note: number) => {
			stopNote(note, "self");
			broadcastNoteSupabaseRef.current(note, 0, false);
		},
		[stopNote],
	);

	useKeyboardInput({
		enabled: keyboardInputEnabled,
		keybinds,
		baseMidi: keybindBaseMidi,
		onPlay: handleLocalPlay,
		onStop: handleLocalStop,
		onOctaveShift: (delta) => setKeybindBaseMidi(keybindBaseMidi + delta),
		onSustainChange: setSustain,
		onAnyKey: unlockAudio,
	});

	const myChatId = isLoggedIn ? user?.id || myTempId.current : myTempId.current;
	const { messages, isChatOpen, setIsChatOpen, addMessage, unreadCount } = useChat(roomId, myChatId);

	const handleLoginClick = useCallback(async () => {
		await decrementOrDelete(roomId);
		sessionStorage.removeItem("hostedRoomId");
		router.push("/auth/login");
	}, [router, roomId]);

	const handleOpenChat = useCallback(() => setIsChatOpen(true), [setIsChatOpen]);
	const handleCloseChat = useCallback(() => setIsChatOpen(false), [setIsChatOpen]);

	const handleSendMessage = useCallback(
		(text: string) => {
			const msg: ChatMessage = {
				id: (typeof crypto !== "undefined" && "randomUUID" in crypto
					? crypto.randomUUID()
					: Math.random().toString(36).substring(2)),
				senderId: isLoggedIn ? user?.id || myTempId.current : myTempId.current,
				senderName: isLoggedIn ? myName : myTempId.current,
				text,
				timestamp: Date.now(),
			};
			addMessage(msg);
			sendRoomMessage(roomId, msg);
		},
		[addMessage, isLoggedIn, user, myName, roomId],
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
	const broadcastNoteSupabaseRef = useRef<(note: number, velocity: number, isNoteOn: boolean) => void>(() => {});

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
		unlockAudio();
		connectMIDIRef.current(
			(note, vel) => handleLocalPlayRef.current(note, vel),
			(note) => handleLocalStopRef.current(note),
		);
		return () => {
			connectMIDIRef.current();
		};
	}, [unlockAudio]);

	useEffect(() => {
		if (isRedirectingRef.current) return;
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

		broadcastNoteSupabaseRef.current = (note: number, velocity: number, isNoteOn: boolean) => {
			room.send({
				type: "broadcast",
				event: "piano-note",
				payload: { senderId: myTempId.current, note, velocity, isNoteOn },
			});
		};

		room.on("broadcast", { event: "piano-note" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			onReceivePeerNote(payload.senderId, payload.note, payload.velocity, payload.isNoteOn);
		});

		room.on("presence", { event: "sync" }, () => {
			const state = room.presenceState<PresencePlayer>();

			const entries = Object.entries(state).map(([presenceKey, presences]) => {
				const data = presences[0] as PresencePlayer;
				return {
					id: presenceKey,
					userId: data?.userId,
					displayName: data?.displayName || presenceKey,
					joinedAt: data?.joinedAt ?? 0,
					noteColorHex: data?.noteColorHex,
				};
			});

			entries.sort((a, b) => a.joinedAt - b.joinedAt);

			const friendIds = friendUserIdsRef.current;
			const newPlayers: PlayerEntry[] = entries.map((e, index) => ({
				id: e.id,
				userId: e.userId,
				displayName: e.displayName,
				colorIndex: index,
				noteColorHex: e.noteColorHex,
				isMe: e.id === myTempId.current,
				isFriend: !!e.userId && friendIds.has(e.userId),
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
				myNameRef.current = myNameRef.current || myTempId.current;
				trackPresence();
			}
		});

		return () => {
			knownPeerIdsRef.current().forEach((pid) => {
				releaseAllForPlayerRef.current(pid);
				removePeerRef.current(pid);
			});
			releaseAllForPlayerRef.current("self");

			const uid = myUserIdRef.current;
			if (uid) {
				const elapsed = Math.round((Date.now() - joinedAtRef.current) / 1000);
				saveSessionStats(uid, elapsed, notesPlayedRef.current);
			}
			roomChannelRef.current = null;
			try {
				room.untrack();
			} catch {}
			supabase.removeChannel(room);
		};
	}, [roomId]);

	const handleLeave = useCallback(async () => {
		const userId = myUserIdRef.current;
		if (userId) {
			const elapsed = Math.round((Date.now() - joinedAtRef.current) / 1000);
			await saveSessionStats(userId, elapsed, notesPlayedRef.current);
		}
		await decrementOrDelete(roomId);
		sessionStorage.removeItem("hostedRoomId");
		router.push("/multiplayer");
	}, [roomId, router]);

	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative" onClick={handleClick}>
			<SilkBackground color={settings.backgroundColor} scale={1} noiseIntensity={1.3} speed={3} rotation={270} animated={backgroundAnimated} />

			<Navigation
				onLogout={handleLeave}
				isChatOpen={isChatOpen}
				onToggleChat={isChatOpen ? handleCloseChat : handleOpenChat}
				unreadChatCount={unreadCount}
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
				onUsernameChange={handleUsernameChange}
				noteColor={noteColor}
				onNoteColorChange={setNoteColor}
				keyboardInputEnabled={keyboardInputEnabled}
				onKeyboardInputEnabledChange={setKeyboardInputEnabled}
				keybinds={keybinds}
				onKeybindsChange={setKeybinds}
				keybindBaseMidi={keybindBaseMidi}
				onKeybindBaseMidiChange={setKeybindBaseMidi}
				keybindPreset={keybindPreset}
				onKeybindPresetChange={setKeybindPreset}
				settings={settings}
				updateSetting={updateSetting}
				onResetSettings={resetSettings}
			/>

			<div className="absolute inset-0 flex flex-col">
				<div className="absolute top-6 left-8 z-50">
					<PlayerList
						players={players}
						canAddFriend={isLoggedIn}
						pendingFriendIds={combinedPendingIds}
						incomingRequestByUserId={incomingRequestByUserId}
						onAddFriend={handleAddFriend}
						onAcceptFriend={handleAcceptFriend}
						onDeclineFriend={handleDeclineFriend}
						onViewProfile={handleViewProfile}
					/>
				</div>
				<Visualizer
					noteLines={noteLines}
					enabled={settings.visualizerEnabled}
					fallSpeed={settings.noteFallSpeed}
					cornerRadius={settings.noteCornerRadius}
				/>
				<Piano
					pianoKeys={pianoKeys}
					showKeys={showKeys}
					onPlayNote={handleLocalPlay}
					onStopNote={handleLocalStop}
					showNoteLabels={settings.showNoteLabels}
					keyAnimations={settings.keyAnimations}
				/>
			</div>

			{isChatOpen && chatPos && (
				<div
					className="fixed"
					style={{ top: chatPos.top, right: chatPos.right, zIndex: 60 }}
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

			<ProfileModal
				open={!!profileTarget}
				onClose={handleCloseProfile}
				userId={profileTarget?.userId ?? null}
				isSelf={!!profileTarget?.isMe}
				myUserId={user?.id ?? null}
				fallbackDisplayName={profileTarget?.displayName}
				isFriend={profileTarget?.isFriend}
				incomingFriendshipId={
					profileTarget?.userId ? incomingRequestByUserId.get(profileTarget.userId) ?? null : null
				}
				pendingOutgoing={!!profileTarget?.userId && combinedPendingIds.has(profileTarget.userId)}
				onUsernameChanged={(next) => {
					if (profileTarget?.isMe) handleUsernameChange(next);
				}}
			/>

			{bannerAchievement && (
				<AchievementBanner
					achievement={bannerAchievement}
					onDismiss={() => setBannerAchievement(null)}
				/>
			)}
		</div>
	);
}
