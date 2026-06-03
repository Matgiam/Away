// ============================================================================
// TranscriptionProvider.tsx
// ----------------------------------------------------------------------------
// App-wide host for the in-flight background audio→MIDI transcription state.
//
// Lifts the background transcription state from PracticeMenu up to the root
// layout so the floating toast renders on every page. The user can browse the
// app, play solo, jam in multiplayer, etc. while Transkun crunches their audio
// in the background.
//
// Clicking the toast on "done" routes back to /practice (where the upload
// modal lives) via `pendingFinalize`. PracticeMenu watches the flag and opens
// its modal with the result prefilled.
// ============================================================================

"use client";

import {
	createContext,
	useCallback,
	useContext,
	useState,
	type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { TranscriptionLoading } from "@/components/practice/TranscriptionLoading";
import {
	useBackgroundTranscription,
	type BackgroundTranscribeControls,
} from "@/hooks/useBackgroundTranscription";

type TranscriptionContextValue = BackgroundTranscribeControls & {
	pendingFinalize: boolean;
	consumePendingFinalize: () => void;
};

const TranscriptionContext = createContext<TranscriptionContextValue | null>(null);

export function TranscriptionProvider({ children }: { children: ReactNode }) {
	const controls = useBackgroundTranscription();
	const [pendingFinalize, setPendingFinalize] = useState(false);
	const router = useRouter();
	const pathname = usePathname();

	const consumePendingFinalize = useCallback(() => {
		setPendingFinalize(false);
	}, []);

	const handleOpenFinalize = useCallback(() => {
		if (controls.state.phase !== "done") return;
		setPendingFinalize(true);
		// Navigate to /practice if the click came from a different route. The
		// PracticeMenu reads pendingFinalize on mount and opens the upload modal
		// at the form stage.
		if (pathname !== "/practice") {
			router.push("/practice");
		}
	}, [controls.state.phase, pathname, router]);

	return (
		<TranscriptionContext.Provider
			value={{ ...controls, pendingFinalize, consumePendingFinalize }}
		>
			{children}
			<TranscriptionLoading
				state={controls.state}
				onOpenFinalize={handleOpenFinalize}
				onDismiss={controls.dismiss}
				onCancel={controls.cancel}
			/>
		</TranscriptionContext.Provider>
	);
}

export function useTranscriptionContext(): TranscriptionContextValue {
	const ctx = useContext(TranscriptionContext);
	if (!ctx) {
		throw new Error("useTranscriptionContext must be used inside <TranscriptionProvider>");
	}
	return ctx;
}
