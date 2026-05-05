"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type Accessibility = "public" | "private" | "friends";

export type Room = {
	id: string;
	name: string;
	host: string;
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

	const fetchRooms = useCallback(async () => {
		const { data } = await supabase.from("rooms").select("*").order("created_at", { ascending: false });
		if (data) setRooms(data);
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

	const filteredRooms = rooms.filter((r) => r.accessibility === filter);

	return { rooms, filter, setFilter, filteredRooms, fetchRooms };
}
