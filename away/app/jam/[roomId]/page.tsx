"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAppRouter } from "@/hooks/useAppRouter";
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
import { incrementTotalNotes, checkAndUnlockAchievements } from "@/lib/achievements";
import { useRecording } from "@/hooks/useRecording";
import { ChordDisplay } from "@/components/layout/ChordDisplay";

type PresencePlayer = {
	displayName: string;
	joinedAt: number;
	userId?: string;
	noteColorHex?: string;
	soundfont?: string;
};

type PlayerEntry = {
	id: string;
	userId?: string;
	displayName: string;
	colorIndex: number;
	noteColorHex?: string;
	soundfont?: string;
	isMe: boolean;
	isFriend: boolean;
};

async function decrementOrDelete(roomId: string) {
	try {
		const { data, error } = await supabase
			.from("rooms")
			.select("current_players")
			.eq("id", roomId)
			.single();
		if (error || !data) return;
		if (data.current_players <= 1) {
			await supabase.from("rooms").delete().eq("id", roomId);
		} else {
			await supabase
				.from("rooms")
				.update({ current_players: data.current_players - 1 })
				.eq("id", roomId);
		}
	} catch (e) {
		console.error("decrementOrDelete failed", e);
	}
}

export default function JamRoom() {
	const params = useParams();
	const router = useAppRouter();
	const roomId = params.roomId as string;

	const [showKeys, setShowKeys] = useState(true);

	const myTempId = useRef(getOrCreatePlayerId());
	const joinedAtRef = useRef(Date.now());

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
		setPeerSustain,
		ensureSoundfontLoaded,
		localHeldMidis,
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

	// Multiplayer doesn't have a metronome — make sure it isn't ticking if the user
	// arrived with it enabled from another page.
	useEffect(() => {
		if (settings.metronomeEnabled) updateSetting("metronomeEnabled", false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const [user, setUser] = useState<any>(null);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const { state: recordingState, countdown: recordingCountdown, startRecording, stopRecording } = useRecording(user?.id ?? null);
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
	const hasDecrementedRef = useRef(false);
	const channelMountedAtRef = useRef(0);

	const safeDecrement = useCallback(async () => {
		if (hasDecrementedRef.current) return;
		hasDecrementedRef.current = true;
		await decrementOrDelete(roomId);
	}, [roomId]);

	const chatAnchorRef = useRef<HTMLDivElement>(null);
	const [chatPos, setChatPos] = useState<{ top: number; right: number; height: number } | null>(null);

	useEffect(() => {
		const updateChatPos = () => {
			if (!chatAnchorRef.current) return;
			const rect = chatAnchorRef.current.getBoundingClientRect();
			const top = rect.bottom + 12;
			// Reserve enough space at the bottom for the piano (150px) plus a small gap,
			// so the chat input never gets covered by the keys.
			const PIANO_RESERVED = 170;
			const available = Math.max(220, window.innerHeight - top - PIANO_RESERVED);
			const height = Math.min(window.innerHeight * 0.53, available);
			setChatPos({
				top,
				right: Math.max(12, window.innerWidth - rect.right),
				height,
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

	// Refresh handling — when the user hits F5/Ctrl+R inside a jam room we want to leave the
	// room (decrement the counter, redirect back to /multiplayer) instead of silently re-joining
	// the same room with a stale player count.
	//
	// We use the Navigation Timing API to detect a reload deterministically (instead of the
	// old beforeunload + sessionStorage dance, which silently broke when the browser skipped
	// beforeunload). On any reload of this route, leave the room.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const nav = performance.getEntriesByType("navigation")[0] as
			| PerformanceNavigationTiming
			| undefined;
		const isReload = nav?.type === "reload";
		if (!isReload) return;
		isRedirectingRef.current = true;
		(async () => {
			await safeDecrement();
			router.replace("/multiplayer");
		})();
	}, [roomId, router, safeDecrement]);

	// Catch the back button / tab close as well — fire a best-effort decrement so the room
	// counter doesn't get stuck. The channel-cleanup effect handles the React unmount case;
	// this covers the case where the page is being unloaded entirely.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleUnload = () => {
			// Untrack our presence immediately so other clients see us leave; the row counter
			// is decremented by the channel cleanup below (or by the next mount on reload).
			roomChannelRef.current?.untrack();
		};
		const handlePopState = () => {
			safeDecrement();
		};
		window.addEventListener("pagehide", handleUnload);
		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("pagehide", handleUnload);
			window.removeEventListener("popstate", handlePopState);
		};
	}, [safeDecrement]);

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
	const currentSoundfontRef = useRef(currentSoundfont);
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
			soundfont: currentSoundfontRef.current,
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

	useEffect(() => {
		currentSoundfontRef.current = currentSoundfont;
		trackPresence();
		setPlayers((prev) =>
			prev.map((p) => (p.isMe ? { ...p, soundfont: currentSoundfont } : p)),
		);
	}, [currentSoundfont, trackPresence]);

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
		(peerId: string, note: number, velocity: number, isNoteOn: boolean, soundfontFromPayload?: string) => {
			const player = playersRef.current.find((p) => p.id === peerId);
			const colorIndex = player?.colorIndex ?? 0;
			const noteColorHex = showPlayerColorsRef.current ? player?.noteColorHex : noteColorRef.current;
			const soundfontKey = soundfontFromPayload ?? player?.soundfont;
			if (soundfontKey) ensureSoundfontLoaded(soundfontKey);
			if (isNoteOn) {
				playNote(note, velocity, peerId, colorIndex, noteColorHex, soundfontKey);
			} else {
				stopNote(note, peerId, soundfontKey);
			}
		},
		[playNote, stopNote, ensureSoundfontLoaded],
	);

	const { initiateConnection, handleOffer, handleAnswer, handleCandidate, removePeer, hasPeer, knownPeerIds } = useWebRTC(
		myTempId.current,
		onReceivePeerNote,
	);

	const handleLocalPlay = useCallback(
		(note: number, velocity: number = 127) => {
			playNote(note, velocity, "self");
			broadcastNoteSupabaseRef.current(note, velocity, true);
			incrementTotalNotes();
			checkAndUnlockAchievements();
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

	const handleLocalSustain = useCallback(
		(active: boolean) => {
			setSustain(active);
			broadcastSustainSupabaseRef.current(active);
		},
		[setSustain],
	);

	useKeyboardInput({
		enabled: keyboardInputEnabled,
		keybinds,
		baseMidi: keybindBaseMidi,
		onPlay: handleLocalPlay,
		onStop: handleLocalStop,
		onOctaveShift: (delta) => setKeybindBaseMidi(keybindBaseMidi + delta),
		onSustainChange: handleLocalSustain,
		onAnyKey: unlockAudio,
	});

	const myChatId = isLoggedIn ? user?.id || myTempId.current : myTempId.current;
	const { messages, isChatOpen, setIsChatOpen, addMessage, unreadCount } = useChat(roomId, myChatId);

	const handleLoginClick = useCallback(async () => {
		await safeDecrement();
		sessionStorage.removeItem("hostedRoomId");
		router.push("/auth/login");
	}, [router, safeDecrement]);

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
	const broadcastSustainSupabaseRef = useRef<(active: boolean) => void>(() => {});
	const ensureSoundfontLoadedRef = useRef(ensureSoundfontLoaded);
	const setPeerSustainRef = useRef(setPeerSustain);
	const handleLocalSustainRef = useRef(handleLocalSustain);

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
		ensureSoundfontLoadedRef.current = ensureSoundfontLoaded;
	}, [ensureSoundfontLoaded]);
	useEffect(() => {
		setPeerSustainRef.current = setPeerSustain;
	}, [setPeerSustain]);
	useEffect(() => {
		handleLocalSustainRef.current = handleLocalSustain;
	}, [handleLocalSustain]);

	useEffect(() => {
		unlockAudio();
		connectMIDIRef.current(
			(note, vel) => handleLocalPlayRef.current(note, vel),
			(note) => handleLocalStopRef.current(note),
			(active) => handleLocalSustainRef.current(active),
		);
		return () => {
			connectMIDIRef.current();
		};
	}, [unlockAudio]);

	useEffect(() => {
		if (isRedirectingRef.current) return;
		channelMountedAtRef.current = Date.now();
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
				payload: {
					senderId: myTempId.current,
					note,
					velocity,
					isNoteOn,
					soundfont: currentSoundfontRef.current,
				},
			});
		};

		broadcastSustainSupabaseRef.current = (active: boolean) => {
			room.send({
				type: "broadcast",
				event: "piano-sustain",
				payload: {
					senderId: myTempId.current,
					active,
					soundfont: currentSoundfontRef.current,
				},
			});
		};

		room.on("broadcast", { event: "piano-note" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			onReceivePeerNote(payload.senderId, payload.note, payload.velocity, payload.isNoteOn, payload.soundfont);
		});

		room.on("broadcast", { event: "piano-sustain" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			const peer = playersRef.current.find((p) => p.id === payload.senderId);
			const sf = (payload.soundfont as string | undefined) ?? peer?.soundfont;
			if (sf) ensureSoundfontLoadedRef.current(sf);
			setPeerSustainRef.current(payload.senderId, !!payload.active, sf);
		});

		// Rebuild the local players list from the current presence state. Re-runs on every
		// presence event — including soundfont/note-color updates that fire as join events on
		// existing keys (Supabase doesn't emit a fresh "sync" for a re-track of the same key).
		const refreshFromPresence = () => {
			const state = room.presenceState<PresencePlayer>();

			const entries = Object.entries(state).map(([presenceKey, presences]) => {
				const data = presences[0] as PresencePlayer;
				return {
					id: presenceKey,
					userId: data?.userId,
					displayName: data?.displayName || presenceKey,
					joinedAt: data?.joinedAt ?? 0,
					noteColorHex: data?.noteColorHex,
					soundfont: data?.soundfont,
				};
			});

			entries.sort((a, b) => a.joinedAt - b.joinedAt);

			entries.forEach((e) => {
				if (e.id !== myTempId.current && e.soundfont) {
					ensureSoundfontLoadedRef.current(e.soundfont);
				}
			});

			const friendIds = friendUserIdsRef.current;
			const newPlayers: PlayerEntry[] = entries.map((e, index) => ({
				id: e.id,
				userId: e.userId,
				displayName: e.displayName,
				colorIndex: index,
				noteColorHex: e.noteColorHex,
				soundfont: e.soundfont,
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
		};

		room.on("presence", { event: "sync" }, refreshFromPresence);
		room.on("presence", { event: "join" }, refreshFromPresence);
		room.on("presence", { event: "leave" }, refreshFromPresence);

		room.subscribe(async (status) => {
			if (status === "SUBSCRIBED") {
				myNameRef.current = myNameRef.current || myTempId.current;
				trackPresence();
			}
		});

		return () => {
			const mountedDuration = Date.now() - channelMountedAtRef.current;
			const isStrictModeTest = mountedDuration < 100;
			// Skip if this is a React-strict-mode double-mount, or if the refresh-detection
			// effect already kicked off the redirect+decrement above (which sets
			// isRedirectingRef.current = true).
			if (!isStrictModeTest && !isRedirectingRef.current) {
				safeDecrement();
			}

			knownPeerIdsRef.current().forEach((pid) => {
				releaseAllForPlayerRef.current(pid);
				removePeerRef.current(pid);
			});
			releaseAllForPlayerRef.current("self");

			roomChannelRef.current = null;
			try {
				room.untrack();
			} catch {}
			supabase.removeChannel(room);
		};
	}, [roomId, safeDecrement]);

	const handleLeave = useCallback(async () => {
		await safeDecrement();
		sessionStorage.removeItem("hostedRoomId");
		router.push("/multiplayer");
	}, [router, safeDecrement]);

	const backgroundAnimated = settings.backgroundAnimated && !settings.reducedMotion;

	return (
		<div className="h-[var(--app-h,100dvh)] w-screen bg-[#050505] text-gray-200 overflow-hidden flex relative" onClick={handleClick}>
			<SilkBackground color={settings.backgroundColor} scale={1} noiseIntensity={1.3} speed={3} rotation={270} animated={backgroundAnimated} />

			<Navigation
				onLogout={handleLeave}
				onToggleRecord={recordingState === "recording" ? stopRecording : startRecording}
				recordingState={recordingState}
				recordingCountdown={recordingCountdown}
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
						(active) => handleLocalSustainRef.current(active),
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
				hideMetronome
			/>

			<div className="absolute inset-0 flex flex-col pb-[150px]">
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
						soundfonts={soundfonts}
						currentSoundfont={currentSoundfont}
						onCopySoundfont={selectSoundfont}
					/>
				</div>
				<Visualizer
					noteLines={noteLines}
					enabled={settings.visualizerEnabled}
					fallSpeed={settings.noteFallSpeed}
					cornerRadius={settings.noteCornerRadius}
				/>
			</div>
			<div className="fixed bottom-0 left-0 right-0 z-20">
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
					style={{ top: chatPos.top, right: chatPos.right, height: chatPos.height, zIndex: 60 }}
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
				// When the user opens their own profile, fall back to the auth user id — the
				// presence track sometimes runs before auth has resolved, leaving the entry's
				// userId undefined. Without this the modal would say "jamming as a guest".
				userId={
					profileTarget?.isMe
						? user?.id ?? profileTarget?.userId ?? null
						: profileTarget?.userId ?? null
				}
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

			<ChordDisplay heldMidis={localHeldMidis} enabled={settings.chordRecognizerEnabled} />
		</div>
	);
}
