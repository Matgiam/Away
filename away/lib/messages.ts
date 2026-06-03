// ============================================================================
// messages.ts
// ----------------------------------------------------------------------------
// Thin Supabase data-access layer for the per-room chat history.
//
// The realtime listener for *new* messages lives in `hooks/useChat.ts`; this
// file only handles the synchronous CRUD calls — load history once on join,
// insert a new row when the user sends a message. Everything else (presence,
// signaling, etc.) goes through the room's Supabase Realtime channel.
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/hooks/useChat";

// Raw row shape returned by Supabase — snake_case as stored in Postgres.
type RoomMessageRow = {
	id: string;
	room_id: string;
	sender_id: string;
	sender_name: string;
	text: string;
	created_at: string; // ISO timestamp
};

// Convert a DB row into the camelCase shape the UI consumes. Also parses the
// ISO timestamp into a numeric epoch — easier to sort / format on the client.
function rowToMessage(r: RoomMessageRow): ChatMessage {
	return {
		id: r.id,
		senderId: r.sender_id,
		senderName: r.sender_name,
		text: r.text,
		timestamp: new Date(r.created_at).getTime(),
	};
}

// Fetch the full chat history for a room, oldest-first. Used once when the
// user joins the room; subsequent messages arrive through the realtime
// subscription in useChat.
export async function fetchRoomMessages(roomId: string): Promise<ChatMessage[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("room_messages")
		.select("id, room_id, sender_id, sender_name, text, created_at")
		.eq("room_id", roomId)
		.order("created_at", { ascending: true });
	// `data` can be null on error — coerce to [] so callers always get an array.
	return ((data as RoomMessageRow[] | null) ?? []).map(rowToMessage);
}

// Insert a new chat message. Returns true on success, false on any DB error.
// We deliberately don't surface the error itself — chat failures are
// non-critical, and the UI just shows a generic "couldn't send" toast.
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

// Re-exports — handy for tests / callers that want to convert rows themselves.
export { rowToMessage };
export type { RoomMessageRow };
