"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import type { Accessibility, Room, CreateStep } from "./useRooms";

export type { CreateStep };

export function getOrCreatePlayerId(): string {
	if (typeof window === "undefined") return "Player-0000";
	const existing = sessionStorage.getItem("playerId");
	if (existing) return existing;
	const newId = `Player-${Math.floor(Math.random() * 9000)}`;
	sessionStorage.setItem("playerId", newId);
	return newId;
}

export async function getDisplayName(): Promise<string> {
	if (typeof window === "undefined") return "Player-0000";
	try {
		const supabaseClient = createClient();
		const { data } = await supabaseClient.auth.getUser();
		if (data.user) {
			const { data: profile } = await supabaseClient.from("profiles").select("username").eq("id", data.user.id).maybeSingle();
			return (
				profile?.username ||
				(data.user.user_metadata?.username as string | undefined) ||
				data.user.email?.split("@")[0] ||
				data.user.id.substring(0, 8)
			);
		}
	} catch {}
	return getOrCreatePlayerId();
}

export const myTempId = getOrCreatePlayerId();

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

		const hostName = await getDisplayName();
		const supabaseClient = createClient();
		const { data: userData } = await supabaseClient.auth.getUser();
		const hostUserId = userData.user?.id ?? null;

		const roomId = Math.random().toString(36).substring(2, 7);
		const newRoom: Room = {
			id: roomId,
			name: roomName.trim(),
			host: hostName,
			host_user_id: hostUserId,
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
