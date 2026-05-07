export const PLAYER_COLORS = [
	"#DB5361",
	"#5396db",
	"#53db96",
	"#c88cdb",
];

export const PLAYER_COLORS_SOLID = [
	"#DB5361",
	"#5396db",
	"#53db96",
	"#c88cdb",
];


export function getColorIndex(usersOnline: string[], myId: string): number {
	const index = usersOnline.indexOf(myId);
	return index === -1 ? 0 : index;
}