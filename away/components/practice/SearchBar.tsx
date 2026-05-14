"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

interface SearchBarProps {
	value: string;
	onChange: (next: string) => void;
	placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search your song" }: SearchBarProps) {
	return (
		<DynamicLiquidGlass width={300} height={64} radius={16} refractionLevel={0.7} specularOpacity={0.5} glassBgOpacity={0.02}>
			<div className="flex h-full w-full items-center px-5 gap-3">
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={placeholder}
					className="flex-1 bg-transparent border-0 outline-none text-white placeholder:italic placeholder:text-white/45 text-base"
				/>
				<button
					type="button"
					onClick={() => onChange(value)}
					className="text-white/60 hover:text-white transition-colors"
					aria-label="Search"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
						<path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
					</svg>
				</button>
			</div>
		</DynamicLiquidGlass>
	);
}
