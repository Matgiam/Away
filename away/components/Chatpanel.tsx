"use client";

import { useState, useRef, useEffect } from "react";

interface ChatPanelProps {
  messages?: { id: string; senderId: string; senderName: string; text: string }[];
  myId?: string;
  onSend?: (text: string) => void;
  onClose?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages = [], myId = "", onSend, onClose }) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !onSend) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full border-l border-white/8 bg-[#0a0118]/80 backdrop-blur-xl" style={{ width: "300px" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <span className="text-white/60 text-xs uppercase tracking-widest">Live Chat</span>
        {onClose && (
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && <p className="text-white/20 text-xs text-center">No messages yet</p>}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.senderId === myId ? "items-end" : "items-start"}`}>
            <span className="text-[10px] text-white/30">{msg.senderId === myId ? "You" : msg.senderName}</span>
            <div className={`px-3 py-2 rounded-xl text-sm max-w-[220px] ${msg.senderId === myId ? "bg-white/10" : "bg-white/5"}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-4 border-t border-white/8">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type message..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none"
          />
          <button onClick={handleSend} className="text-white/30 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
