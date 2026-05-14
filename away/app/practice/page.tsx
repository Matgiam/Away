import { getAllBuiltInSongs } from "@/lib/practice/catalog.server";
import PracticeClient from "./PracticeClient";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
	const songs = await getAllBuiltInSongs();
	return <PracticeClient initialSongs={songs} />;
}
