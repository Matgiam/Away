"use client";

import { useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { supabase } from "@/lib/supabase";
import type { Room } from "./useRooms";

export function useJoinRoom() {
	const router = useAppRouter();
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
