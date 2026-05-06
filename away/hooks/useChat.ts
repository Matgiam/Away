import { useState, useCallback, useRef } from "react";

export type ChatMessage = {
	id: string;
	senderId: string;
	senderName: string;
	text: string;
	timestamp: number;
};

export function useChat(myId: string) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const addMessage = useCallback((msg: ChatMessage) => {
		setMessages((prev) => [...prev, msg]);
	}, []);

	return {
		messages,
		isChatOpen,
		setIsChatOpen,

		addMessage,
	};
}
