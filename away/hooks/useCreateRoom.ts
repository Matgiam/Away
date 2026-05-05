"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Accessibility, Room, CreateStep } from "./useRooms";

export type { CreateStep };

const myTempId = `Player-${Math.floor(Math.random() * 9000 + 1000)}`;

export function useCreateRoom() {
	const router = useRouter();
	const [showCreate, setShowCreate] = useState(false);
	const [createStep, setCreateStep] = useState<CreateStep>("settings");

	const [accessibility, setAccessibility] = useState<Accessibility>("public");
	const [password, setPassword] = useState("");
	const [maxPlayers, setMaxPlayers] = useState(4);
	const [roomName, setRoomName] = useState("");

	const handleCreateRoom = async () => {
		if (!roomName.trim()) return;

		const roomId = Math.random().toString(36).substring(2, 7);
		const newRoom: Room = {
			id: roomId,
			name: roomName.trim(),
			host: myTempId,
			accessibility,
			password: accessibility === "private" ? password : null,
			max_players: maxPlayers,
			current_players: 1,
			created_at: new Date().toISOString(),
		};

		const { error } = await supabase.from("rooms").insert(newRoom);
		if (!error) {
			sessionStorage.setItem("hostedRoomId", roomId);
			router.push(`/jam/${roomId}`);
		}
	};

	const resetCreate = () => {
		setShowCreate(false);
		setCreateStep("settings");
		setAccessibility("public");
		setPassword("");
		setMaxPlayers(4);
		setRoomName("");
	};

	return {
		showCreate,
		setShowCreate,
		createStep,
		setCreateStep,
		accessibility,
		setAccessibility,
		password,
		setPassword,
		maxPlayers,
		setMaxPlayers,
		roomName,
		setRoomName,
		handleCreateRoom,
		resetCreate,
	};
}
