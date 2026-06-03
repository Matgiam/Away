// ============================================================================
// useCreateRoom.ts
// ----------------------------------------------------------------------------
// All the state and the submit handler for the "Create room" modal.
//
// Exposes:
//   * The two-step UI state (settings → name)
//   * Form fields (room name, accessibility, password, max players)
//   * `handleCreateRoom` — resolves the host display name, generates a short
//     room id, inserts the rooms row, then navigates into the jam.
//   * Two utility helpers: `getOrCreatePlayerId` for anonymous play and
//     `getDisplayName` for the host label.
// ============================================================================

"use client";

import { useState } from "react";
import { useAppRouter } from "@/hooks/useAppRouter";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import type { Accessibility, CreateStep } from "./useRooms";

export type { CreateStep };

// Anonymous players need *some* id so chat / presence works. We cache one in
// sessionStorage (not localStorage) so closing the tab resets the identity —
// anonymous users don't get a permanent profile that follows them around.
export function getOrCreatePlayerId(): string {
	if (typeof window === "undefined") return "Player-0000";
	const existing = sessionStorage.getItem("playerId");
	if (existing) return existing;
	// Random 4-digit suffix is enough to distinguish concurrent anonymous
	// users in one room.
	const newId = `Player-${Math.floor(Math.random() * 9000)}`;
	sessionStorage.setItem("playerId", newId);
	return newId;
}

// Best-name resolution chain used to label the host:
//   1. profiles.username (DB source of truth)
//   2. auth.users.user_metadata.username (legacy fallback)
//   3. local part of the user's email
//   4. first 8 chars of their auth id
//   5. anonymous Player-NNNN
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

// Module-level singleton so anyone importing this module sees the same id
// (avoids per-component drift in anonymous sessions).
export const myTempId = getOrCreatePlayerId();

export function useCreateRoom() {
	const router = useAppRouter();
	// Modal visibility / step machine.
	const [showCreate, setShowCreate] = useState(false);
	const [createStep, setCreateStep] = useState<CreateStep>("settings");
	// Form fields.
	const [accessibility, setAccessibility] = useState<Accessibility>("public");
	const [password, setPassword] = useState("");
	const [maxPlayers, setMaxPlayers] = useState(4);
	const [roomName, setRoomName] = useState("");
	// Prevents double-submit if the user spams the create button.
	const [creating, setCreating] = useState(false);

	const handleCreateRoom = async () => {
		if (!roomName.trim() || creating) return;

		setCreating(true);
		// Close the modal immediately so the user sees responsive feedback —
		// any error reopens it via the navigation back-stack.
		setShowCreate(false);

		const hostName = await getDisplayName();
		const supabaseClient = createClient();
		const { data: userData } = await supabaseClient.auth.getUser();
		const hostUserId = userData.user?.id ?? null;

		// 5-character base-36 id. Collisions are extremely rare given the
		// short-lived nature of rooms; if one does happen the insert fails and
		// the user gets a retry.
		const roomId = Math.random().toString(36).substring(2, 7);
		// Insert payload includes `password` for the server, but never enters our public Room
		// type (which the lobby reads). The DB has a generated `has_password` boolean column
		// that the lobby reads instead — see public/lib/courses RLS notes.
		const newRoom = {
			id: roomId,
			name: roomName.trim(),
			host: hostName,
			host_user_id: hostUserId,
			accessibility,
			// Only privates carry a password; public/friends always null.
			password: accessibility === "private" ? password : null,
			max_players: maxPlayers,
			current_players: 1, // host counts as the first occupant
			created_at: new Date().toISOString(),
		};

		const { error } = await supabase.from("rooms").insert(newRoom);
		if (!error) {
			// Remember that we hosted this room so the jam page can show host-only UI.
			sessionStorage.setItem("hostedRoomId", roomId);
			router.push(`/jam/${roomId}`);
		} else {
			setCreating(false); // re-enable the create button on failure
		}
	};

	// Resets every field to defaults and closes the modal. Used both by
	// cancel and after a successful create (in case the modal is reopened).
	const resetCreate = () => {
		setShowCreate(false);
		setCreateStep("settings");
		setAccessibility("public");
		setPassword("");
		setMaxPlayers(4);
		setRoomName("");
		setCreating(false);
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
		creating,
	};
}
