"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends } from "@/lib/friends";

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
const ROOM_PUBLIC_COLUMNS =
	"id, name, host, host_user_id, accessibility, has_password, max_players, current_players, created_at";

export type CreateStep = "settings" | "name";

export function useRooms() {
	const [rooms, setRooms] = useState<Room[]>([]);
	const [filter, setFilter] = useState<Accessibility>("public");
	const [myUserId, setMyUserId] = useState<string | null>(null);
	const [friendIds, setFriendIds] = useState<Set<string>>(new Set());

	const fetchRooms = useCallback(async () => {
		const { data } = await supabase
			.from("rooms")
			.select(ROOM_PUBLIC_COLUMNS)
			.order("created_at", { ascending: false });
		if (data) setRooms(data as Room[]);
	}, []);

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

	useEffect(() => {
		fetchRooms();

		const channel = supabase
			.channel("rooms-list")
			.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
				fetchRooms();
			})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [fetchRooms]);

	const filteredRooms = rooms.filter((r) => {
		if (r.accessibility !== filter) return false;
		if (filter !== "friends") return true;
		if (!r.host_user_id) return false;
		if (r.host_user_id === myUserId) return true;
		return friendIds.has(r.host_user_id);
	});

	return { rooms, filter, setFilter, filteredRooms, fetchRooms };
}
