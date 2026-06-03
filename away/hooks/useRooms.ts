// ============================================================================
// useRooms.ts
// ----------------------------------------------------------------------------
// Lobby state: the live list of multiplayer rooms shown on /multiplayer.
//
// Returns the full list, the filtered list (Public / Private / Friends), and
// the filter setter. Updates in real time via a Supabase Realtime subscription
// on the `rooms` table — any insert / update / delete triggers a refetch.
//
// Friends filter: needs the user's friend list to know which "Friends" rooms
// to show. Fetched once on mount; rooms hosted by you OR by a friend pass.
// ============================================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends } from "@/lib/friends";

// "public"  — visible to everyone
// "private" — password-required
// "friends" — only the host's friends can see / join
export type Accessibility = "public" | "private" | "friends";

// Public room data shown in the lobby list. `password` is NOT included here — it's never
// shipped to clients. Use the generated `has_password` boolean to know if a room is locked,
// and call the `join_private_room` Postgres function to verify the password server-side.
export type Room = {
	id: string;
	name: string;
	host: string;
	host_user_id: string | null;
	accessibility: Accessibility;
	has_password: boolean;
	max_players: number;
	current_players: number;
	created_at: string;
};

// All non-sensitive columns selected from the rooms table.
// Defined as a constant so any new field in the schema gets explicitly
// considered before being shipped to clients.
const ROOM_PUBLIC_COLUMNS =
	"id, name, host, host_user_id, accessibility, has_password, max_players, current_players, created_at";

// Two-step create flow used by the create-room modal.
export type CreateStep = "settings" | "name";

export function useRooms() {
	const [rooms, setRooms] = useState<Room[]>([]);
	const [filter, setFilter] = useState<Accessibility>("public");
	const [myUserId, setMyUserId] = useState<string | null>(null);
	const [friendIds, setFriendIds] = useState<Set<string>>(new Set());

	// Fetch the full room list. Called on mount + after every realtime event.
	const fetchRooms = useCallback(async () => {
		const { data } = await supabase
			.from("rooms")
			.select(ROOM_PUBLIC_COLUMNS)
			.order("created_at", { ascending: false });
		if (data) setRooms(data as Room[]);
	}, []);

	// Resolve "who am I + who are my friends" once on mount. Needed for the
	// Friends filter to know what to show.
	useEffect(() => {
		const client = createClient();
		(async () => {
			const { data } = await client.auth.getUser();
			const uid = data.user?.id ?? null;
			setMyUserId(uid);
			if (uid) {
				const friends = await fetchFriends(uid);
				setFriendIds(new Set(friends.map((f) => f.userId).filter(Boolean)));
			} else {
				setFriendIds(new Set());
			}
		})();
	}, []);

	// Initial list + realtime subscription. One channel covers the whole
	// `rooms` table because the lobby cares about every row.
	useEffect(() => {
		fetchRooms();

		const channel = supabase
			.channel("rooms-list")
			.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
				// Cheap to refetch the whole list — saves us from reconciling
				// per-row insert / update / delete events into local state.
				fetchRooms();
			})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [fetchRooms]);

	// Filtered list shown to the user. Note the friends-mode check accepts
	// rooms hosted by ME so I can see (and rejoin) my own friends-room.
	const filteredRooms = rooms.filter((r) => {
		if (r.accessibility !== filter) return false;
		if (filter !== "friends") return true;
		if (!r.host_user_id) return false;
		if (r.host_user_id === myUserId) return true;
		return friendIds.has(r.host_user_id);
	});

	return { rooms, filter, setFilter, filteredRooms, fetchRooms };
}
