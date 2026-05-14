import { notFound } from "next/navigation";
import { getAllBuiltInSongs } from "@/lib/practice/catalog.server";
import PracticePlayerClient from "./PracticePlayerClient";

export const dynamic = "force-dynamic";

interface PageProps {
	params: Promise<{ songId: string }>;
}

export default async function PracticePlayPage({ params }: PageProps) {
	const { songId } = await params;
	const decoded = decodeURIComponent(songId);

	const songs = await getAllBuiltInSongs();
	const song = songs.find((s) => s.id === decoded);
	if (!song) notFound();

	return <PracticePlayerClient song={song} />;
}
