// ============================================================================
// useChat.ts
// ----------------------------------------------------------------------------
// Per-room chat. Loads the message history when the room id changes and
// subscribes to a Supabase Realtime channel that pipes new INSERTs from the
// `room_messages` table into local state.
//
// State:
//   * `messages` — full ordered history for the current room.
//   * `isChatOpen` — whether the chat panel is on-screen. When closed, new
//     messages from other users bump `unreadCount` so the chat icon can show
//     a badge.
//   * `unreadCount` — resets to 0 when the panel opens.
//
// `addMessage` lets the caller insert a message into state directly (used
// when the local user sends a message; the realtime echo would re-add it
// otherwise, but the dedupe guard handles that).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchRoomMessages, rowToMessage, type RoomMessageRow } from "@/lib/messages";

// One chat message — what the panel renders. `senderName` is captured at
// send time so a later username change doesn't retroactively edit history.
export type ChatMessage = {
	id: string;
	senderId: string;
	senderName: string;
	text: string;
	timestamp: number;
};

export function useChat(roomId: string | null, myId: string | null) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);

	// Mirror the open-state and my-id into refs so the realtime callback (which
	// closes over them) sees the latest values without re-subscribing.
	const isChatOpenRef = useRef(isChatOpen);
	const myIdRef = useRef(myId);

	useEffect(() => {
		isChatOpenRef.current = isChatOpen;
		// Opening the panel clears the unread badge.
		if (isChatOpen) setUnreadCount(0);
	}, [isChatOpen]);

	useEffect(() => {
		myIdRef.current = myId;
	}, [myId]);

	// Idempotent insert — used by the local sender to add their own message
	// without waiting for the realtime echo. Re-adding the same id is a no-op.
	const addMessage = useCallback((msg: ChatMessage) => {
		setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
	}, []);

	useEffect(() => {
		// Leaving a room: reset state and stop listening.
		if (!roomId) {
			setMessages([]);
			setUnreadCount(0);
			return;
		}

		// Cancellation guard so a slow history fetch doesn't overwrite a fast
		// switch to a different room.
		let cancelled = false;
		(async () => {
			const history = await fetchRoomMessages(roomId);
			if (cancelled) return;
			setMessages(history);
		})();

		// Subscribe to INSERTs on this room's chat table.
		const supabase = createClient();
		const channel = supabase
			.channel(`room-messages-${roomId}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "room_messages",
					filter: `room_id=eq.${roomId}`,
				},
				(payload) => {
					const msg = rowToMessage(payload.new as RoomMessageRow);
					setMessages((prev) => {
						// Dedupe — the local sender already added this via addMessage().
						if (prev.some((m) => m.id === msg.id)) return prev;
						// Only bump the unread badge when the message is from
						// somebody else AND the chat panel is hidden.
						if (!isChatOpenRef.current && msg.senderId !== myIdRef.current) {
							setUnreadCount((c) => c + 1);
						}
						return [...prev, msg];
					});
				},
			)
			.subscribe();

		// Cleanup: stop the cancellation flag AND remove the channel so we
		// don't leak subscriptions across room switches.
		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [roomId]);

	return {
		messages,
		isChatOpen,
		setIsChatOpen,
		addMessage,
		unreadCount,
	};
}
