// ============================================================================
// useFriends.ts
// ----------------------------------------------------------------------------
// Live view of the current user's friend graph.
//
// Returns three parallel lists:
//   * `friends`  — accepted relationships, either direction.
//   * `pending`  — incoming friend requests (I'm the addressee).
//   * `outgoing` — friend requests I've sent that the other side hasn't acted on.
//
// All three update automatically via two Supabase Realtime subscriptions — one
// for rows where I'm the requester, one for rows where I'm the addressee —
// so accepting / declining / unfriending propagates without a refresh.
// ============================================================================

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

	// Single refresh function — used both on mount and whenever realtime tells
	// us something changed. Parallel-fetches the three lists.
	const refresh = useCallback(async () => {
		if (!userId) {
			// Signed-out / no user id → empty everything.
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

	// Initial fetch + re-fetch when the user id changes.
	useEffect(() => {
		refresh();
	}, [refresh]);

	// Realtime: any change to a friendships row involving me triggers a refetch.
	// We use two subscriptions (one per side) because Supabase's filter syntax
	// doesn't support OR across columns. Both call the same refresh() so the
	// caller gets a single coherent update.
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
