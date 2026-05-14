"use client";

import { DynamicLiquidGlass } from "@/components/effects/DynamicLiquidglass";

export type PracticeTab = "courses" | "songs" | "import";

interface PracticeTabsProps {
	active: PracticeTab;
	onChange: (tab: PracticeTab) => void;
}

const TABS: { key: PracticeTab; label: string }[] = [
	{ key: "courses", label: "Courses" },
	{ key: "songs", label: "Songs" },
	{ key: "import", label: "Import MIDI" },
];

export function PracticeTabs({ active, onChange }: PracticeTabsProps) {
	return (
		<div className="flex items-center gap-3">
			{TABS.map((tab) => {
				const isActive = tab.key === active;
				const width = tab.key === "import" ? 196 : 96;
				return (
					<button
						key={tab.key}
						onClick={() => onChange(tab.key)}
						className="transition-transform hover:scale-105"
						aria-pressed={isActive}
					>
						<DynamicLiquidGlass
							width={width}
							height={72}
							radius={14}
							refractionLevel={0.8}
							specularOpacity={0.6}
							glassBgOpacity={isActive ? 0.12 : 0.02}
						>
							<div
								className={`flex h-full w-full items-center justify-center gap-2 px-4 ${
									isActive ? "text-white" : "text-white/70"
								}`}
							>
								{tab.key === "import" ? (
									<>
										<span className="text-base font-medium tracking-wide">Import MIDI</span>
										<PracticeIcon name={tab.key} />
									</>
								) : (
									<div className="flex flex-col items-center gap-1">
										<PracticeIcon name={tab.key} />
										<span className="text-xs tracking-wide">{tab.label}</span>
									</div>
								)}
							</div>
						</DynamicLiquidGlass>
					</button>
				);
			})}
		</div>
	);
}

function PracticeIcon({ name }: { name: PracticeTab }) {
	if (name === "courses") {
		return (
			<svg width="26" height="22" viewBox="0 0 26 22" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect x="1" y="3" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
				<path d="M1 8H25" stroke="currentColor" strokeWidth="1.4" />
				<path d="M1 14H25" stroke="currentColor" strokeWidth="1.4" />
			</svg>
		);
	}
	if (name === "songs") {
		return (
			<svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M7 17.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.5" />
				<path d="M10 14.5V3.5l8-2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			</svg>
		);
	}
	return (
		<svg width="32" height="20" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg">
			<rect x="1" y="1" width="30" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
			<path d="M7 1V14H10V1" stroke="currentColor" strokeWidth="1.3" />
			<path d="M14 1V14H17V1" stroke="currentColor" strokeWidth="1.3" />
			<path d="M21 1V14H24V1" stroke="currentColor" strokeWidth="1.3" />
		</svg>
	);
}
