"use client";

import { useState } from "react";
import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface StartButtonProps {
	onClick: () => void;
	disabled?: boolean;
	label?: string;
}

export function StartButton({ onClick, disabled = false, label = "Start" }: StartButtonProps) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			className={`transition-transform ${disabled ? "opacity-40 cursor-not-allowed" : "hover:scale-105 cursor-pointer"}`}
			aria-disabled={disabled}
		>
			<DynamicLiquidGlass
				width={170}
				height={64}
				radius={14}
				refractionLevel={0.8}
				specularOpacity={0.7}
				glassBgOpacity={!disabled && hovered ? 0.1 : 0.02}
			>
				<span className="text-white text-xl font-medium tracking-wide italic">{label}</span>
			</DynamicLiquidGlass>
		</button>
	);
}
