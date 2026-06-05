// ============================================================================
// useWebRTC.ts
// ----------------------------------------------------------------------------
// Peer-to-peer WebRTC layer for the multiplayer jam. Owns one RTCPeerConnection
// per remote peer + a "piano-notes" RTCDataChannel that carries both note-on /
// note-off events and sustain-pedal events.
//
// Why peer-to-peer instead of Supabase Realtime: notes happen *fast* and need
// low latency. Pushing every note through Supabase would queue them behind
// chat / presence traffic and add a server hop. With a direct DataChannel,
// median note latency is ~30-60 ms versus ~150-250 ms through Realtime.
//
// The signaling (offers / answers / ICE candidates) still goes through
// Supabase's broadcast channel — that lives in `app/jam/[roomId]/page.tsx`,
// which calls into this hook's `initiate/handle*` methods. Supabase therefore
// only facilitates the signaling and presence layers; the actual musical
// payload never touches the server once the data channel is open.
//
// Uses the MDN "Perfect Negotiation" pattern to handle simultaneous offers:
// the peer with the lower id is "impolite" (its offer wins on collision),
// the higher-id peer is "polite" (backs down). This avoids the classic
// glare deadlock.
// ============================================================================

import { useRef, useState, useCallback, useEffect } from "react";

// One signaling message sent through Supabase's broadcast layer. The owner
// of this hook serialises these onto its channel.
type SignalPayload = {
	type: "offer" | "answer" | "candidate";
	targetId: string;
	offer?: RTCSessionDescriptionInit;
	answer?: RTCSessionDescriptionInit;
	candidate?: RTCIceCandidateInit;
};

// Internal per-peer state. `iceQueue` buffers candidates that arrived before
// setRemoteDescription completed — without this, ICE candidates from a fast
// peer get applied to a `null` remote description and fail.
type PeerInfo = {
	pc: RTCPeerConnection;
	dc: RTCDataChannel | null;
	iceQueue: RTCIceCandidateInit[];
	makingOffer: boolean;
	polite: boolean;
};

// Callback signature for received notes. velocity is 0..127; isNoteOn === false
// means note-off (velocity is meaningless in that case but we keep the shape uniform).
// soundfont rides along on every note so the receiver renders with the sender's
// instrument even if the dedicated "soundfont-change" presence event raced.
export type ReceivedNoteHandler = (
	peerId: string,
	note: number,
	velocity: number,
	isNoteOn: boolean,
	soundfont?: string,
) => void;

// Sustain-pedal event from a peer. soundfont is forwarded so the receiver can
// load it before applying the pedal state if it hasn't been seen yet.
export type ReceivedSustainHandler = (peerId: string, active: boolean, soundfont?: string) => void;

// Google's public STUN server. STUN punches through symmetric NATs in the
// common case; rooms behind very restrictive corporate firewalls would need
// a TURN server, which we don't operate.
const ICE_CONFIG: RTCConfiguration = {
	iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(
	myId: string,
	onReceiveNote: ReceivedNoteHandler,
	onReceiveSustain: ReceivedSustainHandler,
) {
	// Map keyed by remote peer id. Mutated directly — not React state, because
	// we don't want to trigger re-renders on every signaling event.
	const peersRef = useRef<Map<string, PeerInfo>>(new Map());
	// Connected set IS React state so the UI can show online indicators per peer.
	const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());

	// Mirror the latest callbacks into refs so the per-message handler (which
	// closes over them) sees fresh values without re-binding the channel.
	const onReceiveNoteRef = useRef(onReceiveNote);
	useEffect(() => {
		onReceiveNoteRef.current = onReceiveNote;
	}, [onReceiveNote]);
	const onReceiveSustainRef = useRef(onReceiveSustain);
	useEffect(() => {
		onReceiveSustainRef.current = onReceiveSustain;
	}, [onReceiveSustain]);

	// Helper to toggle a peer in the connected set immutably.
	const markConnected = useCallback((peerId: string, connected: boolean) => {
		setConnectedPeers((prev) => {
			const next = new Set(prev);
			if (connected) next.add(peerId);
			else next.delete(peerId);
			return next;
		});
	}, []);

	// Wire up a data channel — same handlers whether we created it or received
	// it from the remote (ondatachannel).
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
						onReceiveNoteRef.current(peerId, data.note, data.velocity, data.isNoteOn, data.soundfont);
					} else if (data.type === "sustain") {
						onReceiveSustainRef.current(peerId, !!data.active, data.soundfont);
					}
				} catch {}
			};
		},
		[markConnected],
	);

	// Clean teardown when a peer leaves (presence drop or explicit removal).
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

	// Build a fresh RTCPeerConnection. Used by both the initiator and the
	// receiver — the only difference is who calls createOffer.
	const createPeerConnection = useCallback(
		(peerId: string, sendSignal: (s: SignalPayload) => void): PeerInfo => {
			const pc = new RTCPeerConnection(ICE_CONFIG);
			// Politeness from MDN "Perfect Negotiation". Lower-id peer is impolite
			// (its offer wins on glare); higher-id peer is polite (rolls back).
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
				// Any non-connected state drops us out of the "online" indicator.
				// `connected` itself flips on via the data-channel onopen handler.
				if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
					markConnected(peerId, false);
				}
			};

			return info;
		},
		[myId, markConnected, setupDataChannel],
	);

	// "I want to talk to peerId" — create the connection, open the data
	// channel ourselves, and send the offer through signaling.
	const initiateConnection = useCallback(
		async (peerId: string, sendSignal: (s: SignalPayload) => void) => {
			if (peersRef.current.has(peerId)) return; // already connecting / connected
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

	// Received-an-offer half of the perfect-negotiation dance.
	const handleOffer = useCallback(
		async (peerId: string, offer: RTCSessionDescriptionInit, sendSignal: (s: SignalPayload) => void) => {
			let info = peersRef.current.get(peerId);
			if (!info) {
				// First contact from this peer — set up the connection now.
				info = createPeerConnection(peerId, sendSignal);
			}

			// Collision detection from MDN. If both peers are mid-offer:
			//   - impolite peer ignores the inbound offer
			//   - polite peer rolls back its own and accepts the inbound one
			const offerCollision = info.makingOffer || info.pc.signalingState !== "stable";
			if (offerCollision && !info.polite) return;

			try {
				await info.pc.setRemoteDescription(new RTCSessionDescription(offer));
				// Flush queued candidates now that we have a remote description.
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

	// Apply the answer back to our pending offer.
	const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
		const info = peersRef.current.get(peerId);
		if (!info) return;
		// Guard: we only accept an answer when we have a pending local offer.
		if (info.pc.signalingState === "have-local-offer") {
			try {
				await info.pc.setRemoteDescription(new RTCSessionDescription(answer));
				// Same queue drain as in handleOffer.
				info.iceQueue.forEach((c) => info.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
				info.iceQueue = [];
			} catch (err) {
				console.error("handleAnswer failed", err);
			}
		}
	}, []);

	// ICE candidate from the remote. If we don't yet have a remote description,
	// stash the candidate — adding it now would throw.
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

	// Send a single note to every connected peer. Fire-and-forget — closed
	// channels are silently skipped (the peer presumably left). soundfont
	// is included so the receiver can render with the exact instrument the
	// sender is using, even if our presence-level "soundfont-change" event
	// hasn't reached them yet (or arrives out of order).
	const broadcastNote = useCallback(
		(note: number, velocity: number, isNoteOn: boolean, soundfont?: string) => {
			const msg = JSON.stringify({ type: "midi", note, velocity, isNoteOn, soundfont });
			peersRef.current.forEach((peer) => {
				if (peer.dc?.readyState === "open") {
					try {
						peer.dc.send(msg);
					} catch {}
				}
			});
		},
		[],
	);

	// Same fire-and-forget pattern for the sustain pedal. We carry the
	// sender's soundfont alongside so the receiver can ensure that
	// instrument is loaded before applying pedal state.
	const broadcastSustain = useCallback((active: boolean, soundfont?: string) => {
		const msg = JSON.stringify({ type: "sustain", active, soundfont });
		peersRef.current.forEach((peer) => {
			if (peer.dc?.readyState === "open") {
				try {
					peer.dc.send(msg);
				} catch {}
			}
		});
	}, []);

	// Introspection used by the room page to figure out who it still needs
	// to initiate against vs ignore.
	const hasPeer = useCallback((peerId: string) => peersRef.current.has(peerId), []);
	const knownPeerIds = useCallback(() => Array.from(peersRef.current.keys()), []);

	// Tear down every peer on unmount — without this, leaving the jam page
	// leaves dangling RTCPeerConnections holding mic / audio resources.
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
		broadcastSustain,
		hasPeer,
		knownPeerIds,
		connectedPeers,
	};
}
