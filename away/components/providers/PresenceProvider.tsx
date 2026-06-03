// ============================================================================
// PresenceProvider.tsx
// ----------------------------------------------------------------------------
// Global "who's online right now" provider. Subscribes once at the layout
// level to a Supabase Realtime presence channel and exposes the current set
// of online user ids through `useOnlineUsers()`.
//
// Used by the profile / friends UIs to render the green online dot next to
// usernames. Channel re-subscribes automatically when auth state changes,
// so signing in / out doesn't require a page reload to update presence.
// ============================================================================

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const ONLINE_CHANNEL = "online-users";

const PresenceContext = createContext<Set<string>>(new Set());

export function PresenceProvider({ children }: { children: ReactNode }) {
	const [online, setOnline] = useState<Set<string>>(new Set());

	useEffect(() => {
		const supabase = createClient();
		let cancelled = false;
		let channel: ReturnType<typeof supabase.channel> | null = null;
		let trackedUserId: string | null = null;

		const teardown = () => {
			if (channel) {
				try {
					channel.untrack();
				} catch {}
				supabase.removeChannel(channel);
				channel = null;
			}
		};

		const setup = (userId: string | null) => {
			if (userId === trackedUserId && channel) return;
			teardown();
			trackedUserId = userId;
			if (!userId) {
				setOnline(new Set());
				return;
			}

			const c = supabase.channel(ONLINE_CHANNEL, {
				config: { presence: { key: userId } },
			});

			c.on("presence", { event: "sync" }, () => {
				setOnline(new Set(Object.keys(c.presenceState())));
			});

			c.subscribe(async (status) => {
				if (cancelled || c !== channel) return;
				if (status === "SUBSCRIBED") {
					try {
						await c.track({ at: Date.now() });
					} catch {}
				}
			});

			channel = c;
		};

		(async () => {
			const { data } = await supabase.auth.getUser();
			if (cancelled) return;
			setup(data.user?.id ?? null);
		})();

		const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
			if (cancelled) return;
			setup(session?.user?.id ?? null);
		});

		return () => {
			cancelled = true;
			authListener.subscription.unsubscribe();
			teardown();
		};
	}, []);

	return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}

export function useOnlineUsers(): Set<string> {
	return useContext(PresenceContext);
}
