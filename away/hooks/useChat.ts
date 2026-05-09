import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchRoomMessages, rowToMessage, type RoomMessageRow } from "@/lib/messages";

export type ChatMessage = {
	id: string;
	senderId: string;
	senderName: string;
	text: string;
	timestamp: number;
};

export function useChat(roomId: string | null) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isChatOpen, setIsChatOpen] = useState(false);

	const addMessage = useCallback((msg: ChatMessage) => {
		setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
	}, []);

	useEffect(() => {
		if (!roomId) {
			setMessages([]);
			return;
		}

		let cancelled = false;
		(async () => {
			const history = await fetchRoomMessages(roomId);
			if (cancelled) return;
			setMessages(history);
		})();

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
					setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
				},
			)
			.subscribe();

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
	};
}
