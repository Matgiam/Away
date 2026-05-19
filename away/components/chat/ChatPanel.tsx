"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/hooks/useChat";

interface ChatPanelProps {
	messages: ChatMessage[];
	myId: string;
	myName: string;
	isLoggedIn: boolean;
	onSend: (text: string) => void;
	onClose: () => void;
	onLoginClick: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, myId, myName, isLoggedIn, onSend, onClose, onLoginClick }) => {
	const [input, setInput] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = () => {
		const trimmed = input.trim();
		if (!trimmed) return;
		onSend(trimmed);
		setInput("");
	};

	return (
		<div
			className="flex flex-col rounded-2xl border border-white/10 bg-[#0a0118]/90 backdrop-blur-xl shadow-2xl overflow-hidden"
			style={{ width: "13vw", height: "100%" }}
		>
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
				<span className="text-white/60 text-xs uppercase tracking-widest font-medium">Live Chat</span>
				<button
					onClick={onClose}
					className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
				{messages.length === 0 && <p className="text-white/20 text-xs text-center mt-8">No messages yet. Say something!</p>}
				{messages.map((msg) => {
					const isMe = msg.senderId === myId;
					return (
						<div key={msg.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
							<span className="text-[10px] text-white/30 font-mono px-1">{isMe ? myName || "You" : msg.senderName}</span>
							<div
								className={`px-3 py-2 rounded-xl text-sm max-w-[220px] break-words leading-relaxed ${
									isMe ? "bg-white/10 text-white rounded-tr-none" : "bg-white/5 text-white/80 rounded-tl-none border border-white/8"
								}`}
							>
								{msg.text}
							</div>
						</div>
					);
				})}
				<div ref={bottomRef} />
			</div>

			<div className="px-4 py-3 border-t border-white/8">
				{isLoggedIn ? (
					<div className="flex items-center gap-2 bg-white/5 rounded-xl border border-white/8 px-3 py-2 focus-within:border-white/20 transition-colors">
						<input
							type="text"
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSend()}
							placeholder="Type message here"
							className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none"
						/>
						<button onClick={handleSend} disabled={!input.trim()} className="text-white/30 hover:text-white transition-colors disabled:opacity-20 flex-shrink-0 flex items-center justify-center">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
								<path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
							</svg>
						</button>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center gap-3 py-2">
						<p className="text-white/40 text-xs">You need to be logged in to chat</p>
						<button
							onClick={onLoginClick}
							className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 transition-colors"
						>
							Log in to send messages
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
