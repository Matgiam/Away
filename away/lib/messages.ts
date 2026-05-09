import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/hooks/useChat";

type RoomMessageRow = {
	id: string;
	room_id: string;
	sender_id: string;
	sender_name: string;
	text: string;
	created_at: string;
};

function rowToMessage(r: RoomMessageRow): ChatMessage {
	return {
		id: r.id,
		senderId: r.sender_id,
		senderName: r.sender_name,
		text: r.text,
		timestamp: new Date(r.created_at).getTime(),
	};
}

export async function fetchRoomMessages(roomId: string): Promise<ChatMessage[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("room_messages")
		.select("id, room_id, sender_id, sender_name, text, created_at")
		.eq("room_id", roomId)
		.order("created_at", { ascending: true });
	return ((data as RoomMessageRow[] | null) ?? []).map(rowToMessage);
}

export async function sendRoomMessage(roomId: string, msg: ChatMessage): Promise<boolean> {
	const supabase = createClient();
	const { error } = await supabase.from("room_messages").insert({
		id: msg.id,
		room_id: roomId,
		sender_id: msg.senderId,
		sender_name: msg.senderName,
		text: msg.text,
	});
	return !error;
}

export { rowToMessage };
export type { RoomMessageRow };
