export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

export function hexToRgb(hex: string): Rgb {
	const clean = hex.replace("#", "");
	const r = parseInt(clean.substring(0, 2), 16);
	const g = parseInt(clean.substring(2, 4), 16);
	const b = parseInt(clean.substring(4, 6), 16);
	return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (n: number) =>
		Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const d = max - min;

	let h = 0;
	if (d > 0) {
		if (max === rn) h = ((gn - bn) / d) % 6;
		else if (max === gn) h = (bn - rn) / d + 2;
		else h = (rn - gn) / d + 4;
		h *= 60;
		if (h < 0) h += 360;
	}

	const s = max === 0 ? 0 : d / max;
	const v = max;
	return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
	const c = v * s;
	const hp = ((h % 360) + 360) % 360 / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));

	let rn = 0;
	let gn = 0;
	let bn = 0;
	if (hp >= 0 && hp < 1) [rn, gn, bn] = [c, x, 0];
	else if (hp < 2) [rn, gn, bn] = [x, c, 0];
	else if (hp < 3) [rn, gn, bn] = [0, c, x];
	else if (hp < 4) [rn, gn, bn] = [0, x, c];
	else if (hp < 5) [rn, gn, bn] = [x, 0, c];
	else [rn, gn, bn] = [c, 0, x];

	const m = v - c;
	return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

export function hexToHsv(hex: string): Hsv {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHsv(r, g, b);
}

export function hsvToHex(h: number, s: number, v: number): string {
	const { r, g, b } = hsvToRgb(h, s, v);
	return rgbToHex(r, g, b);
}

export function darkenHex(hex: string, factor: number = 0.65): string {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHex(r * factor, g * factor, b * factor);
}

export function hexToRgba(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

const HEX_RE = /^#?([0-9a-f]{6})$/i;
export function isValidHex(hex: string): boolean {
	return HEX_RE.test(hex.trim());
}

export function normalizeHex(hex: string): string | null {
	const m = hex.trim().match(HEX_RE);
	if (!m) return null;
	return `#${m[1].toLowerCase()}`;
}
