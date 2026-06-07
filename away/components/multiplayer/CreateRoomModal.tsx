// ============================================================================
// multiplayer/CreateRoomModal.tsx
// ----------------------------------------------------------------------------
// Two-step "Create room" modal. Step "settings" picks accessibility / max
// players / optional password; step "name" lets the user title the room
// and submit. Form state lives in `useCreateRoom`; this component is the
// presentation layer.
// ============================================================================

import { AccessIcon } from "@/components/ui/AccessIcon";
import type { Accessibility, CreateStep } from "@/hooks/useRooms";

interface CreateRoomModalProps {
	showCreate: boolean;
	setShowCreate: (show: boolean) => void;
	createStep: CreateStep;
	setCreateStep: (step: CreateStep) => void;
	accessibility: Accessibility;
	setAccessibility: (access: Accessibility) => void;
	password: string;
	setPassword: (pwd: string) => void;
	maxPlayers: number;
	setMaxPlayers: (max: number) => void;
	roomName: string;
	setRoomName: (name: string) => void;
	handleCreateRoom: () => void;
	resetCreate: () => void;
}

export default function CreateRoomModal({
	showCreate,
	setShowCreate,
	createStep,
	setCreateStep,
	accessibility,
	setAccessibility,
	password,
	setPassword,
	maxPlayers,
	setMaxPlayers,
	roomName,
	setRoomName,
	handleCreateRoom,
	resetCreate,
}: CreateRoomModalProps) {
	if (!showCreate) return null;

	return (
		<div className="absolute stage-full-bleed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
			<div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0d0620]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
				<button
					onClick={createStep === "name" ? () => setCreateStep("settings") : resetCreate}
					className="absolute top-5 left-5 w-15 h-15 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
				>
					<img src="icons/arrow.svg" alt="" />
				</button>

				<div className="px-10 py-12">
					{createStep === "settings" ? (
						<>
							<h2 className="text-center text-2xl font-semibold italic text-white/90 mb-10">Create your room</h2>

							<div className="flex rounded-xl overflow-hidden border border-white/10 mb-4">
								<div className="flex flex-col items-center justify-center px-3 py-5 bg-white/5 border-r border-white/10 gap-1">
									<AccessIcon type={accessibility} glass={false} text={false} />
									<span className="text-[10px] text-white/40 uppercase tracking-widest">Accessibility</span>
								</div>
								<div className="flex flex-1">
									{(["public", "private", "friends"] as const).map((type) => (
										<button
											key={type}
											onClick={() => setAccessibility(type)}
											className={`flex-1 py-4 font-medium capitalize transition-all ${
												accessibility === type ? "text-white bg-white/10" : "text-white/35 hover:text-white/60 hover:bg-white/5"
											}`}
										>
											{type}
										</button>
									))}
								</div>
							</div>

							{accessibility === "private" && (
								<div className="flex rounded-xl overflow-hidden border border-white/10 mb-4">
									<div className="flex flex-col items-center justify-center px-5 py-4 bg-white/5 border-r border-white/10 gap-1">
										<img src="/icons/password.svg" alt="" />
										<span className="text-[10px] text-white/40 uppercase tracking-widest">Password</span>
									</div>
									<input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="Enter password..."
										className="flex-1 bg-transparent px-5 py-4 text-white/80 text-sm placeholder:text-white/20 outline-none   tracking-widest"
									/>
								</div>
							)}

							<div className="flex rounded-xl overflow-hidden border border-white/10 mb-10">
								<div className="flex flex-col items-center justify-center px-5 py-4 bg-white/5 border-r border-white/10 shrink-0 gap-1">
									<img src="/icons/Person.svg" alt="" />
									<span className="text-[10px] text-white/40 uppercase tracking-widest">Room size</span>
								</div>
								<div className="flex flex-1">
									{[2, 3, 4].map((size) => (
										<button
											key={size}
											onClick={() => setMaxPlayers(size)}
											className={`flex-1 py-4 text-m font-medium transition-all ${
												maxPlayers === size ? "text-white bg-white/10" : "text-white/35 hover:text-white/60 hover:bg-white/5"
											}`}
										>
											{size}
										</button>
									))}
								</div>
							</div>

							<div className="flex justify-center">
								<button
									onClick={() => setCreateStep("name")}
									className="px-14 py-3 rounded-lg border border-white/20 bg-white/8 text-white text-sm font-medium hover:bg-white/14 transition-all"
								>
									Next
								</button>
							</div>
						</>
					) : (
						<>
							<h2 className="text-center text-2xl font-semibold italic text-white/90 mb-10">Room name</h2>

							<input
								type="text"
								value={roomName}
								onChange={(e) => setRoomName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
								placeholder=""
								autoFocus
								className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-sm outline-none focus:border-white/25 transition-colors mb-10"
							/>

							<div className="flex justify-center">
								<button
									onClick={handleCreateRoom}
									disabled={!roomName.trim()}
									className="px-14 py-3 rounded-lg border border-white/20 bg-white/8 text-white text-sm font-medium hover:bg-white/14 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
								>
									Create
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
