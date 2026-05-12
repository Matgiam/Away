export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "played_100_notes",
    name: "Played One Hundred Notes",
    description: "Play 100 notes in total",
    icon: "/icons/piano.svg",
  },
  {
    id: "played_500_notes",
    name: "Played Five Hundred Notes",
    description: "Play 500 notes in total",
    icon: "/icons/piano.svg",
  },
  {
    id: "played_1000_notes",
    name: "Played One Thousand Notes",
    description: "Play 1,000 notes in total",
    icon: "/icons/piano.svg",
  },
];

const ACHIEVEMENTS_KEY = "away:unlocked_achievements";
const EQUIPPED_KEY = "away:equipped_badge";
const TOTAL_NOTES_KEY = "away:total_notes";

export function getTotalNotes(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(TOTAL_NOTES_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function incrementTotalNotes(count: number = 1): number {
  if (typeof window === "undefined") return 0;
  const current = getTotalNotes();
  const next = current + count;
  try {
    localStorage.setItem(TOTAL_NOTES_KEY, String(next));
  } catch {}
  // console.log(`[Notes] ${next} total notes played`);
  return next;
}

export function getUnlockedAchievements(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked));
  } catch {}
  return true;
}

export function getEquippedBadge(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(EQUIPPED_KEY);
  } catch {
    return null;
  }
}

export function setEquippedBadge(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(EQUIPPED_KEY, id);
    } else {
      localStorage.removeItem(EQUIPPED_KEY);
    }
  } catch {}
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

export function checkAndUnlockAchievements(totalNotes?: number): Achievement[] {
  const notes = totalNotes ?? getTotalNotes();
  const unlocked = getUnlockedAchievements();
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlocked.includes(achievement.id)) continue;
    let earned = false;
    if (achievement.id === "played_100_notes" && notes >= 100) {
      earned = true;
    } else if (achievement.id === "played_500_notes" && notes >= 500) {
      earned = true;
    } else if (achievement.id === "played_1000_notes" && notes >= 1000) {
      earned = true;
    }
    if (earned) {
      if (unlockAchievement(achievement.id)) {
        newlyUnlocked.push(achievement);
      }
    }
  }

  return newlyUnlocked;
}
