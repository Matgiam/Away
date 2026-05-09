"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
	fetchFriends,
	fetchOutgoingRequests,
	fetchPendingRequests,
	type Friend,
	type OutgoingRequest,
	type PendingRequest,
} from "@/lib/friends";

export function useFriends(userId: string | null) {
	const [friends, setFriends] = useState<Friend[]>([]);
	const [pending, setPending] = useState<PendingRequest[]>([]);
	const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		if (!userId) {
			setFriends([]);
			setPending([]);
			setOutgoing([]);
			setLoading(false);
			return;
		}
		const [f, p, o] = await Promise.all([fetchFriends(userId), fetchPendingRequests(userId), fetchOutgoingRequests(userId)]);
		setFriends(f);
		setPending(p);
		setOutgoing(o);
		setLoading(false);
	}, [userId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	useEffect(() => {
		if (!userId) return;
		const supabase = createClient();
		const channel = supabase
			.channel(`friendships-${userId}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "friendships",
					filter: `requester_id=eq.${userId}`,
				},
				() => refresh(),
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "friendships",
					filter: `addressee_id=eq.${userId}`,
				},
				() => refresh(),
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, refresh]);

	return { friends, pending, outgoing, loading, refresh };
}
