"use client";

export function ChatPanel() {
	return (
		<div className="flex flex-col h-full border-l border-white/8 bg-[#0a0118]/80 backdrop-blur-xl relative z-6000">
			<div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
				<h2 className="text-white/60 text-xs uppercase tracking-widest font-medium">Live Chat</h2>

				<button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
				<div className="flex flex-col gap-1 items-end">
					<h3 className="text-[10px] text-white/30 font-mono px-1">You</h3>
					<div className="px-3 py-2 rounded-xl text-sm max-w-[220px] bg-white/10 text-white rounded-tr-none">Hellooo</div>
				</div>

				<div className="flex flex-col gap-1 items-start">
					<h3 className="text-[10px] text-white/30 font-mono px-1">User123</h3>
					<div className="px-3 py-2 rounded-xl text-sm max-w-[220px] bg-white/5 text-white/80 rounded-tl-none border border-white/8">Hey</div>
				</div>
			</div>

			<div className="px-4 py-4 border-t border-white/8">
				<div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/8 px-3 py-2 focus-within:border-white/20 transition-colors">
					<input
						type="text"
						placeholder="Type your message"
						className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none"
					/>
					<button className="text-white/30 hover:text-white transition-colors">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
							<path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	);
};
