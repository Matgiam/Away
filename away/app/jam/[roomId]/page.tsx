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
import {
	incrementTotalNotes,
	checkAndUnlockAchievements,
	getEquippedBadge,
	BADGE_EQUIP_EVENT,
} from "@/lib/achievements";
import { useRecording } from "@/hooks/useRecording";
import { ChordDisplay } from "@/components/layout/ChordDisplay";
import { RecordingSignInModal } from "@/components/layout/RecordingSignInModal";

type PresencePlayer = {
	displayName: string;
	joinedAt: number;
	userId?: string;
	noteColorHex?: string;
	soundfont?: string;
	equippedBadge?: string | null;
};

type PlayerEntry = {
	id: string;
	userId?: string;
	displayName: string;
	colorIndex: number;
	noteColorHex?: string;
	soundfont?: string;
	equippedBadge?: string | null;
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

function decrementViaKeepalive(roomId: string) {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
	fetch(`${url}/rest/v1/rpc/decrement_room`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			apikey: key,
			Authorization: `Bearer ${key}`,
		},
		body: JSON.stringify({ room_id: roomId }),
		keepalive: true,
	});
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

	
	useEffect(() => {
		if (settings.metronomeEnabled) updateSetting("metronomeEnabled", false);
		
	}, []);

	const [user, setUser] = useState<any>(null);
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const {
		state: recordingState,
		countdown: recordingCountdown,
		startRecording,
		stopRecording,
		needsLogin: recordingNeedsLogin,
		dismissLoginPrompt: dismissRecordingLogin,
	} = useRecording(user?.id ?? null);
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

	// Per-session mute list. Audio (notes + sustain) from these peers is ignored
	// while they're in the set. UI presence (name, color, badge) keeps updating
	// normally so the muted player is still visible — they just play silently.
	// Not persisted: opening the room with a fresh state clears all mutes.
	const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
	const mutedIdsRef = useRef<Set<string>>(mutedIds);
	useEffect(() => {
		mutedIdsRef.current = mutedIds;
	}, [mutedIds]);

	const [pendingFriendIds, setPendingFriendIds] = useState<Set<string>>(new Set());

	
	const [profileTargetId, setProfileTargetId] = useState<string | null>(null);
	const profileTarget = useMemo(
		() => (profileTargetId ? players.find((p) => p.id === profileTargetId) ?? null : null),
		[profileTargetId, players],
	);
	const handleViewProfile = useCallback((playerId: string) => {
		setProfileTargetId(playerId);
	}, []);
	const handleCloseProfile = useCallback(() => setProfileTargetId(null), []);

	const handleToggleMute = useCallback((playerId: string) => {
		setMutedIds((prev) => {
			const next = new Set(prev);
			if (next.has(playerId)) {
				next.delete(playerId);
			} else {
				next.add(playerId);
				// Cut off any notes the peer is currently holding so muting feels
				// instant instead of waiting for sustained voices to ring out.
				releaseAllForPlayerRef.current?.(playerId);
			}
			return next;
		});
	}, []);

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
	// We detect "this jam page was just reloaded" by stamping the active roomId in
	// sessionStorage on mount and clearing it on clean unmount. If we mount and the stamp is
	// still set for this room, the previous instance died without running its cleanup — i.e. a
	// browser reload — so we bounce back to /multiplayer.
	//
	// (The previous implementation used performance.getEntriesByType("navigation")[0]?.type,
	// but that returns the *document-level* navigation type, which doesn't update for
	// client-side router.push. If a user reloaded /multiplayer and then clicked Create/Join,
	// that document-level type stayed "reload" and we incorrectly bounced them straight back
	// out — which also took newly-created rooms from 1 player to 0 and deleted the row.)
	useEffect(() => {
		if (typeof window === "undefined") return;
		const ACTIVE_KEY = "away:jam:activeRoom";
		let alreadyActive = false;
		try {
			alreadyActive = sessionStorage.getItem(ACTIVE_KEY) === roomId;
		} catch {}
		if (alreadyActive) {
			// We reloaded inside this jam. The previous instance's pagehide handler
			// already attempted the decrement; calling safeDecrement here too would
			// take the counter down twice (e.g. a 3-player room would briefly show 1
			// even though 2 humans are still inside).
			isRedirectingRef.current = true;
			hasDecrementedRef.current = true;
			try {
				sessionStorage.removeItem(ACTIVE_KEY);
			} catch {}
			router.replace("/multiplayer");
			return;
		}
		try {
			sessionStorage.setItem(ACTIVE_KEY, roomId);
		} catch {}
		return () => {
			try {
				if (sessionStorage.getItem(ACTIVE_KEY) === roomId) {
					sessionStorage.removeItem(ACTIVE_KEY);
				}
			} catch {}
		};
	}, [roomId, router, safeDecrement]);

	// Catch the back button / tab close — fire a decrement so the room counter doesn't get
	// stuck when the page is unloaded without React running its cleanup. (React only runs
	// effect cleanup for client-side unmounts; tab close + browser reload skip it.)
	//
	// We use fetch with keepalive:true + a Supabase RPC so the POST request survives browser
	// tab close. The RPC atomically decrements current_players or deletes the room, needing
	// only a single round-trip that the browser guarantees will complete.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleUnload = (event: PageTransitionEvent) => {
			if (event.persisted) return;
			hasDecrementedRef.current = true;
			decrementViaKeepalive(roomId);
			try {
				roomChannelRef.current?.untrack();
			} catch {}
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
	const equippedBadgeRef = useRef<string | null>(null);

	const trackPresence = useCallback(() => {
		const channel = roomChannelRef.current;
		if (!channel || !myNameRef.current) return;
		const data = {
			displayName: myNameRef.current,
			joinedAt: joinedAtRef.current,
			userId: myUserIdRef.current ?? undefined,
			noteColorHex: noteColorRef.current,
			soundfont: currentSoundfontRef.current,
			equippedBadge: equippedBadgeRef.current,
		};
		channel.track(data);
		// Belt-and-suspenders: @supabase/realtime-js doesn't reliably emit a
		// presence event when an existing key re-tracks with new metadata, so
		// peers' player lists go stale on soundfont/color/badge changes (the
		// audio still works because every WebRTC note message carries the
		// soundfont in its payload, but the hover tooltip reads
		// `players[].soundfont`, which only updates on presence events).
		// Mirror the track payload as a broadcast — broadcasts always fire —
		// so the receiving side gets the change immediately regardless of
		// presence behaviour.
		channel.send({
			type: "broadcast",
			event: "player-meta",
			payload: { senderId: myTempId.current, ...data },
		});
	}, []);

	// Read the equipped badge from localStorage on mount, then re-track whenever the user
	// equips / unequips a badge so other players see the change live next to my name.
	useEffect(() => {
		equippedBadgeRef.current = getEquippedBadge();
		trackPresence();
		if (typeof window === "undefined") return;
		const onEquipChange = (e: Event) => {
			const detail = (e as CustomEvent<string | null>).detail;
			equippedBadgeRef.current = detail ?? null;
			trackPresence();
		};
		window.addEventListener(BADGE_EQUIP_EVENT, onEquipChange);
		return () => window.removeEventListener(BADGE_EQUIP_EVENT, onEquipChange);
	}, [trackPresence]);

	useEffect(() => {
		const prev = myNameRef.current;
		const changed = prev !== myName;
		myNameRef.current = myName;
		trackPresence();
		if (changed) {
			roomChannelRef.current?.send({
				type: "broadcast",
				event: "display-name-change",
				payload: { senderId: myTempId.current, displayName: myName },
			});
		}
		setPlayers((prev) =>
			prev.map((p) => (p.isMe ? { ...p, displayName: myName } : p)),
		);
	}, [myName, trackPresence]);

	useEffect(() => {
		myUserIdRef.current = user?.id ?? null;
		trackPresence();
	}, [user, trackPresence]);

	// `noteColor` is the live draft from the picker (used for local visual
	// preview — own piano, own trails, own chat-bubble swatch). `savedNoteColor`
	// is the last value we actually broadcast to peers. Decoupling them means
	// dragging through colors no longer spams the channel with re-tracks /
	// broadcasts — peers only see the change when the user clicks Save below.
	const [savedNoteColor, setSavedNoteColor] = useState(noteColor);
	useEffect(() => {
		noteColorRef.current = savedNoteColor;
	}, [savedNoteColor]);

	const handleSaveNoteColor = useCallback(() => {
		if (noteColor === savedNoteColor) return;
		setSavedNoteColor(noteColor);
		// Update the ref synchronously so trackPresence on the next line picks
		// up the new value instead of waiting for the effect above to run.
		noteColorRef.current = noteColor;
		trackPresence();
		roomChannelRef.current?.send({
			type: "broadcast",
			event: "note-color-change",
			payload: { senderId: myTempId.current, noteColorHex: noteColor },
		});
		setPlayers((prev) =>
			prev.map((p) => (p.isMe ? { ...p, noteColorHex: noteColor } : p)),
		);
	}, [noteColor, savedNoteColor, trackPresence]);

	const noteColorDirty = noteColor !== savedNoteColor;

	useEffect(() => {
		const prev = currentSoundfontRef.current;
		const changed = prev !== currentSoundfont;
		currentSoundfontRef.current = currentSoundfont;
		trackPresence();
		if (changed) {
			roomChannelRef.current?.send({
				type: "broadcast",
				event: "soundfont-change",
				payload: { senderId: myTempId.current, soundfont: currentSoundfont },
			});
		}
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
			// skipAuthSync: auth.updateUser refreshes the access token, which
			// kicks the realtime channel into a reconnect and makes us briefly
			// leave the room. The profiles row is still updated.
			if (isLoggedIn) updateMyUsername(next, true);
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
			// Muted peers play silently. We still want to suppress trailing
			// noteOff events so the playNote bookkeeping stays consistent if
			// the user un-mutes later — passing through stopNote is harmless
			// since there's no held note to release anyway.
			if (mutedIdsRef.current.has(peerId)) return;
			const player = playersRef.current.find((p) => p.id === peerId);
			const colorIndex = player?.colorIndex ?? 0;
			const noteColorHex = showPlayerColorsRef.current ? player?.noteColorHex : noteColorRef.current;
			const soundfontKey = soundfontFromPayload ?? player?.soundfont;
			if (soundfontKey) ensureSoundfontLoaded(soundfontKey);
			// Every note carries the sender's current soundfont, so use it as a
			// reliable fallback to keep the player-list popover in sync with
			// what's actually playing. The dedicated "soundfont-change" /
			// "player-meta" events can race with the presence channel on first
			// connect or after reconnects — this ensures we never display a
			// stale soundfont while audio is already playing the new one.
			if (soundfontFromPayload) {
				setPlayers((prev) => {
					let changed = false;
					const next = prev.map((p) => {
						if (p.id !== peerId) return p;
						if (p.soundfont === soundfontFromPayload) return p;
						changed = true;
						return { ...p, soundfont: soundfontFromPayload };
					});
					return changed ? next : prev;
				});
			}
			if (isNoteOn) {
				playNote(note, velocity, peerId, colorIndex, noteColorHex, soundfontKey);
			} else {
				stopNote(note, peerId, soundfontKey);
			}
		},
		[playNote, stopNote, ensureSoundfontLoaded],
	);

	const onReceivePeerSustain = useCallback(
		(peerId: string, active: boolean, soundfontFromPayload?: string) => {
			// Mirror the mute filter from onReceivePeerNote — without this, a
			// muted peer holding sustain would keep their channel pedaling
			// indefinitely (audio is muted but the engine state would still be on).
			if (mutedIdsRef.current.has(peerId)) return;
			const peer = playersRef.current.find((p) => p.id === peerId);
			const sf = soundfontFromPayload ?? peer?.soundfont;
			if (sf) ensureSoundfontLoaded(sf);
			setPeerSustain(peerId, active, sf);
		},
		[setPeerSustain, ensureSoundfontLoaded],
	);

	const {
		initiateConnection,
		handleOffer,
		handleAnswer,
		handleCandidate,
		removePeer,
		broadcastNote,
		broadcastSustain,
		hasPeer,
		knownPeerIds,
	} = useWebRTC(myTempId.current, onReceivePeerNote, onReceivePeerSustain);

	const handleLocalPlay = useCallback(
		(note: number, velocity: number = 127) => {
			playNote(note, velocity, "self");
			broadcastNote(note, velocity, true, currentSoundfontRef.current);
			incrementTotalNotes();
			checkAndUnlockAchievements();
		},
		[playNote, broadcastNote],
	);

	const handleLocalStop = useCallback(
		(note: number) => {
			stopNote(note, "self");
			broadcastNote(note, 0, false, currentSoundfontRef.current);
		},
		[stopNote, broadcastNote],
	);

	const handleLocalSustain = useCallback(
		(active: boolean) => {
			setSustain(active);
			broadcastSustain(active, currentSoundfontRef.current);
		},
		[setSustain, broadcastSustain],
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

	// Map of senderId → peer's note color, used by the chat panel to tint each
	// roommate's bubbles in their own color. We key by both the presence id
	// (anonymous senders) and the userId (logged-in senders) since either can
	// appear as a message's senderId.
	const senderColorById = useMemo(() => {
		const map = new Map<string, string>();
		players.forEach((p) => {
			if (p.isMe || !p.noteColorHex) return;
			map.set(p.id, p.noteColorHex);
			if (p.userId) map.set(p.userId, p.noteColorHex);
		});
		return map;
	}, [players]);

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
	const ensureSoundfontLoadedRef = useRef(ensureSoundfontLoaded);
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

		room.on("broadcast", { event: "soundfont-change" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			setPlayers((prev) =>
				prev.map((p) =>
					p.id === payload.senderId ? { ...p, soundfont: payload.soundfont } : p,
				),
			);
			if (payload.soundfont) {
				ensureSoundfontLoadedRef.current(payload.soundfont);
			}
		});

		room.on("broadcast", { event: "note-color-change" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			setPlayers((prev) =>
				prev.map((p) =>
					p.id === payload.senderId ? { ...p, noteColorHex: payload.noteColorHex } : p,
				),
			);
		});

		room.on("broadcast", { event: "display-name-change" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			if (!payload.displayName) return;
			setPlayers((prev) =>
				prev.map((p) =>
					p.id === payload.senderId ? { ...p, displayName: payload.displayName } : p,
				),
			);
		});

		// A peer has just (re)subscribed to this channel. Their previous channel
		// may have torn down too fast for our presence "leave" event to fire,
		// leaving us with a stale WebRTC peer connection and stale player meta.
		// Drop the old peer connection, re-broadcast our own meta so they see
		// our up-to-date name/color, and eagerly re-initiate — perfect
		// negotiation handles any offer collision if they initiate too.
		room.on("broadcast", { event: "rejoin" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			const peerId = payload.senderId as string;
			releaseAllForPlayerRef.current(peerId);
			removePeerRef.current(peerId);
			trackPresence();
			initiateConnectionRef.current(peerId, sendSignal);
		});

		// `trackPresence` mirrors the presence payload as a "player-meta" broadcast so
		// metadata changes (soundfont, note color, badge, displayName) reach peers even
		// when the realtime-js version we're on doesn't emit a presence event for a
		// re-track of an existing key. Without this, the hover-popover soundfont name
		// could stay stale until the next presence sync.
		room.on("broadcast", { event: "player-meta" }, ({ payload }) => {
			if (payload.senderId === myTempId.current) return;
			if (payload.soundfont) ensureSoundfontLoadedRef.current(payload.soundfont);
			const friendIds = friendUserIdsRef.current;
			setPlayers((prev) => {
				let changed = false;
				const next = prev.map((p) => {
					if (p.id !== payload.senderId) return p;
					const updated: PlayerEntry = {
						...p,
						displayName: payload.displayName || p.displayName,
						userId: payload.userId ?? p.userId,
						noteColorHex: payload.noteColorHex ?? p.noteColorHex,
						soundfont: payload.soundfont ?? p.soundfont,
						equippedBadge: payload.equippedBadge ?? p.equippedBadge ?? null,
						isFriend: !!(payload.userId ?? p.userId) && friendIds.has((payload.userId ?? p.userId)!),
					};
					if (
						updated.displayName === p.displayName &&
						updated.userId === p.userId &&
						updated.noteColorHex === p.noteColorHex &&
						updated.soundfont === p.soundfont &&
						updated.equippedBadge === p.equippedBadge &&
						updated.isFriend === p.isFriend
					) {
						return p;
					}
					changed = true;
					return updated;
				});
				return changed ? next : prev;
			});
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
					equippedBadge: data?.equippedBadge ?? null,
				};
			});

			entries.sort((a, b) => a.joinedAt - b.joinedAt);

			entries.forEach((e) => {
				if (e.id !== myTempId.current && e.soundfont) {
					ensureSoundfontLoadedRef.current(e.soundfont);
				}
			});

			const friendIds = friendUserIdsRef.current;
			// Supabase's local presence state can lag behind live broadcasts after
			// a peer re-tracks — a `note-color-change` / `player-meta` broadcast
			// arrives and lands in `players` instantly, then a presence "join"
			// event fires for the same re-track but reads a still-stale
			// presenceState() and overwrites our just-applied color back to the
			// old value. Treat broadcasts as authoritative for any peer we already
			// know about: only seed the broadcast-driven fields (displayName,
			// noteColorHex, soundfont, equippedBadge) from presence the very first
			// time we see that presence key.
			const existingById = new Map(playersRef.current.map((p) => [p.id, p]));
			const newPlayers: PlayerEntry[] = entries.map((e, index) => {
				const existing = existingById.get(e.id);
				return {
					id: e.id,
					userId: e.userId,
					displayName: existing?.displayName ?? e.displayName,
					colorIndex: index,
					noteColorHex: existing?.noteColorHex ?? e.noteColorHex,
					soundfont: existing?.soundfont ?? e.soundfont,
					equippedBadge: existing ? existing.equippedBadge : e.equippedBadge,
					isMe: e.id === myTempId.current,
					isFriend: !!e.userId && friendIds.has(e.userId),
				};
			});
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
				// Tell every peer in the channel that we just (re)joined so
				// they can drop any stale peer/audio state for our id and
				// re-broadcast their meta back. Without this, a fast leave +
				// rejoin can leave the other side thinking we're still
				// connected, which keeps a dead WebRTC connection in place
				// (they can't hear us) and stops their player-meta from
				// being repushed (we show no username for them).
				room.send({
					type: "broadcast",
					event: "rejoin",
					payload: { senderId: myTempId.current },
				});
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
				onSaveNoteColor={handleSaveNoteColor}
				noteColorDirty={noteColorDirty}
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
						mutedIds={mutedIds}
						onToggleMute={handleToggleMute}
						myNoteColor={noteColor}
						onMyNoteColorChange={setNoteColor}
						onSaveMyNoteColor={handleSaveNoteColor}
						myNoteColorDirty={noteColorDirty}
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
						senderColorById={senderColorById}
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
				onBeforeNavigateAway={async () => {
					// Decrement the room counter (or delete the row if we were
					// the last one in) BEFORE the browser navigates to the full
					// profile page. The pagehide-based fallback can miss this
					// when the browser puts the page into bfcache instead of
					// unloading it, which leaves the room showing a phantom
					// player. Untrack presence too so peers see us leave
					// immediately rather than waiting for the WebSocket
					// heartbeat to time us out.
					try {
						roomChannelRef.current?.untrack();
					} catch {}
					await safeDecrement();
				}}
			/>

			<ChordDisplay heldMidis={localHeldMidis} enabled={settings.chordRecognizerEnabled} />

			<RecordingSignInModal open={recordingNeedsLogin} onClose={dismissRecordingLogin} />
		</div>
	);
}
