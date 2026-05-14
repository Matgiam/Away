export type UploadDifficulty = "easy" | "medium" | "hard";

export type UploadedSongMeta = {
	id: string;
	title: string;
	artist: string;
	difficulty: UploadDifficulty;
	fileName: string;
	durationSeconds: number;
	bpm: number;
	createdAt: number;
};

export type UploadedSong = UploadedSongMeta & {
	data: ArrayBuffer;
};

const DB_NAME = "away_practice";
const DB_VERSION = 1;
const STORE_NAME = "uploads";

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("IndexedDB is not available"));
			return;
		}
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
				store.createIndex("createdAt", "createdAt");
			}
		};
	});
}

export async function saveUploadedSong(song: UploadedSong): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const req = store.put(song);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve();
	});
}

export async function getUploadedSong(id: string): Promise<UploadedSong | null> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);
		const req = store.get(id);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve((req.result as UploadedSong | undefined) ?? null);
	});
}

export async function listUploadedSongs(): Promise<UploadedSongMeta[]> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readonly");
		const store = tx.objectStore(STORE_NAME);
		const req = store.getAll();
		req.onerror = () => reject(req.error);
		req.onsuccess = () => {
			const rows = (req.result as UploadedSong[]) ?? [];
			rows.sort((a, b) => b.createdAt - a.createdAt);
			resolve(
				rows.map((s) => ({
					id: s.id,
					title: s.title,
					artist: s.artist,
					difficulty: s.difficulty,
					fileName: s.fileName,
					durationSeconds: s.durationSeconds,
					bpm: s.bpm,
					createdAt: s.createdAt,
				})),
			);
		};
	});
}

export async function deleteUploadedSong(id: string): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const req = store.delete(id);
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve();
	});
}

export async function updateUploadedSongMeta(
	id: string,
	patch: Partial<Pick<UploadedSongMeta, "title" | "artist" | "difficulty">>,
): Promise<void> {
	const existing = await getUploadedSong(id);
	if (!existing) throw new Error("Upload not found");
	await saveUploadedSong({ ...existing, ...patch });
}

export function generateUploadId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `u:${crypto.randomUUID()}`;
	}
	return `u:${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function isUploadId(id: string): boolean {
	return id.startsWith("u:");
}
