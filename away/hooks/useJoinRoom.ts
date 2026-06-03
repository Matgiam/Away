// ============================================================================
// useJoinRoom.ts
// ----------------------------------------------------------------------------
// State + handlers for the "Join room" flow.
//
// Two paths:
//   * Public / friends rooms → bump current_players and navigate in one shot.
//   * Private rooms → show the password modal, then call the server-side
//     `join_private_room` RPC to verify before navigating. The password is
//     NEVER shipped to the client — only the boolean has_password flag is,
//     and the actual check happens inside the SECURITY DEFINER function.
//
// `joiningRoom` tracks which room (if any) the user is currently being
// prompted for a password for; the JoinRoomModal renders when it's non-null.
// ============================================================================

"use client";

import { useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { supabase } from "@/lib/supabase";
import type { Room } from "./useRooms";

export function useJoinRoom() {
	const router = useAppRouter();
	// Non-null while the password modal is open.
	const [joiningRoom, setJoiningRoom] = useState<Room | null>(null);
	const [joinPassword, setJoinPassword] = useState("");
	const [joinError, setJoinError] = useState("");

	const handleJoinRoom = async (room: Room) => {
		// Hard ceiling — server-side RLS also blocks this, but no point opening
		// the modal if the room is already full.
		if (room.current_players >= room.max_players) return;

		// Private → defer to the password modal.
		if (room.accessibility === "private") {
			setJoiningRoom(room);
			return;
		}

		// Public/friends: increment counter and go straight in.
		await supabase
			.from("rooms")
			.update({ current_players: room.current_players + 1 })
			.eq("id", room.id);

		router.push(`/jam/${room.id}`);
	};

	const handleJoinWithPassword = async () => {
		if (!joiningRoom) return;
		// Password is never sent to the client — we ask the server to verify via the
		// `join_private_room` SECURITY DEFINER function. Returns true only if the password
		// matches the stored value for this room.
		const { data: ok, error } = await supabase.rpc("join_private_room", {
			p_room_id: joiningRoom.id,
			p_password: joinPassword,
		});
		if (error || !ok) {
			setJoinError("Wrong password");
			return;
		}
		// Password correct → bump counter and navigate.
		await supabase
			.from("rooms")
			.update({ current_players: joiningRoom.current_players + 1 })
			.eq("id", joiningRoom.id);

		router.push(`/jam/${joiningRoom.id}`);
	};

	// Cancel / clear the password modal.
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
