import { useRef, useState, useCallback, useEffect } from "react";

type SignalPayload = {
	type: "offer" | "answer" | "candidate";
	targetId: string;
	offer?: RTCSessionDescriptionInit;
	answer?: RTCSessionDescriptionInit;
	candidate?: RTCIceCandidateInit;
};

type PeerInfo = {
	pc: RTCPeerConnection;
	dc: RTCDataChannel | null;
	iceQueue: RTCIceCandidateInit[];
	makingOffer: boolean;
	polite: boolean;
};

export type ReceivedNoteHandler = (peerId: string, note: number, velocity: number, isNoteOn: boolean) => void;

const ICE_CONFIG: RTCConfiguration = {
	iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(myId: string, onReceiveNote: ReceivedNoteHandler) {
	const peersRef = useRef<Map<string, PeerInfo>>(new Map());
	const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());

	const onReceiveNoteRef = useRef(onReceiveNote);
	useEffect(() => {
		onReceiveNoteRef.current = onReceiveNote;
	}, [onReceiveNote]);

	const markConnected = useCallback((peerId: string, connected: boolean) => {
		setConnectedPeers((prev) => {
			const next = new Set(prev);
			if (connected) next.add(peerId);
			else next.delete(peerId);
			return next;
		});
	}, []);

	const setupDataChannel = useCallback(
		(peerId: string, dc: RTCDataChannel) => {
			const peer = peersRef.current.get(peerId);
			if (peer) peer.dc = dc;

			dc.onopen = () => markConnected(peerId, true);
			dc.onclose = () => markConnected(peerId, false);
			dc.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === "midi") {
						onReceiveNoteRef.current(peerId, data.note, data.velocity, data.isNoteOn);
					}
				} catch {}
			};
		},
		[markConnected],
	);

	const removePeer = useCallback(
		(peerId: string) => {
			const peer = peersRef.current.get(peerId);
			if (!peer) return;
			try {
				peer.dc?.close();
			} catch {}
			try {
				peer.pc.close();
			} catch {}
			peersRef.current.delete(peerId);
			markConnected(peerId, false);
		},
		[markConnected],
	);

	const createPeerConnection = useCallback(
		(peerId: string, sendSignal: (s: SignalPayload) => void): PeerInfo => {
			const pc = new RTCPeerConnection(ICE_CONFIG);
			// "polite" peer is the higher id — backs off on collision (perfect negotiation lite)
			const polite = myId < peerId ? false : true;
			const info: PeerInfo = { pc, dc: null, iceQueue: [], makingOffer: false, polite };
			peersRef.current.set(peerId, info);

			pc.onicecandidate = (e) => {
				if (e.candidate) {
					sendSignal({ type: "candidate", targetId: peerId, candidate: e.candidate.toJSON() });
				}
			};
			pc.ondatachannel = (e) => setupDataChannel(peerId, e.channel);
			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
					markConnected(peerId, false);
				}
			};

			return info;
		},
		[myId, markConnected, setupDataChannel],
	);

	const initiateConnection = useCallback(
		async (peerId: string, sendSignal: (s: SignalPayload) => void) => {
			if (peersRef.current.has(peerId)) return;
			const info = createPeerConnection(peerId, sendSignal);
			const dc = info.pc.createDataChannel("piano-notes");
			setupDataChannel(peerId, dc);

			try {
				info.makingOffer = true;
				const offer = await info.pc.createOffer();
				await info.pc.setLocalDescription(offer);
				sendSignal({ type: "offer", targetId: peerId, offer });
			} catch (err) {
				console.error("createOffer failed", err);
			} finally {
				info.makingOffer = false;
			}
		},
		[createPeerConnection, setupDataChannel],
	);

	const handleOffer = useCallback(
		async (peerId: string, offer: RTCSessionDescriptionInit, sendSignal: (s: SignalPayload) => void) => {
			let info = peersRef.current.get(peerId);
			if (!info) {
				info = createPeerConnection(peerId, sendSignal);
			}

			const offerCollision = info.makingOffer || info.pc.signalingState !== "stable";
			if (offerCollision && !info.polite) {
				// impolite peer ignores the incoming offer
				return;
			}

			try {
				await info.pc.setRemoteDescription(new RTCSessionDescription(offer));
				info.iceQueue.forEach((c) => info!.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
				info.iceQueue = [];

				const answer = await info.pc.createAnswer();
				await info.pc.setLocalDescription(answer);
				sendSignal({ type: "answer", targetId: peerId, answer });
			} catch (err) {
				console.error("handleOffer failed", err);
			}
		},
		[createPeerConnection],
	);

	const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
		const info = peersRef.current.get(peerId);
		if (!info) return;
		if (info.pc.signalingState === "have-local-offer") {
			try {
				await info.pc.setRemoteDescription(new RTCSessionDescription(answer));
				info.iceQueue.forEach((c) => info.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
				info.iceQueue = [];
			} catch (err) {
				console.error("handleAnswer failed", err);
			}
		}
	}, []);

	const handleCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
		const info = peersRef.current.get(peerId);
		if (!info) return;
		if (info.pc.remoteDescription) {
			try {
				await info.pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch {}
		} else {
			info.iceQueue.push(candidate);
		}
	}, []);

	const broadcastNote = useCallback((note: number, velocity: number, isNoteOn: boolean) => {
		const msg = JSON.stringify({ type: "midi", note, velocity, isNoteOn });
		peersRef.current.forEach((peer) => {
			if (peer.dc?.readyState === "open") {
				try {
					peer.dc.send(msg);
				} catch {}
			}
		});
	}, []);

	const hasPeer = useCallback((peerId: string) => peersRef.current.has(peerId), []);

	const knownPeerIds = useCallback(() => Array.from(peersRef.current.keys()), []);

	useEffect(() => {
		return () => {
			peersRef.current.forEach((peer) => {
				try {
					peer.dc?.close();
				} catch {}
				try {
					peer.pc.close();
				} catch {}
			});
			peersRef.current.clear();
		};
	}, []);

	return {
		initiateConnection,
		handleOffer,
		handleAnswer,
		handleCandidate,
		removePeer,
		broadcastNote,
		hasPeer,
		knownPeerIds,
		connectedPeers,
	};
}
