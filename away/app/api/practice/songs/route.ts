import { NextResponse } from "next/server";
import { getAllBuiltInSongs } from "@/lib/practice/catalog.server";

export const dynamic = "force-dynamic";

export async function GET() {
	const songs = await getAllBuiltInSongs();
	return NextResponse.json({ songs });
}
