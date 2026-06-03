# Away

Away is a browser-based piano playground. You can play with a MIDI controller or
your computer keyboard, jam with other people in real time, record what you
play, upload an audio file and have it transcribed to MIDI to practice along
with falling notes, and unlock achievements as you go.

The repository contains two pieces:

| Folder            | What it is                                                       |
|-------------------|------------------------------------------------------------------|
| `away/`           | The Next.js 15 / React 19 web app (the actual product)           |
| `transkun-server/`| Optional Python service for higher-quality audio→MIDI            |

> `away/transcribe-server/` is the same Python service packaged for Hugging
> Face Spaces. The Next.js app does **not** require either of them — when
> `NEXT_PUBLIC_TRANSCRIBE_API_URL` is unset, transcription falls back to
> [@spotify/basic-pitch](https://www.npmjs.com/package/@spotify/basic-pitch)
> running in the browser.

---

## Features

- **Free play** (`/`) — 88-key piano with computer-keyboard input, Web MIDI
  device support, soundfont picker, sustain pedal, octave shift, reverb.
- **Practice** (`/practice`) — falling-note view driven by a MIDI file. Either
  pick a song from the catalog or upload your own MIDI / audio file (audio
  files are automatically transcribed to MIDI).
- **Multiplayer jams** (`/multiplayer`, `/jam/[roomId]`) — create or join a
  room. Notes are exchanged peer-to-peer over WebRTC data channels so latency
  is low; presence, chat, and room state go through Supabase Realtime.
- **Screen recording** — capture an MP4/WebM of the tab (notes + audio + mic)
  and store it in Supabase Storage.
- **Profile / achievements / friends** — Supabase-backed accounts with stats,
  unlockable badges, and a friends list.

---

## Tech stack

- **Next.js 15 (App Router)** + **React 19** + **TypeScript**
- **Supabase** — auth, Postgres, Realtime (chat / presence / signaling),
  Storage (recordings + user uploads), RPC for password-protected rooms
- **Tailwind CSS v4** + **Radix UI** primitives + **shadcn-style** wrappers
- **Web Audio API** + **AudioWorklet** — synth output path
- **[spessasynth_lib](https://github.com/spessasus/SpessaSynth)** — SoundFont
  (`.sf2` / `.sf3`) playback inside an AudioWorklet
- **[Tone.js](https://tonejs.github.io/)** — master volume / reverb chain
- **[@tonejs/midi](https://github.com/Tonejs/Midi)** — parsing MIDI files for
  the falling-note practice view
- **[@spotify/basic-pitch](https://github.com/spotify/basic-pitch)** — in-browser
  audio → MIDI fallback transcription
- **WebRTC** (`RTCPeerConnection` + `RTCDataChannel`) — peer-to-peer note
  transport in multiplayer
- **Web MIDI API** — external MIDI controller input
- **MediaRecorder** + **getDisplayMedia** + **getUserMedia** — screen recording
- **Three.js** + **@react-three/fiber** — animated silk shader background
- **GSAP** — UI animations
- **(Optional) Transkun** — Python audio→MIDI transformer service for higher
  transcription quality, exposed via FastAPI

---

## Getting started

### 1. Web app

```bash
cd away
npm install      # postinstall copies the spessasynth worklet + basic-pitch model into public/
cp .env.example .env.local   # fill in the Supabase keys (see below)
npm run dev
```

Open <http://localhost:3000>.

Required environment variables in `away/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Optional — only set if you also run the Transkun service (see below).
# When unset, the app uses Spotify Basic Pitch in the browser instead.
NEXT_PUBLIC_TRANSCRIBE_API_URL=http://localhost:8000
NEXT_PUBLIC_TRANSCRIBE_API_KEY=
```

The Supabase schema (rooms, profiles, friendships, messages, recordings,
achievements, community MIDI uploads, transcription queue) is created by the
SQL scripts in [`away/scripts/`](away/scripts/) — apply them in the Supabase
SQL editor.

### 2. Transkun server (optional)

Only needed if you want higher-quality audio→MIDI than Basic Pitch. See
[`transkun-server/README.md`](transkun-server/README.md) for details. The
short version:

```bash
cd transkun-server
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```

Then set `NEXT_PUBLIC_TRANSCRIBE_API_URL=http://localhost:8000` in
`away/.env.local`.

---

## Project layout

```
away/
├── app/                  Next.js App Router routes
│   ├── api/instruments/  Walks public/instruments and returns the SoundFont catalog
│   ├── api/practice/     Songs / catalog endpoints
│   ├── auth/             Supabase auth pages (login, sign-up, confirm, reset…)
│   ├── jam/[roomId]/     Multiplayer jam page (Supabase Realtime + WebRTC)
│   ├── multiplayer/      Room browser + create/join modals
│   ├── practice/         Practice view with falling notes
│   └── protected/        Profile, achievements, recordings, uploads
├── components/
│   ├── effects/          SilkBackground (Three.js shader), DynamicLiquidglass (SVG filter)
│   ├── multiplayer/      Piano + Visualizer + RoomList + PlayerList
│   ├── practice/         FallingNotes, PracticeMenu, UploadModal…
│   ├── auth/             Login / sign-up / password-reset forms
│   └── ui/               Radix-based primitives (Button, DropdownMenu, …)
├── hooks/                useAudioEngine, useWebRTC, useRecording, useChat, …
├── lib/
│   ├── supabase/         Browser + server Supabase clients
│   ├── spessaSynthEngine.ts   AudioWorklet synth wrapper
│   ├── practice/         Catalog, MIDI parser, transcribe (basic-pitch / transkun)
│   └── …                 chordRecognition, recording, achievements, friends, etc.
├── public/
│   ├── instruments/      .sf2 / .sf3 SoundFont files (loaded at runtime)
│   ├── soundfont/        Older bundled SoundFonts (piano, guitar, synth, …)
│   ├── models/basic-pitch/  Spotify Basic Pitch TFJS model (copied at install time)
│   └── spessasynth/      AudioWorklet processor (copied at install time)
├── middleware.ts         Supabase session-refresh middleware
└── scripts/              SQL setup + post-install copy scripts
```

---

## How the pieces fit together

### Audio engine

`hooks/useAudioEngine.ts` is the single owner of the synth chain:

```
[your keys / MIDI / peers]  →  SpessaSynthEngine (AudioWorklet)
                                       │
                                       ▼
                                Tone.Reverb  →  Tone.Volume  →  speakers
```

`lib/spessaSynthEngine.ts` is a thin wrapper around `spessasynth_lib`'s
`WorkletSynthesizer` that allocates one MIDI channel per player. The local
player always uses channel 0; remote peers in a jam room are assigned channels
1–15 lazily (skipping channel 9, the MIDI drum slot), so different players can
hold different soundfonts at the same time.

### Multiplayer

Each room is one Supabase Realtime channel (`room-{id}`). The channel carries
three concerns:

1. **Presence** — `channel.track(...)` for who's in the room, their colour,
   soundfont and equipped badge.
2. **Signaling** — broadcast events relay WebRTC offers / answers / ICE
   candidates between peers. See `hooks/useWebRTC.ts`.
3. **Chat** — Postgres `postgres_changes` subscription on `room_messages`.
   See `hooks/useChat.ts`.

Notes themselves go peer-to-peer over `RTCDataChannel` ("piano-notes"), not
through Supabase, which keeps note latency low even when the Realtime channel
is busy.

### Transcription

`lib/practice/transcribe.ts` picks one of two engines:

- **Basic Pitch** (default, in-browser, TFJS). Model files live in
  `public/models/basic-pitch/`.
- **Transkun** (optional). Sends the file to `NEXT_PUBLIC_TRANSCRIBE_API_URL`
  and polls `/jobs/{id}` until done. The server is in `transkun-server/`.

Both engines return a MIDI `ArrayBuffer` that the rest of the app handles the
same way.

### Recording

`hooks/useRecording.ts` opens `getDisplayMedia` for the current tab (video +
tab audio) and `getUserMedia` for the microphone, merges them into one
`MediaStream`, runs it through `MediaRecorder`, and uploads the resulting blob
to the `recordings` Supabase Storage bucket.

---

## Sources & attribution

This is the section that matters for the report. Every external snippet,
library, model or asset that ended up in the repository is listed below
alongside the file(s) where it's used, so it's possible to trace any line of
code back to its origin.

### Code snippets adapted from other sources

| Source                                                                                                       | Used in                                                                                              | What was taken                                                                                                                                                                                                                                                                       |
|--------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [React Bits — *Silk* background](https://reactbits.dev/backgrounds/silk?speed=13&rotation=4.31&noiseIntensity=1.7&color=EF4444&scale=0.8) | [`away/components/effects/SilkBackground.tsx`](away/components/effects/SilkBackground.tsx)           | The GLSL vertex/fragment shader and the React Three Fiber wrapper come from the React Bits "Silk" background. The component was kept structurally identical; default props (colour, speed, scale, rotation, noise intensity) were tuned for the Away theme.                          |
| [kube.io — *Liquid Glass with CSS and SVG*](https://kube.io/blog/liquid-glass-css-svg/)                      | [`away/components/effects/DynamicLiquidglass.tsx`](away/components/effects/DynamicLiquidglass.tsx)   | The displacement / specular map computation (refraction along a "lip" curve), the SVG `feDisplacementMap` + `feComposite` filter chain and the `backdrop-filter: url(#…)` trick are taken from this blog post. Adapted into a React component with configurable size / radius / blur. |
| [MDN — *MediaRecorder API*](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)                  | [`away/hooks/useRecording.ts`](away/hooks/useRecording.ts)                                            | The `getDisplayMedia` + `getUserMedia` + `MediaRecorder` pattern (merging tab audio + mic into a single `MediaStream`, the `dataavailable` / `stop` event handling, and the MIME-type fallback to `video/webm`) follows the MDN docs.                                                  |
| [MDN — *Web MIDI API*](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)                        | [`away/hooks/useAudioEngine.ts`](away/hooks/useAudioEngine.ts) (see `connectMIDI`)                    | The `navigator.requestMIDIAccess` flow, iteration over `inputs`, and `onmidimessage` byte parsing (status byte → command nibble; note-on / note-off / CC64 sustain) follow MDN. The velocity-curve soft-compression above 100 is custom.                                                |
| [MDN — *WebRTC API*](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) and [*Perfect Negotiation* pattern](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation) | [`away/hooks/useWebRTC.ts`](away/hooks/useWebRTC.ts)                                                  | `RTCPeerConnection` setup, `RTCDataChannel`, ICE candidate exchange and the polite/impolite peer roles for offer collisions follow the MDN WebRTC pages. STUN uses Google's public server (`stun:stun.l.google.com:19302`).                                                              |
| [Supabase — *Use Supabase with Next.js* (App Router quickstart)](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) | [`away/lib/supabase/client.ts`](away/lib/supabase/client.ts), [`away/lib/supabase/server.ts`](away/lib/supabase/server.ts), [`away/middleware.ts`](away/middleware.ts), [`away/app/auth/*`](away/app/auth/), [`away/components/auth/*`](away/components/auth/) | The split browser / server clients (`createBrowserClient` + `createServerClient`), the cookie-passthrough setup, the session-refresh middleware, and the email / password / OAuth forms come from the official Supabase + Next.js App Router guide.                                  |
| [Supabase — *Realtime Postgres Changes*](https://supabase.com/docs/guides/realtime/postgres-changes) and [*Presence*](https://supabase.com/docs/guides/realtime/presence) | [`away/hooks/useChat.ts`](away/hooks/useChat.ts), [`away/app/jam/[roomId]/page.tsx`](away/app/jam/[roomId]/page.tsx) | The `supabase.channel(...).on("postgres_changes", …)` subscription used for chat, and the `channel.track(...)` / `channel.on("presence", …)` pattern used to keep the player list in sync are taken from these docs.                                                                  |
| [YouTube — Web Audio piano tutorial](https://www.youtube.com/watch?v=69Pa1w2gOcU)                            | [`away/components/multiplayer/Piano.tsx`](away/components/multiplayer/Piano.tsx), [`away/lib/piano.ts`](away/lib/piano.ts) | General reference for the 88-key layout, white-/black-key geometry and pointer-event handling. The code in the repository was rewritten rather than copy-pasted; the video was used as an explanatory reference for how the keyboard maps onto a CSS layout.                          |

### Libraries

Everything below is installed from npm / PyPI under its declared licence
(see each project's repository for the exact terms).

- **[spessasynth_lib](https://github.com/spessasus/SpessaSynth)** — SoundFont
  synthesizer (`WorkletSynthesizer`) used in
  [`away/lib/spessaSynthEngine.ts`](away/lib/spessaSynthEngine.ts). The
  AudioWorklet processor file (`spessasynth_processor.min.js`) is copied out
  of `node_modules` into `public/spessasynth/` at install time by
  [`away/scripts/sync-spessasynth-worklet.mjs`](away/scripts/sync-spessasynth-worklet.mjs).
- **[@spotify/basic-pitch](https://github.com/spotify/basic-pitch)** — CNN that
  converts audio to MIDI. Used in
  [`away/lib/practice/transcribe.ts`](away/lib/practice/transcribe.ts). The
  TensorFlow.js model files are pulled into `public/models/basic-pitch/` by
  [`away/scripts/sync-basic-pitch-model.mjs`](away/scripts/sync-basic-pitch-model.mjs).
- **[Transkun](https://github.com/yujia-yan/Transkun)** — transformer + semi-CRF
  piano transcription model. Wrapped by the FastAPI service in
  [`transkun-server/main.py`](transkun-server/main.py) and called by
  [`away/lib/practice/transcribeServer.ts`](away/lib/practice/transcribeServer.ts).
- **[Tone.js](https://tonejs.github.io/)** — used for the master volume node
  and reverb in [`away/lib/audio.ts`](away/lib/audio.ts) and
  [`away/hooks/useAudioEngine.ts`](away/hooks/useAudioEngine.ts).
- **[@tonejs/midi](https://github.com/Tonejs/Midi)** — parses MIDI files in
  [`away/lib/practice/midiParser.ts`](away/lib/practice/midiParser.ts).
- **[Three.js](https://threejs.org/)** + **[@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)** —
  used by the silk shader background ([`SilkBackground.tsx`](away/components/effects/SilkBackground.tsx)).
- **[GSAP](https://gsap.com/)** + **[@gsap/react](https://gsap.com/resources/React/)** — UI animations.
- **[@tinymomentum/liquid-glass-react](https://www.npmjs.com/package/@tinymomentum/liquid-glass-react)** —
  prebuilt React variant of the liquid-glass effect, used alongside the custom
  [`DynamicLiquidglass.tsx`](away/components/effects/DynamicLiquidglass.tsx) where a
  ready-made component was sufficient.
- **[Radix UI](https://www.radix-ui.com/)** primitives (`@radix-ui/react-checkbox`,
  `dropdown-menu`, `label`, `slot`) — used by the components under
  [`away/components/ui/`](away/components/ui/).
- **[Tailwind CSS v4](https://tailwindcss.com/)**, **[class-variance-authority](https://cva.style/)**,
  **[tailwind-merge](https://github.com/dcastil/tailwind-merge)**, **[clsx](https://github.com/lukeed/clsx)** —
  styling layer.
- **[Lucide](https://lucide.dev/)** (`lucide-react`) — icon set used across the UI.
- **[next-themes](https://github.com/pacocoursey/next-themes)** — dark/light mode toggle.
- **[Supabase JS](https://github.com/supabase/supabase-js)** (`@supabase/supabase-js`,
  `@supabase/ssr`) — auth + Postgres + Realtime + Storage client.
- **[html2canvas](https://html2canvas.hertzen.com/)** — used to snapshot the
  practice view (e.g. when sharing a result card).

### Web platform APIs

These are not "libraries" but standard browser APIs. They're listed here
because the report needs to show what each part of the project actually
relies on.

| API                                                                                                                              | Where it's used                                                                                                          |
|----------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) (`AudioContext`)                                 | [`away/lib/audio.ts`](away/lib/audio.ts), [`away/lib/spessaSynthEngine.ts`](away/lib/spessaSynthEngine.ts)                |
| [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)                                                    | [`away/lib/spessaSynthEngine.ts`](away/lib/spessaSynthEngine.ts) (loads `spessasynth_processor.min.js`)                   |
| [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)                                                    | [`away/hooks/useAudioEngine.ts`](away/hooks/useAudioEngine.ts) (`connectMIDI`)                                            |
| [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) (`RTCPeerConnection`, `RTCDataChannel`)                    | [`away/hooks/useWebRTC.ts`](away/hooks/useWebRTC.ts)                                                                      |
| [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)                                                  | [`away/hooks/useRecording.ts`](away/hooks/useRecording.ts)                                                                |
| [Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API) (`getDisplayMedia`)                    | [`away/hooks/useRecording.ts`](away/hooks/useRecording.ts)                                                                |
| [MediaDevices.getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)                          | [`away/hooks/useRecording.ts`](away/hooks/useRecording.ts) (microphone capture)                                           |
| [Canvas 2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)                                           | [`away/components/effects/DynamicLiquidglass.tsx`](away/components/effects/DynamicLiquidglass.tsx) (builds displacement / specular maps) |
| [SVG Filters](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter) (`feDisplacementMap`, `feGaussianBlur`, `feComposite`) | [`away/components/effects/DynamicLiquidglass.tsx`](away/components/effects/DynamicLiquidglass.tsx)                        |
| [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) (via Supabase Realtime)                              | [`away/hooks/useChat.ts`](away/hooks/useChat.ts), [`away/hooks/useRooms.ts`](away/hooks/useRooms.ts), [`away/app/jam/[roomId]/page.tsx`](away/app/jam/[roomId]/page.tsx) |
| [Page Lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) + `fetch` with `keepalive`                | [`away/app/jam/[roomId]/page.tsx`](away/app/jam/[roomId]/page.tsx) (`decrementViaKeepalive` — fires a final RPC on tab close) |

### Assets

- **SoundFonts** — the `.sf2` / `.sf3` files in
  [`away/public/instruments/`](away/public/instruments/) and
  [`away/public/soundfont/`](away/public/soundfont/) include works from
  [Musical Artifacts](https://musical-artifacts.com/artifacts/1176) and other
  community libraries. They are redistributed under their original
  **Creative Commons** licences (see each file's source page on
  musical-artifacts.com for the exact CC variant). Categorisation of files
  into folders (`keyboards`, `guitars`, `bass`, …) is what
  [`app/api/instruments/route.ts`](away/app/api/instruments/route.ts) reads at
  runtime to populate the soundfont picker.
- **MIDI files** under [`away/public/midi/`](away/public/midi/) — public-domain
  classical pieces and community-uploaded songs (uploads also live in Supabase
  Storage; only a small bundled catalog ships in the repo).
- **Icons** under [`away/public/icons/`](away/public/icons/) — custom icons /
  badges drawn for the project.

### Documentation referenced

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase + Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Supabase Auth helpers for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase Realtime — Presence & Broadcast](https://supabase.com/docs/guides/realtime/presence)
- [MDN — Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN — AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [MDN — Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
- [MDN — WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [MDN — Perfect Negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
- [MDN — MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN — Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API)
- [MDN — SVG Filter Primitives](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter)
- [React Three Fiber documentation](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)


---