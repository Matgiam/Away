// ============================================================================
// color.ts
// ----------------------------------------------------------------------------
// Pure colour-space conversion helpers used by the colour picker, player
// palette tinting, and visualizer note rendering.
//
// Supported conversions:
//   HEX  ↔ RGB    (hexToRgb / rgbToHex)
//   RGB  ↔ HSV    (rgbToHsv / hsvToRgb)
//   HEX  ↔ HSV    (hexToHsv / hsvToHex)   — convenience wrappers
//   HEX  → RGBA   (hexToRgba)             — adds an alpha channel
//   HEX  → darker (darkenHex)             — multiplies channels by a factor
//
// Plus two validation helpers (`isValidHex`, `normalizeHex`) used wherever a
// user-supplied colour string lands (settings, profile editor, etc.).
// ============================================================================

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

// "#RRGGBB" or "RRGGBB" → {r, g, b} with each channel in [0, 255].
export function hexToRgb(hex: string): Rgb {
	const clean = hex.replace("#", "");
	const r = parseInt(clean.substring(0, 2), 16);
	const g = parseInt(clean.substring(2, 4), 16);
	const b = parseInt(clean.substring(4, 6), 16);
	return { r, g, b };
}

// Three channels in [0, 255] → "#rrggbb". Clamps + rounds to keep the output
// well-formed even when the caller passes floats (e.g. from HSV conversion).
export function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (n: number) =>
		Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Standard RGB → HSV. h in [0, 360), s and v in [0, 1].
// Reference: https://en.wikipedia.org/wiki/HSL_and_HSV#From_RGB
export function rgbToHsv(r: number, g: number, b: number): Hsv {
	// Normalise channels to [0, 1].
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const d = max - min; // chroma

	// Hue: which channel is largest decides which sector we're in.
	let h = 0;
	if (d > 0) {
		if (max === rn) h = ((gn - bn) / d) % 6;
		else if (max === gn) h = (bn - rn) / d + 2;
		else h = (rn - gn) / d + 4;
		h *= 60;
		if (h < 0) h += 360; // wrap negative hues back into [0, 360)
	}

	const s = max === 0 ? 0 : d / max; // saturation (0 for pure black)
	const v = max;                      // value = brightest channel
	return { h, s, v };
}

// HSV → RGB. Inverse of `rgbToHsv`. Returns floats in [0, 255]; callers that
// need integers should round / use `rgbToHex` (which already does).
export function hsvToRgb(h: number, s: number, v: number): Rgb {
	const c = v * s;                                       // chroma
	const hp = ((h % 360) + 360) % 360 / 60;               // hue sector index [0, 6)
	const x = c * (1 - Math.abs((hp % 2) - 1));            // second-largest component

	// Pick which channels chroma and x map to depending on the sector.
	let rn = 0;
	let gn = 0;
	let bn = 0;
	if (hp >= 0 && hp < 1) [rn, gn, bn] = [c, x, 0];
	else if (hp < 2) [rn, gn, bn] = [x, c, 0];
	else if (hp < 3) [rn, gn, bn] = [0, c, x];
	else if (hp < 4) [rn, gn, bn] = [0, x, c];
	else if (hp < 5) [rn, gn, bn] = [x, 0, c];
	else [rn, gn, bn] = [c, 0, x];

	const m = v - c; // lift to the requested value
	return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

// Convenience: HEX → HSV in one call (used by the colour picker).
export function hexToHsv(hex: string): Hsv {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHsv(r, g, b);
}

// Convenience: HSV → HEX in one call (used when the picker emits a new value).
export function hsvToHex(h: number, s: number, v: number): string {
	const { r, g, b } = hsvToRgb(h, s, v);
	return rgbToHex(r, g, b);
}

// Multiply each channel by `factor` (< 1 darkens, > 1 lightens). Used to
// derive a darker variant of a player's colour for shadows / hovers.
export function darkenHex(hex: string, factor: number = 0.65): string {
	const { r, g, b } = hexToRgb(hex);
	return rgbToHex(r * factor, g * factor, b * factor);
}

// HEX → `rgba(r, g, b, a)` CSS string with the supplied alpha.
// Handy because CSS `color-mix` isn't well supported everywhere yet.
export function hexToRgba(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

// Accepts "#RRGGBB" or "RRGGBB" (case-insensitive). No 3-digit shorthand,
// no alpha — keeping the surface small means downstream code can assume the
// 6-hex-digit form everywhere.
const HEX_RE = /^#?([0-9a-f]{6})$/i;

// Cheap predicate for form validation.
export function isValidHex(hex: string): boolean {
	return HEX_RE.test(hex.trim());
}

// Returns a lowercase, hash-prefixed hex string (e.g. "FF0000" → "#ff0000"),
// or `null` if the input isn't a valid 6-digit hex colour. Use this before
// storing user-supplied colours so the DB only ever sees a canonical form.
export function normalizeHex(hex: string): string | null {
	const m = hex.trim().match(HEX_RE);
	if (!m) return null;
	return `#${m[1].toLowerCase()}`;
}
