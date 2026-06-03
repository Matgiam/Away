// ============================================================================
// friends.ts
// ----------------------------------------------------------------------------
// Friends-system data access. Wraps the Supabase `friendships` table (one row
// per relationship, status = "pending" | "accepted") and resolves usernames
// from the `profiles` table.
//
// The schema uses a single row per friendship — either side can be the
// requester. So fetching "my friends" always means querying for
// (requester_id = me OR addressee_id = me) and figuring out which one I am.
//
// Functions:
//   * fetchFriends           — accepted friendships, both directions
//   * fetchPendingRequests   — incoming pending requests (I'm the addressee)
//   * fetchOutgoingRequests  — outgoing pending requests (I sent them)
//   * sendFriendRequest      — create OR auto-accept if there's a reverse pending request
//   * acceptFriendRequest    — set status = "accepted"
//   * removeFriendship       — delete the row (used for decline + unfriend)
//   * fetchPublicProfile     — username + stats + friend count for the profile modal
//   * updateMyUsername       — write a new username through to `profiles`
// ============================================================================

import { createClient } from "@/lib/supabase/client";

// ── UI-facing shapes ──────────────────────────────────────────────
// Each "request" view exposes the other party's id and username so the UI
// doesn't have to keep re-mapping.

export type Friend = {
	friendshipId: string;
	userId: string;
	username: string;
};

export type PendingRequest = {
	friendshipId: string;
	requesterId: string;
	username: string;
};

export type OutgoingRequest = {
	friendshipId: string;
	addresseeId: string;
	username: string;
};

// Raw friendships row — kept private to this module.
type FriendshipRow = {
	id: string;
	requester_id: string;
	addressee_id: string;
	status: string;
};

const FRIENDSHIP_COLUMNS = "id, requester_id, addressee_id, status";

// Batch-resolve a list of user IDs into usernames. One query → one round trip,
// regardless of how many ids we pass.
async function fetchUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (ids.length === 0) return map; // skip the query when there's nothing to look up
	const supabase = createClient();
	const { data } = await supabase.from("profiles").select("id, username").in("id", ids);
	if (!data) return map;
	for (const p of data as { id: string; username: string | null }[]) {
		map.set(p.id, p.username ?? "Unknown"); // null usernames shouldn't happen but be safe
	}
	return map;
}

// Fetch all *accepted* friendships involving `userId`. The "other" user is
// whichever id isn't `userId`.
export async function fetchFriends(userId: string): Promise<Friend[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_COLUMNS)
		.eq("status", "accepted")
		// Either side could be me — `.or` builds the SQL OR.
		.or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

	const rows = (data as FriendshipRow[] | null) ?? [];
	// Collect the OTHER user's id from each row, then resolve usernames once.
	const otherIds = rows.map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
	const usernames = await fetchUsernamesByIds(otherIds);

	return rows.map((f) => {
		const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id;
		return {
			friendshipId: f.id,
			userId: otherId,
			username: usernames.get(otherId) ?? "Unknown",
		};
	});
}

// Pending requests where I'm the *addressee* — i.e. someone wants to add me.
export async function fetchPendingRequests(userId: string): Promise<PendingRequest[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_COLUMNS)
		.eq("status", "pending")
		.eq("addressee_id", userId);

	const rows = (data as FriendshipRow[] | null) ?? [];
	const usernames = await fetchUsernamesByIds(rows.map((f) => f.requester_id));

	return rows.map((f) => ({
		friendshipId: f.id,
		requesterId: f.requester_id,
		username: usernames.get(f.requester_id) ?? "Unknown",
	}));
}

// Pending requests where I'm the *requester* — i.e. waiting on the other person.
export async function fetchOutgoingRequests(userId: string): Promise<OutgoingRequest[]> {
	const supabase = createClient();
	const { data } = await supabase
		.from("friendships")
		.select(FRIENDSHIP_COLUMNS)
		.eq("status", "pending")
		.eq("requester_id", userId);

	const rows = (data as FriendshipRow[] | null) ?? [];
	const usernames = await fetchUsernamesByIds(rows.map((f) => f.addressee_id));

	return rows.map((f) => ({
		friendshipId: f.id,
		addresseeId: f.addressee_id,
		username: usernames.get(f.addressee_id) ?? "Unknown",
	}));
}

// Send a friend request to `addresseeId`. If they already sent ME a pending
// request, treat this as "accept" instead — common race when both users
// add each other roughly simultaneously.
export async function sendFriendRequest(addresseeId: string): Promise<{ ok: boolean; error?: string }> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return { ok: false, error: "Not authenticated" };
	if (userData.user.id === addresseeId) return { ok: false, error: "Cannot add yourself" };

	const myId = userData.user.id;

	// Look for a reverse pending request — if it exists, auto-accept.
	const { data: incoming } = await supabase
		.from("friendships")
		.select("id")
		.eq("status", "pending")
		.eq("requester_id", addresseeId)
		.eq("addressee_id", myId)
		.maybeSingle();

	if (incoming) {
		const ok = await acceptFriendRequest(incoming.id);
		return ok ? { ok: true } : { ok: false, error: "Could not accept existing request" };
	}

	// Fresh request.
	const { error } = await supabase.from("friendships").insert({
		requester_id: myId,
		addressee_id: addresseeId,
		status: "pending",
	});

	if (error) {
		// Postgres unique-violation = duplicate friendship row.
		if (error.code === "23505") return { ok: false, error: "Request already exists" };
		return { ok: false, error: error.message };
	}
	return { ok: true };
}

// Flip an existing pending row to accepted.
export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
	const supabase = createClient();
	const { error } = await supabase
		.from("friendships")
		.update({ status: "accepted", updated_at: new Date().toISOString() })
		.eq("id", friendshipId);
	return !error;
}

// Hard-delete a friendship — used for "decline pending" and "unfriend".
export async function removeFriendship(friendshipId: string): Promise<boolean> {
	const supabase = createClient();
	const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
	return !error;
}

// Combined profile + stats blob used by the profile modal.
export type PublicProfile = {
	userId: string;
	username: string;
	timePlayedSeconds: number;
	notesPlayed: number;
	connexions: number;
	friendCount: number;
};

// Fetches everything the profile modal needs in one shot:
//   * username (from profiles)
//   * stats (from user_stats)
//   * accepted-friend count (count-only query on friendships)
// Three parallel queries → roughly one round-trip latency total.
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
	const supabase = createClient();
	const [{ data: profile }, { data: stats }, { count }] = await Promise.all([
		supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
		supabase
			.from("user_stats")
			.select("time_played_seconds, notes_played, connexions")
			.eq("user_id", userId)
			.maybeSingle(),
		supabase
			.from("friendships")
			.select("id", { count: "exact", head: true }) // count-only — no rows returned
			.eq("status", "accepted")
			.or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
	]);

	// If both the profile row and the stats row are missing, treat as not-found.
	if (!profile && !stats) return null;

	return {
		userId,
		username: profile?.username ?? "Unknown",
		timePlayedSeconds: stats?.time_played_seconds ?? 0,
		notesPlayed: stats?.notes_played ?? 0,
		connexions: stats?.connexions ?? 0,
		friendCount: count ?? 0,
	};
}

// `skipAuthSync` skips the auth.updateUser call when set. That call refreshes
// the access token, which causes any active Supabase realtime channel to
// disconnect and rejoin — fine on a normal page, but inside a jam room it
// makes the local user briefly leave the channel and breaks peer presence
// state on reconnect. Callers inside live channels should pass true; the
// profiles row is the source of truth either way, user_metadata is only ever
// read as a fallback when the profile fetch fails.
export async function updateMyUsername(username: string, skipAuthSync = false): Promise<boolean> {
	const supabase = createClient();
	const { data: userData } = await supabase.auth.getUser();
	if (!userData.user) return false;

	const trimmed = username.trim();
	if (!trimmed) return false; // reject empty / whitespace-only

	// Source of truth — update profiles first.
	const { error: profileError } = await supabase
		.from("profiles")
		.update({ username: trimmed, updated_at: new Date().toISOString() })
		.eq("id", userData.user.id);

	if (profileError) return false;

	// Optional auth metadata sync — see comment above for why callers in a
	// jam-room context want to skip this.
	if (!skipAuthSync) {
		await supabase.auth.updateUser({ data: { username: trimmed } });
	}
	return true;
}
