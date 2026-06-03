// ============================================================================
// DynamicLiquidglass.tsx
// ----------------------------------------------------------------------------
// "Liquid glass" effect rendered with an SVG filter. Anything behind this
// component shows through with a refracted bezel and specular highlight,
// closely mimicking the visual style used by recent Apple UIs.
//
// Approach (adapted from https://kube.io/blog/liquid-glass-css-svg/):
//   1. Pre-compute a displacement map and specular map onto two canvas
//      elements at mount. The displacement map encodes refraction along a
//      mathematically-defined "lip" curve (see LIP_FN below).
//   2. Reference both maps in an SVG <filter> that chains
//      feGaussianBlur → feDisplacementMap → feColorMatrix → feComposite
//      → feComponentTransfer → feBlend.
//   3. Apply the filter via `backdrop-filter: url(#filter-id)` to a div
//      sitting on top of whatever content is behind it.
//
// `children` render in a centred overlay above the glass, so callers can
// drop labels / icons on top without fighting the filter.
// ============================================================================

"use client";

import React, { useEffect, useState } from "react";

// Helper curves used to shape the "lip" of the glass — the surface where
// light bends as it crosses the edge.
const CONVEX = { fn: (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4) };
const CONCAVE = { fn: (x: number) => 1 - Math.sqrt(1 - (1 - x) ** 2) };
const LIP_FN = (x: number) => {
	const convex = CONVEX.fn(x * 2);
	const concave = CONCAVE.fn(x) + 0.1;
	const smootherstep = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
	return convex * (1 - smootherstep) + concave * smootherstep;
};

function calculateDisplacementCurve(glassThickness: number, bezelWidth: number, samples: number) {
	const eta = 1 / 1.3;
	return Array.from({ length: samples }, (_, i) => {
		const x = i / samples;
		const y = LIP_FN(x);
		const dx = x < 1 ? 0.0001 : -0.0001;
		const derivative = (LIP_FN(x + dx) - y) / dx;
		const mag = Math.sqrt(derivative * derivative + 1);
		const normalY = -1 / mag;
		const k = 1 - eta * eta * (1 - normalY * normalY);
		if (k < 0) return 0;
		const kSqrt = Math.sqrt(k);
		const refrY = eta - (eta * normalY + kSqrt) * normalY;
		const refrX = -(eta * normalY + kSqrt) * (-derivative / mag);
		return refrX * ((y * bezelWidth + glassThickness) / refrY);
	});
}

interface DynamicLiquidGlassProps {
	width: number;
	height: number;
	radius?: number;
	bezelWidth?: number;
	glassBgOpacity?: number;
	specularOpacity?: number;
	specularSaturation?: number;
	refractionLevel?: number;
	blur?: number;
	className?: string;
	onClick?: () => void;
	children?: React.ReactNode;
}

export function DynamicLiquidGlass({
	width,
	height,
	radius = 21,
	bezelWidth = 18,
	glassBgOpacity = 0.05,
	specularOpacity = 0.4,
	specularSaturation = 1,
	refractionLevel = 0.2,
	blur = 1,
	className = "",
	onClick,
	children,
}: DynamicLiquidGlassProps) {
	const [filterId, setFilterId] = useState<string | null>(null);
	const [maps, setMaps] = useState<{ disp: string; spec: string } | null>(null);

	useEffect(() => {
		setFilterId(`lg-filter-${Math.random().toString(36).slice(2, 11)}`);

		const dispCanvas = document.createElement("canvas");
		const specCanvas = document.createElement("canvas");
		dispCanvas.width = specCanvas.width = width;
		dispCanvas.height = specCanvas.height = height;

		const dispCtx = dispCanvas.getContext("2d");
		const specCtx = specCanvas.getContext("2d");
		if (!dispCtx || !specCtx) return;

		const dispData = dispCtx.createImageData(width, height);
		const specData = specCtx.createImageData(width, height);
		const dispBuf = dispData.data;
		const specBuf = specData.data;

		const precomputedDisp = calculateDisplacementCurve(100, bezelWidth, 128);

		for (let i = 0; i < dispBuf.length; i += 4) {
			dispBuf[i] = dispBuf[i + 1] = dispBuf[i + 2] = 128;
			dispBuf[i + 3] = 255;
			specBuf[i] = specBuf[i + 1] = specBuf[i + 2] = 255;
			specBuf[i + 3] = 0;
		}

		const radSq = radius ** 2;
		const radPlusSq = (radius + 1) ** 2;
		const radMinusSq = (radius - bezelWidth) ** 2;
		const wBetween = Math.max(0, width - radius * 2);
		const hBetween = Math.max(0, height - radius * 2);
		const specVec = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];

		for (let y1 = 0; y1 < height; y1++) {
			for (let x1 = 0; x1 < width; x1++) {
				const x = x1 < radius ? x1 - radius : x1 >= width - radius ? x1 - radius - wBetween : 0;
				const y = y1 < radius ? y1 - radius : y1 >= height - radius ? y1 - radius - hBetween : 0;
				const distSq = x * x + y * y;

				if (distSq <= radPlusSq && distSq >= radMinusSq) {
					const idx = (y1 * width + x1) * 4;
					const distFromCenter = Math.sqrt(distSq);
					const distFromSide = radius - distFromCenter;
					const opacity = distSq < radSq ? 1 : 1 - (distFromCenter - radius);
					const cos = distFromCenter === 0 ? 0 : x / distFromCenter;
					const sin = distFromCenter === 0 ? 0 : y / distFromCenter;

					const bIdx = Math.max(0, Math.min(127, Math.floor((distFromSide / bezelWidth) * 128)));
					const distance = precomputedDisp[bIdx] || 0;
					const dX = (-cos * distance) / 83;
					const dY = (-sin * distance) / 83;

					dispBuf[idx] = Math.max(0, Math.min(255, 128 + dX * 128));
					dispBuf[idx + 1] = Math.max(0, Math.min(255, 128 + dY * 128));

					const sinSpec = distFromCenter === 0 ? 0 : -y / distFromCenter;
					const dot = Math.abs(cos * specVec[0] + sinSpec * specVec[1]);
					const coef = dot * Math.sqrt(Math.max(0, 1 - (1 - distFromSide) ** 2));

					specBuf[idx + 3] = Math.max(0, Math.min(255, 255 * coef * coef * opacity));
				}
			}
		}

		dispCtx.putImageData(dispData, 0, 0);
		specCtx.putImageData(specData, 0, 0);

		setMaps({
			disp: dispCanvas.toDataURL("image/png"),
			spec: specCanvas.toDataURL("image/png"),
		});
	}, [width, height, radius, bezelWidth]);

	if (!filterId || !maps) {
		return <div style={{ width, height, borderRadius: radius, contain: "paint" }} className={className} />;
	}

	return (
		<div className={className} style={{ width, height, contain: "paint" }} onClick={onClick}>
			<svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} colorInterpolationFilters="sRGB">
				<defs>
					<filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred_source" />
						<feImage href={maps.disp} result="displacement_map" x="0" y="0" width={width} height={height} />
						<feDisplacementMap
							in="blurred_source"
							in2="displacement_map"
							scale={83 * refractionLevel}
							xChannelSelector="R"
							yChannelSelector="G"
							result="displaced"
						/>
						<feColorMatrix in="displaced" type="saturate" values={specularSaturation.toString()} result="displaced_saturated" />
						<feImage href={maps.spec} result="specular_layer" x="0" y="0" width={width} height={height} />
						<feComposite in="displaced_saturated" in2="specular_layer" operator="in" result="specular_saturated" />
						<feComponentTransfer in="specular_layer" result="specular_faded">
							<feFuncA type="linear" slope={specularOpacity} />
						</feComponentTransfer>
						<feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation" />
						<feBlend in="specular_faded" in2="withSaturation" mode="normal" />
					</filter>
				</defs>
			</svg>

			<div
				style={{
					position: "absolute",
					inset: 0,
					clipPath: `inset(0px round ${radius}px)`,
					WebkitClipPath: `inset(0px round ${radius}px)`,
					transform: "translateZ(0)",
					isolation: "isolate",
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						backdropFilter: `url(#${filterId})`,
						WebkitBackdropFilter: `url(#${filterId})`,
						backgroundColor: `rgba(255, 255, 255, ${glassBgOpacity})`,
						boxShadow: "0 4px 20px rgba(0, 0, 0, 0.16)",
					}}
				/>
			</div>

			<div
				style={{
					position: "absolute",
					inset: 0,
					borderRadius: radius,
					zIndex: 1,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{children}
			</div>
		</div>
	);
}
