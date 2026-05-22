"use client";

import { useState, useRef, useCallback } from "react";
import type { RecordingState } from "@/lib/recording";
import { uploadRecording } from "@/lib/recording";

export function useRecording(userId: string | null) {
  const [state, setState] = useState<RecordingState>("idle");
  const [countdown, setCountdown] = useState(0);
  // True after a recording was attempted without being signed in. Consumers
  // render <RecordingSignInModal> when this flips on.
  const [needsLogin, setNeedsLogin] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);

  const dismissLoginPrompt = useCallback(() => setNeedsLogin(false), []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    // Refuse to start without a signed-in user. The upload step at the end of
    // a recording requires a userId to attach the file to, and starting screen
    // capture only to discard the result later is the worst possible UX.
    if (!userId) {
      setNeedsLogin(true);
      return;
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      } as MediaStreamConstraints);

      const audioTracks = displayStream.getAudioTracks();
      const hasTabAudio = audioTracks.length > 0;

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {}

      micStreamRef.current = micStream;

      const tracks = [...displayStream.getVideoTracks()];
      if (hasTabAudio) tracks.push(audioTracks[0]);
      if (micStream) {
        micStream.getAudioTracks().forEach((t) => tracks.push(t));
      }

      const stream = new MediaStream(tracks);

      streamRef.current = stream;

      stream.getVideoTracks()[0].addEventListener("inactive", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/mp4")
          ? "video/mp4"
          : "video/webm",
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        // userId is guaranteed non-null here — we early-returned at the top of
        // startRecording if it wasn't set.
        await uploadRecording(userId, blob, duration);

        cleanup();
        setState("idle");
      };

      mediaRecorderRef.current = recorder;

      // countdown
      setState("countdown");
      setCountdown(3);
      for (let i = 2; i >= 0; i--) {
        await new Promise((r) => setTimeout(r, 1000));
        setCountdown(i);
      }

      startTimeRef.current = Date.now();
      recorder.start(100);
      setState("recording");
    } catch {
      cleanup();
      setState("idle");
    }
  }, [userId, cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { state, countdown, startRecording, stopRecording, needsLogin, dismissLoginPrompt };
}
