"use client";

import { useState, useRef } from "react";
import { ACHIEVEMENTS, getUnlockedAchievements, getEquippedBadge, setEquippedBadge } from "@/lib/achievements";

export function AchievementGrid() {
  const [unlocked] = useState<string[]>(getUnlockedAchievements);
  const [equipped, setEquipped] = useState<string | null>(getEquippedBadge);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleToggle = (id: string) => {
    if (equipped === id) {
      setEquippedBadge(null);
      setEquipped(null);
    } else {
      setEquippedBadge(id);
      setEquipped(id);
    }
  };

  const showTooltip = (id: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredId(id);
  };

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => setHoveredId(null), 100);
  };

  return (
    <div className="flex flex-wrap gap-3">
      {ACHIEVEMENTS.length === 0 && (
        <p className="text-white/30 text-sm italic">No achievements yet.</p>
      )}
      {ACHIEVEMENTS.map((ach) => {
        const isUnlocked = unlocked.includes(ach.id);
        const isEquipped = equipped === ach.id;
        return (
          <div key={ach.id} className="relative">
            <button
              onClick={isUnlocked ? () => handleToggle(ach.id) : undefined}
              disabled={!isUnlocked}
              onMouseEnter={() => showTooltip(ach.id)}
              onMouseLeave={hideTooltip}
              className={`w-30 h-30 rounded-2xl border flex items-center justify-center transition-all ${
                isEquipped
                  ? "border-white/20 bg-white/[0.06]"
                  : isUnlocked
                    ? "border-white/8 bg-[#0a0118]/70 backdrop-blur-xl hover:bg-white/[0.04] cursor-pointer"
                    : "border-white/5 bg-white/[0.01] opacity-30"
              }`}
            >
              <img
                src={ach.icon}
                alt=""
                className={`w-8 h-8 object-contain ${isUnlocked ? "" : "grayscale opacity-40"}`}
              />
            </button>

            {hoveredId === ach.id && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
                onMouseEnter={() => showTooltip(ach.id)}
                onMouseLeave={hideTooltip}
              >
                <div className="rounded-xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl px-4 py-3 shadow-2xl whitespace-nowrap">
                  <p className="text-white text-sm font-semibold">{isUnlocked ? ach.name : "???"}</p>
                  <p className="text-white/40 text-xs mt-0.5">{isUnlocked ? ach.description : "Achievement locked"}</p>
                  {isEquipped && <p className="text-white/30 text-[10px] uppercase tracking-widest mt-1.5">Equipped</p>}
                  {isUnlocked && !isEquipped && <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1.5">Click to equip</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
