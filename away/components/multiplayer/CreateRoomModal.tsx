import { AccessIcon } from "@/components/AccessIcon";
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
		<div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
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
								<div className="flex flex-col items-center justify-center px-5 py-4 bg-white/5 border-r border-white/10 shrink-0 gap-1">
									<AccessIcon type={accessibility} glass={false} />
									<span className="text-[10px] text-white/40 uppercase tracking-widest">Accessibility</span>
								</div>
								<div className="flex flex-1">
									{(["public", "private", "friends"] as const).map((type) => (
										<button
											key={type}
											onClick={() => setAccessibility(type)}
											className={`flex-1 py-4 text-sm font-medium capitalize transition-all ${
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
									<div className="flex flex-col items-center justify-center px-5 py-4 bg-white/5 border-r border-white/10 shrink-0 gap-1">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
											<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
										</svg>
										<span className="text-[10px] text-white/40 uppercase tracking-widest">Password</span>
									</div>
									<input
										type="text"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="Enter password..."
										className="flex-1 bg-transparent px-5 py-4 text-white/80 text-sm placeholder:text-white/20 outline-none font-mono uppercase tracking-widest"
									/>
								</div>
							)}

							<div className="flex rounded-xl overflow-hidden border border-white/10 mb-10">
								<div className="flex flex-col items-center justify-center px-5 py-4 bg-white/5 border-r border-white/10 shrink-0 gap-1">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
										<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
									</svg>
									<span className="text-[10px] text-white/40 uppercase tracking-widest">Room size</span>
								</div>
								<div className="flex flex-1">
									{[2, 3, 4].map((size) => (
										<button
											key={size}
											onClick={() => setMaxPlayers(size)}
											className={`flex-1 py-4 text-sm font-medium transition-all ${
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
