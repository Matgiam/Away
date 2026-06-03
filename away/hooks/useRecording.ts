// ============================================================================
// useRecording.ts
// ----------------------------------------------------------------------------
// Screen + mic recording. Captures the current browser tab (via
// `getDisplayMedia` with `preferCurrentTab`) plus the user's microphone (via
// `getUserMedia`), merges them into a single MediaStream, and feeds that to
// a `MediaRecorder`. On stop, the blob is uploaded to Supabase Storage via
// `lib/recording.uploadRecording`.
//
// State machine: idle → countdown (3-2-1) → recording → idle.
//
// Login gating: starting screen capture only to discard the result later is
// terrible UX, so we refuse to start at all if there's no signed-in user.
// `needsLogin` flips on, which the consumer shows as a "Sign in" modal.
//
// Pattern reference: MDN MediaRecorder + Screen Capture API guides.
// ============================================================================

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
  // Live MediaRecorder + its data chunks.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // The two underlying streams (display + mic) kept separately so we can
  // stop their tracks individually on cleanup.
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  // Wall-clock start time — used to compute duration without the recorder
  // (which doesn't expose it directly).
  const startTimeRef = useRef(0);

  const dismissLoginPrompt = useCallback(() => setNeedsLogin(false), []);

  // Tear down every track and clear refs. Safe to call multiple times.
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
      // 1. Capture the current tab (video + tab audio if the user allows it).
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      } as MediaStreamConstraints);

      // Tab audio is optional — some browsers grant video-only.
      const audioTracks = displayStream.getAudioTracks();
      const hasTabAudio = audioTracks.length > 0;

      // 2. Capture the mic. Failure is non-fatal — recording continues silently.
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {}

      micStreamRef.current = micStream;

      // 3. Build a single MediaStream that has the video, the tab audio (if
      // any), and the mic audio (if any).
      const tracks = [...displayStream.getVideoTracks()];
      if (hasTabAudio) tracks.push(audioTracks[0]);
      if (micStream) {
        micStream.getAudioTracks().forEach((t) => tracks.push(t));
      }

      const stream = new MediaStream(tracks);

      streamRef.current = stream;

      // If the user revokes screen-share permission (clicks "Stop sharing" in
      // the browser bar), the video track goes inactive — auto-stop the
      // recorder so we don't end up uploading a partial blob.
      stream.getVideoTracks()[0].addEventListener("inactive", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      // 4. Pick the best container format the browser supports. MP4 first
      // (smaller, more compatible with players), WebM as a fallback.
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/mp4")
          ? "video/mp4"
          : "video/webm",
      });

      // 5. Collect chunks as they're produced. We append rather than overwrite
      // because the recorder slices the output into 100ms chunks.
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // 6. On stop: glue the chunks together, upload, and reset.
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

      // 7. 3-2-1 countdown so the user has time to set up their shot before
      // recording actually starts.
      setState("countdown");
      setCountdown(3);
      for (let i = 2; i >= 0; i--) {
        await new Promise((r) => setTimeout(r, 1000));
        setCountdown(i);
      }

      // 8. Off we go. 100ms slice = nice trade-off between memory and
      // responsive `ondataavailable` callbacks.
      startTimeRef.current = Date.now();
      recorder.start(100);
      setState("recording");
    } catch {
      // User declined permission, or browser doesn't support the APIs.
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
