"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_UNLOCK_EVENT,
  getCategoryProgress,
  getUnlockedAchievements,
  getEquippedBadge,
  setEquippedBadge,
  type Achievement,
  type AchievementCategory,
} from "@/lib/achievements";

function formatSeconds(s: number): string {
  if (s <= 0) return "0s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatProgress(category: AchievementCategory, value: number, threshold: number): string {
  const clamped = Math.min(value, threshold);
  if (category === "notes") {
    return `${clamped.toLocaleString("en-US")} / ${threshold.toLocaleString("en-US")}`;
  }
  if (category === "time") {
    return `${formatSeconds(clamped)} / ${formatSeconds(threshold)}`;
  }
  return `${clamped} / ${threshold}`;
}

export function AchievementGrid() {
  const [unlocked, setUnlocked] = useState<string[]>(getUnlockedAchievements);
  const [equipped, setEquipped] = useState<string | null>(getEquippedBadge);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnlock = () => setUnlocked(getUnlockedAchievements());
    window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock);
  }, []);

  const handleToggle = (id: string) => {
    if (equipped === id) {
      setEquippedBadge(null);
      setEquipped(null);
    } else {
      setEquippedBadge(id);
      setEquipped(id);
    }
  };

  const showTooltip = (ach: Achievement) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredId(ach.id);
    setHoverProgress(getCategoryProgress(ach.category));
  };

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => setHoveredId(null), 100);
  };

  const renderBadge = (ach: Achievement, master: boolean) => {
    const isUnlocked = unlocked.includes(ach.id);
    const isEquipped = equipped === ach.id;
    const size = master ? "w-24 h-24" : "w-24 h-24";
    const iconSize = master ? "w-14 h-14" : "w-14 h-14";
    const Icon = ach.icon;

    const percent = Math.max(0, Math.min(100, (hoverProgress / ach.threshold) * 100));

    return (
      <div key={ach.id} className="relative">
        <button
          type="button"
          onClick={isUnlocked ? () => handleToggle(ach.id) : undefined}
          aria-disabled={!isUnlocked}
          onMouseEnter={() => showTooltip(ach)}
          onMouseLeave={hideTooltip}
          className={`${size} rounded-2xl border flex items-center justify-center transition-all ${
            master && isUnlocked
              ? "border-yellow-200/40 bg-gradient-to-br from-yellow-500/20 via-purple-500/15 to-pink-500/20 shadow-[0_0_30px_rgba(212,170,255,0.25)]"
              : isEquipped
                ? "border-white/20 bg-white/[0.06]"
                : isUnlocked
                  ? "border-white/8 bg-[#0a0118]/70 backdrop-blur-xl hover:bg-white/[0.04] cursor-pointer"
                  : "border-white/5 bg-white/[0.01] opacity-30 cursor-default"
          }`}
        >
          <Icon
            className={`${iconSize} ${isUnlocked ? "" : "grayscale opacity-40"}`}
            aria-hidden
          />
        </button>

        {hoveredId === ach.id && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
            onMouseEnter={() => showTooltip(ach)}
            onMouseLeave={hideTooltip}
          >
            <div className="rounded-xl border border-white/10 bg-[#0a0118]/95 backdrop-blur-xl px-4 py-3 shadow-2xl whitespace-nowrap min-w-[180px]">
              <p className="text-white text-sm font-semibold">{ach.name}</p>
              <p className="text-white/40 text-xs mt-0.5">{ach.description}</p>

              {!isUnlocked && (
                <div className="mt-2">
                  <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-400/80 to-pink-400/80 transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="text-white/50 text-[11px] mt-1 font-mono">
                    {formatProgress(ach.category, hoverProgress, ach.threshold)}
                  </p>
                </div>
              )}

              {isUnlocked && (
                <p className="text-emerald-300/80 text-[10px] uppercase tracking-widest mt-1.5">
                  Unlocked
                </p>
              )}
              {isEquipped && (
                <p className="text-white/30 text-[10px] uppercase tracking-widest mt-0.5">Equipped</p>
              )}
              {isUnlocked && !isEquipped && (
                <p className="text-white/20 text-[10px] uppercase tracking-widest mt-0.5">
                  Click to equip
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const normalAchievements = ACHIEVEMENTS.filter((a) => a.category !== "master");
  const masterAchievement = ACHIEVEMENTS.find((a) => a.category === "master");

  return (
    <div className="flex flex-col gap-3">
      {ACHIEVEMENTS.length === 0 && (
        <p className="text-white/30 text-sm italic">No achievements yet.</p>
      )}

      <div className="flex flex-wrap gap-3">
        {normalAchievements.map((ach) => renderBadge(ach, false))}
        {masterAchievement && <div className="pt-0">{renderBadge(masterAchievement, true)}</div>}
      </div>

      
    </div>
  );
}
