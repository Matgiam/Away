import { useRef, useState, useCallback, useEffect } from "react";

export function useWebRTC(onReceiveNote: (note: number, velocity: number, isNoteOn: boolean) => void) {
	const [isConnected, setIsConnected] = useState(false);
	const peerConnection = useRef<RTCPeerConnection | null>(null);
	const dataChannel = useRef<RTCDataChannel | null>(null);
	const onReceiveNoteRef = useRef(onReceiveNote);

	useEffect(() => {
		onReceiveNoteRef.current = onReceiveNote;
	}, [onReceiveNote]);

	const iceQueue = useRef<RTCIceCandidateInit[]>([]);

	const setupDataChannel = useCallback((dc: RTCDataChannel) => {
		dataChannel.current = dc;
		dc.onopen = () => setIsConnected(true);
		dc.onclose = () => setIsConnected(false);

		dc.onmessage = (event) => {
			const data = JSON.parse(event.data);
			if (data.type === "midi") onReceiveNoteRef.current(data.note, data.velocity, data.isNoteOn);
		};
	}, []);

	const createOffer = useCallback(
		async (sendSignal: (payload: any) => void) => {
			const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
			peerConnection.current = pc;

			pc.onicecandidate = (e) => e.candidate && sendSignal({ type: "candidate", candidate: e.candidate });

			const dc = pc.createDataChannel("piano-notes");
			setupDataChannel(dc);

			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			sendSignal({ type: "offer", offer });
		},
		[setupDataChannel],
	);

	const acceptOffer = useCallback(
		async (offer: any, sendSignal: (payload: any) => void) => {
			const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
			peerConnection.current = pc;

			pc.onicecandidate = (e) => e.candidate && sendSignal({ type: "candidate", candidate: e.candidate });
			pc.ondatachannel = (e) => setupDataChannel(e.channel);

			await pc.setRemoteDescription(new RTCSessionDescription(offer));

			iceQueue.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
			iceQueue.current = [];

			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			sendSignal({ type: "answer", answer });
		},
		[setupDataChannel],
	);

	const acceptAnswer = useCallback(async (answer: any) => {
		const pc = peerConnection.current;
		if (pc && pc.signalingState === "have-local-offer") {
			await pc.setRemoteDescription(new RTCSessionDescription(answer));

			iceQueue.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)));
			iceQueue.current = [];
		}
	}, []);

	const addIceCandidate = useCallback(async (candidate: any) => {
		const pc = peerConnection.current;
		if (pc && pc.remoteDescription) {
			await pc.addIceCandidate(new RTCIceCandidate(candidate));
		} else {
			iceQueue.current.push(candidate);
		}
	}, []);

	const sendNoteToPeer = useCallback((note: number, velocity: number, isNoteOn: boolean) => {
		if (dataChannel.current?.readyState === "open") {
			dataChannel.current.send(JSON.stringify({ type: "midi", note, velocity, isNoteOn }));
		}
	}, []);

	useEffect(() => {
		return () => {
			if (dataChannel.current) {
				dataChannel.current.close();
			}
			if (peerConnection.current) {
				peerConnection.current.close();
				peerConnection.current = null;
			}
		};
	}, []);

	return { createOffer, acceptOffer, acceptAnswer, addIceCandidate, sendNoteToPeer, isConnected };
}
