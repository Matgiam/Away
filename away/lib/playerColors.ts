export const PLAYER_COLORS = [
	"rgba(219, 83, 97, 0.55)",   // red
	"rgba(83, 150, 219, 0.55)",  // blue
	"rgba(83, 219, 150, 0.55)",  // green
	"rgba(200, 140, 219, 0.55)", // purple
];

export const PLAYER_COLORS_SOLID = [
	"#db5361",
	"#5396db",
	"#53db96",
	"#c88cdb",
];

export function getColorIndex(usersOnline: string[], myId: string): number {
	const idx = usersOnline.indexOf(myId);
	return idx === -1 ? 0 : idx;
}


export function getSolidColor(index: number): string {
	return PLAYER_COLORS_SOLID[index % PLAYER_COLORS_SOLID.length];
}