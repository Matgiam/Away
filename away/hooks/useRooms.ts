"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";
import { fetchFriends } from "@/lib/friends";

export type Accessibility = "public" | "private" | "friends";

export type Room = {
	id: string;
	name: string;
	host: string;
	host_user_id: string | null;
	accessibility: Accessibility;
	password: string | null;
	max_players: number;
	current_players: number;
	created_at: string;
};

export type CreateStep = "settings" | "name";

export function useRooms() {
	const [rooms, setRooms] = useState<Room[]>([]);
	const [filter, setFilter] = useState<Accessibility>("public");
	const [myUserId, setMyUserId] = useState<string | null>(null);
	const [friendIds, setFriendIds] = useState<Set<string>>(new Set());

	const fetchRooms = useCallback(async () => {
		const { data } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
		if (data) setRooms(data);
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
