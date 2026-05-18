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
					<button key={tab.key} onClick={() => onChange(tab.key)} className="transition-transform hover:scale-105" aria-pressed={isActive}>
						<DynamicLiquidGlass
							width={width}
							height={72}
							radius={14}
							refractionLevel={0.8}
							specularOpacity={0.6}
							glassBgOpacity={isActive ? 0.12 : 0.02}
						>
							<div className={`flex h-full w-full items-center justify-center gap-2 px-4 ${isActive ? "text-white" : "text-white/70"}`}>
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
			<img
				src="/icons/courses.svg" 
				alt="Courses"
				width={26}
				height={22}
				className="object-contain" 
			/>
		);
	}
	if (name === "songs") {
		return (
			<img
				src="/icons/music.svg"
				alt="Songs"
				width={20}
				height={22}
				className="object-contain"
			/>
		);
	}
	return (
		<img
			src="/icons/MIDI.svg" 
			alt="Import MIDI"
			width={32}
			height={20}
			className="object-contain"
		/>
	);
}
