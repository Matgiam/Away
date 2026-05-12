export default function MultiplayerLoading() {
	return (
		<div className="h-screen w-screen bg-[#050505] text-gray-200 overflow-hidden flex items-center justify-center">
			<div className="flex flex-col items-center gap-6">
				<div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
				<p className="text-white/60 text-lg italic tracking-wide">Loading rooms…</p>
			</div>
		</div>
	);
}
