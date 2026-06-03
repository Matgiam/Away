// ============================================================================
// ui/ColorPicker.tsx
// ----------------------------------------------------------------------------
// HSV colour picker used by the settings panel for "note colour" and
// "background colour".
//
// Two interactive surfaces:
//   * Saturation × Value pad — drag to pick S (x-axis) and V (y-axis) at the
//     current hue. Rendered as the hue colour with white→transparent (S) and
//     transparent→black (V) gradients overlaid.
//   * Hue strip — drag to pick H from the rainbow gradient.
//
// Plus a hex text input below for typing values directly. The picker is
// controlled — value comes in, onChange goes out — and the hex draft state
// keeps the input usable while the user is mid-edit.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { darkenHex, hexToHsv, hsvToHex, isValidHex, normalizeHex } from "@/lib/color";

interface ColorPickerProps {
	value: string;
	onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
	const [hsv, setHsv] = useState(() => hexToHsv(value));
	const [hexDraft, setHexDraft] = useState(() => value.replace("#", ""));
	const editingHexRef = useRef(false);

	useEffect(() => {
		const next = hexToHsv(value);
		setHsv((prev) => (prev.h === next.h && prev.s === next.s && prev.v === next.v ? prev : next));
		if (!editingHexRef.current) {
			setHexDraft(value.replace("#", ""));
		}
	}, [value]);

	const commit = useCallback(
		(next: { h: number; s: number; v: number }) => {
			setHsv(next);
			const hex = hsvToHex(next.h, next.s, next.v);
			setHexDraft(hex.replace("#", ""));
			onChange(hex);
		},
		[onChange],
	);

	const svPadRef = useRef<HTMLDivElement>(null);
	const hueRef = useRef<HTMLDivElement>(null);

	const startDrag = (e: React.PointerEvent, target: HTMLElement, onMove: (clientX: number, clientY: number) => void) => {
		const pointerId = e.pointerId;
		target.setPointerCapture(pointerId);
		const handleMove = (e: PointerEvent) => onMove(e.clientX, e.clientY);
		const handleUp = () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
			target.releasePointerCapture(pointerId);
		};
		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	};

	const handleSvDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const el = svPadRef.current;
		if (!el) return;
		const apply = (clientX: number, clientY: number) => {
			const rect = el.getBoundingClientRect();
			const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
			const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
			commit({ h: hsv.h, s: x, v: 1 - y });
		};
		apply(e.clientX, e.clientY);
		startDrag(e, el, apply);
	};

	const handleHueDown = (e: React.PointerEvent<HTMLDivElement>) => {
		const el = hueRef.current;
		if (!el) return;
		const apply = (clientX: number) => {
			const rect = el.getBoundingClientRect();
			const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
			commit({ h: x * 360, s: hsv.s, v: hsv.v });
		};
		apply(e.clientX);
		startDrag(e, el, (cx) => apply(cx));
	};

	const handleHexCommit = () => {
		editingHexRef.current = false;
		const normalized = normalizeHex(hexDraft);
		if (normalized) {
			onChange(normalized);
		} else {
			setHexDraft(value.replace("#", ""));
		}
	};

	const hueColor = hsvToHex(hsv.h, 1, 1);
	const darkPreview = darkenHex(value);

	return (
		<div className="flex flex-col gap-3 w-full max-w-xs">
			<div
				ref={svPadRef}
				onPointerDown={handleSvDown}
				className="relative h-44 w-full rounded-lg overflow-hidden cursor-crosshair touch-none select-none"
				style={{ backgroundColor: hueColor }}
			>
				<div className="absolute inset-0" style={{ background: "linear-gradient(to right, #fff, transparent)" }} />
				<div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />
				<div
					className="absolute w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none"
					style={{
						left: `calc(${hsv.s * 100}% - 7px)`,
						top: `calc(${(1 - hsv.v) * 100}% - 7px)`,
						boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
					}}
				/>
			</div>

			<div
				ref={hueRef}
				onPointerDown={handleHueDown}
				className="relative h-3 rounded-full cursor-pointer touch-none select-none"
				style={{
					background:
						"linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
				}}
			>
				<div
					className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white pointer-events-none"
					style={{
						left: `calc(${(hsv.h / 360) * 100}% - 8px)`,
						backgroundColor: hueColor,
						boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
					}}
				/>
			</div>

			<div className="flex items-center gap-2 mt-1">
				<div className="flex flex-col gap-1">
					<div
						className="w-10 h-5 rounded-t-md border-x border-t border-white/15"
						style={{ backgroundColor: value }}
						title="White-key color"
					/>
					<div
						className="w-10 h-5 rounded-b-md border-x border-b border-white/15"
						style={{ backgroundColor: darkPreview }}
						title="Black-key color (auto-derived)"
					/>
				</div>
				<div className="flex-1 flex items-center bg-white/5 border border-white/15 rounded-md focus-within:border-white/30 transition-colors">
					<span className="text-white/40 text-sm pl-3 pr-1">#</span>
					<input
						type="text"
						value={hexDraft}
						spellCheck={false}
						onFocus={() => {
							editingHexRef.current = true;
						}}
						onChange={(e) => {
							editingHexRef.current = true;
							const next = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
							setHexDraft(next);
							if (next.length === 6 && isValidHex(next)) {
								const hex = `#${next.toLowerCase()}`;
								onChange(hex);
							}
						}}
						onBlur={handleHexCommit}
						onKeyDown={(e) => {
							if (e.key === "Enter") (e.target as HTMLInputElement).blur();
						}}
						className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-white text-sm outline-none font-mono tracking-wider"
						placeholder="db5361"
					/>
				</div>
			</div>
		</div>
	);
}
