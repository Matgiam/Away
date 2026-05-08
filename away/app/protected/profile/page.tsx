import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SilkBackground } from "@/components/effects/SilkBackground";
import BackButton from "@/components/multiplayer/BackButton";
import { DisconnectButton } from "./DisconnectButton";
import { FriendsPanel } from "./FriendsPanel";

const TOTAL_ACHIEVEMENTS = 20;
const UNLOCKED_ACHIEVEMENTS = [0, 5];

const STATS = {
	timePlayed: "70h20m50s",
	notesPlayed: 153427,
	connexions: 150,
};

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

function MouseAchievement() {
	return (
		<svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="white" strokeWidth="1.5">
			<rect x="6" y="3" width="12" height="18" rx="6" fill="#1a0d2e" stroke="white" />
			<line x1="12" y1="3" x2="12" y2="11" stroke="white" />
		</svg>
	);
}

function PianoAchievement() {
	return (
		<svg viewBox="0 0 32 24" className="w-8 h-7" fill="none">
			<rect x="1" y="2" width="30" height="20" rx="2" fill="#3aa6e6" />
			<rect x="4" y="9" width="3" height="10" fill="white" />
			<rect x="8" y="9" width="3" height="10" fill="white" />
			<rect x="12" y="9" width="3" height="10" fill="white" />
			<rect x="16" y="9" width="3" height="10" fill="white" />
			<rect x="20" y="9" width="3" height="10" fill="white" />
			<rect x="24" y="9" width="3" height="10" fill="white" />
			<rect x="6" y="9" width="2" height="6" fill="black" />
			<rect x="10" y="9" width="2" height="6" fill="black" />
			<rect x="18" y="9" width="2" height="6" fill="black" />
			<rect x="22" y="9" width="2" height="6" fill="black" />
		</svg>
	);
}

const ACHIEVEMENT_ICONS: Record<number, React.ReactNode> = {
	0: <MouseAchievement />,
	5: <PianoAchievement />,
};

export default async function ProfilePage() {
	const supabase = await createClient();
	const { data } = await supabase.auth.getUser();

	if (!data.user) {
		redirect("/auth/login");
	}

	const user = data.user;

	const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

	const username =
		profile?.username ||
		(user.user_metadata?.username as string | undefined) ||
		(user.email ? user.email.split("@")[0] : "Player");
	const displayName = username.charAt(0).toUpperCase() + username.slice(1);
	const provider = (user.app_metadata?.provider as string | undefined) || "email";

	return (
		<div className="h-screen w-full bg-[#050505] text-gray-200 overflow-hidden relative">
			<SilkBackground color="#0b0416" scale={0.8} noiseIntensity={1.3} speed={3} rotation={180} />
			<BackButton />

			<div className="relative z-10 h-full pt-14 pb-6 px-8 flex flex-col max-w-[1500px] mx-auto min-w-0">
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
								<p className="text-white text-xs truncate" title={user.email}>{user.email}</p>
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

					<section className="col-span-3 row-span-1 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex flex-col min-w-0">
						<FriendsPanel userId={user.id} />
					</section>

					<section className="col-span-6 row-span-2 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 flex flex-col min-w-0">
						<h2 className="text-white font-semibold text-lg mb-4 shrink-0">Achievements</h2>

						<div className="grid grid-cols-5 grid-rows-4 gap-2.5 flex-1 min-h-0">
							{Array.from({ length: TOTAL_ACHIEVEMENTS }).map((_, i) => {
								const unlocked = UNLOCKED_ACHIEVEMENTS.includes(i);
								return (
									<div
										key={i}
										className={`rounded-xl border flex items-center justify-center min-h-0 ${
											unlocked ? "bg-white/5 border-white/15" : "bg-white/[0.02] border-white/5"
										}`}
									>
										{unlocked && ACHIEVEMENT_ICONS[i]}
									</div>
								);
							})}
						</div>
					</section>

					<section className="col-span-6 row-span-1 rounded-2xl border border-white/8 bg-[#0a0118]/70 backdrop-blur-xl p-5 min-w-0">
						<h2 className="text-white font-semibold text-lg mb-3">Statistics</h2>

						<dl className="space-y-2">
							<div className="flex items-center justify-between">
								<dt className="text-white/70 text-sm">Time played</dt>
								<dd className="text-white font-semibold">{STATS.timePlayed}</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-white/70 text-sm">Notes played</dt>
								<dd className="text-white font-semibold">{STATS.notesPlayed.toLocaleString("en-US").replace(/,/g, "")}</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-white/70 text-sm">Connexions</dt>
								<dd className="text-white font-semibold">{STATS.connexions}</dd>
							</div>
						</dl>
					</section>
				</div>
			</div>
		</div>
	);
}
