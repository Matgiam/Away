# can you help me ? and also use flex instead of grid please import { createClient } from "@/lib/supabase/server";

*Started: 2026-05-10 12:44 UTC*

## User

Hey so i want my page to look exactly like this: i have coded a bit but it nowhere close to this layout. can you help me ? and also use flex instead of grid please import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";
import { DisconnectButton } from "./DisconnectButton";
import { FriendsPanel } from "./FriendsPanel";
import { TrackVisit } from "./TrackVisit";
function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s`;
}

function GoogleLogo() {
	return (
		<svg className="h-7 w-7" viewBox="0 0 24 24">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

function MailIcon() {
	return (
		<svg className="h-7 w-7 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
			<rect x="2" y="4" width="20" height="16" rx="3" />
			<path d="M3 6l9 7 9-7" />
		</svg>
	);
}

export default async function ProfilePage() {
	const supabase = await createClient();
	const { data } = await supabase.auth.getUser();

	if (!data.user) {
		redirect("/auth/login");
	}

	const user = data.user;

	const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

	const { data: stats } = await supabase
		.from("user_stats")
		.select("time_played_seconds, notes_played, connexions")
		.eq("user_id", user.id)
		.maybeSingle();

	const username = profile?.username || (user.user_metadata?.username as string | undefined) || (user.email ? user.email.split("@")[0] : "Player");
	const displayName = username.charAt(0).toUpperCase() + username.slice(1);
	const provider = (user.app_metadata?.provider as string | undefined) || "email";

	return (
		<div className="h-screen w-full bg-[#050505] text-gray-200 overflow-hidden relative">
			<TrackVisit userId={user.id} />
			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />
			<BackButton />

			<div className="relative z-10 h-full pt-8 pb-15 px-10 flex flex-col max-w-[1800px] mx-auto min-w-0">
				<h1 className="text-5xl italic font-light text-white mb-5 tracking-wide shrink-0">{displayName}</h1>

				<div className="flex-1 min-h-0 grid grid-cols-12 grid-rows-[1fr_auto] gap-4">
					<section className="col-span-3 row-span-1 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex flex-col min-w-0">
						<h2 className="text-white font-semibold text-lg mb-4 shrink-0">Personal information</h2>

						<div className="space-y-3 min-w-0 overflow-hidden">
							<div>
								<p className="text-white/60 text-sm mb-0.5">Username</p>
								<p className="text-white font-semibold truncate">{displayName}</p>
							</div>

							<div>
								<p className="text-white/60 text-sm mb-0.5">Email</p>
								<p className="text-white text-xs truncate" title={user.email}>
									{user.email}
								</p>
							</div>

							<div>
								<p className="text-white/60 text-sm mb-1.5">Linked to</p>
								{provider === "google" ? <GoogleLogo /> : <MailIcon />}
							</div>
						</div>

						<div className="mt-auto pt-3 flex justify-end shrink-0">
							<DisconnectButton />
						</div>
					</section>

					<section className="col-span-2 row-span-1 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex flex-col min-w-0">
						<FriendsPanel userId={user.id} />
					</section>

					<section className="col-span-5 row-span-1 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex flex-col min-w-0 ml-50">
						<h2 className="text-white font-semibold text-lg mb-4 shrink-0">Achievements</h2>

				
					</section>

					<section className="col-span-6 row-span-1 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 min-w-0">
						<h2 className="text-white font-semibold text-lg mb-3">Statistics</h2>

						<dl className="space-y-2">
							<div className="flex items-center justify-between">
								<dt className="text-white/70 text-sm">Time played</dt>
								<dd className="text-white font-semibold">{formatTime(stats?.time_played_seconds ?? 0)}</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-white/70 text-sm">Notes played</dt>
								<dd className="text-white font-semibold">{(stats?.notes_played ?? 0).toLocaleString("en-US").replace(/,/g, "")}</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-white/70 text-sm">Connexions</dt>
								<dd className="text-white font-semibold">{stats?.connexions ?? 0}</dd>
							</div>
						</dl>
					</section>
				</div>
			</div>
		</div>
	);
}

## Claude

Here's a flex-based refactor that matches the screenshot — left column has Personal Info + Friends side-by-side with Statistics below, and the right column is Achievements (5×4 grid via `flex-wrap`). Just paste this over your file:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";
import { DisconnectButton } from "./DisconnectButton";
import { FriendsPanel } from "./FriendsPanel";
import { TrackVisit } from "./TrackVisit";

function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	return `${h}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s`;
}

function GoogleLogo() {
	return (
		<svg className="h-7 w-7" viewBox="0 0 24 24">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
		</svg>
	);
}

function MailIcon() {
	return (
		<svg className="h-7 w-7 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
			<rect x="2" y="4" width="20" height="16" rx="3" />
			<path d="M3 6l9 7 9-7" />
		</svg>
	);
}

export default async function ProfilePage() {
	const supabase = await createClient();
	const { data } = await supabase.auth.getUser();

	if (!data.user) {
		redirect("/auth/login");
	}

	const user = data.user;

	const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

	const { data: stats } = await supabase
		.from("user_stats")
		.select("time_played_seconds, notes_played, connexions")
		.eq("user_id", user.id)
		.maybeSingle();

	const username = profile?.username || (user.user_metadata?.username as string | undefined) || (user.email ? user.email.split("@")[0] : "Player");
	const displayName = username.charAt(0).toUpperCase() + username.slice(1);
	const provider = (user.app_metadata?.provider as string | undefined) || "email";

	return (
		<div className="h-screen w-full bg-[#050505] text-gray-200 overflow-hidden relative">
			<TrackVisit userId={user.id} />
			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />
			<BackButton />

			<div className="relative z-10 h-full pt-8 pb-15 px-10 flex flex-col max-w-[1800px] mx-auto min-w-0">
				<h1 className="text-5xl italic font-light text-white mb-6 tracking-wide shrink-0">{displayName}</h1>

				{/* Main two-column layout */}
				<div className="flex-1 min-h-0 flex gap-12 min-w-0">
					{/* LEFT COLUMN — Info + Friends + Stats */}
					<div className="flex flex-col gap-4 min-w-0 self-start" style={{ flex: "1 1 0" }}>
						{/* Top row: Personal Info + Friends */}
						<div className="flex gap-4 min-w-0">
							{/* Personal Information */}
							<section
								className="flex flex-col rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 min-w-0"
								style={{ flex: "3 1 0" }}
							>
								<h2 className="text-white font-semibold text-lg mb-4 shrink-0">Personal information</h2>

								<div className="flex flex-col gap-3 min-w-0 overflow-hidden">
									<div>
										<p className="text-white/60 text-sm mb-0.5">Username</p>
										<p className="text-white font-semibold truncate">{displayName}</p>
									</div>

									<div>
										<p className="text-white/60 text-sm mb-0.5">Email</p>
										<p className="text-white text-xs truncate" title={user.email}>
											{user.email}
										</p>
									</div>

									<div>
										<p className="text-white/60 text-sm mb-1.5">Linked to</p>
										{provider === "google" ? <GoogleLogo /> : <MailIcon />}
									</div>
								</div>

								<div className="mt-auto pt-3 flex justify-end shrink-0">
									<DisconnectButton />
								</div>
							</section>

							{/* Friends */}
							<section
								className="flex flex-col rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 min-w-0"
								style={{ flex: "2 1 0" }}
							>
								<FriendsPanel userId={user.id} />
							</section>
						</div>

						{/* Statistics */}
						<section className="rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5">
							<h2 className="text-white font-semibold text-lg mb-3">Statistics</h2>

							<dl className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<dt className="text-white/70 text-sm">Time played</dt>
									<dd className="text-white font-semibold">{formatTime(stats?.time_played_seconds ?? 0)}</dd>
								</div>
								<div className="flex items-center justify-between">
									<dt className="text-white/70 text-sm">Notes played</dt>
									<dd className="text-white font-semibold">{(stats?.notes_played ?? 0).toLocaleString("en-US").replace(/,/g, "")}</dd>
								</div>
								<div className="flex items-center justify-between">
									<dt className="text-white/70 text-sm">Connexions</dt>
									<dd className="text-white font-semibold">{stats?.connexions ?? 0}</dd>
								</div>
							</dl>
						</section>
					</div>

					{/* RIGHT COLUMN — Achievements */}
					<section
						className="flex flex-col rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 min-w-0 self-start"
						style={{ flex: "1 1 0" }}
					>
						<h2 className="text-white font-semibold text-lg mb-4 shrink-0">Achievements</h2>

						{/* 5 × 4 grid via flex-wrap */}
						<div className="flex flex-wrap gap-3">
							{Array.from({ length: 20 }).map((_, i) => (
								<div
									key={i}
									className="aspect-square rounded-2xl border border-white/8 bg-white/[0.02]"
									style={{ flex: "0 0 calc((100% - 4 * 0.75rem) / 5)" }}
								/>
							))}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
```

Key changes:

- **Outer layout** is `flex gap-12` (two columns) instead of `grid-cols-12`.
- **Left column** uses `flex flex-col` — top is a `flex` row with Personal Info (`flex: 3`) and Friends (`flex: 2`), Statistics sits below.
- **Right column** is a single Achievements panel sized via `flex: 1 1 0` and `self-start` so it doesn't stretch past its content.
- **Achievements grid** uses `flex flex-wrap` with `flex: 0 0 calc((100% - 4 * 0.75rem) / 5)` per square — 5 per row, exactly mirroring the screenshot's 5×4. Adjust `length: 20` later to drive it from real achievement data.
- Removed the `ml-50` hack and the conflicting `col-span-*` math.

Want me to also wire up an icon slot on each square so you can drop in unlocked achievements like the mouse/piano ones in the screenshot?
