export type AchievementCategory = "notes" | "time" | "courses" | "songs" | "master";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  level: number;
  threshold: number;
  // Back-compat: equals `threshold` for notes-category achievements.
  noteThreshold?: number;
};

// Keep in sync with lib/courses/catalog.ts — the "finish every course" tier needs to match.
const TOTAL_COURSES = 32;
const TOTAL_NORMAL_ACHIEVEMENTS = 20;

export const ACHIEVEMENT_CATEGORIES: { key: AchievementCategory; label: string }[] = [
  { key: "notes", label: "" },
  { key: "time", label: "" },
  { key: "courses", label: "" },
  { key: "songs", label: "" },
  { key: "master", label: "" },
];

export const ACHIEVEMENTS: Achievement[] = [
  // ── Notes played ───────────────────────────────────────────────
  {
    id: "notes_100",
    name: "First Notes",
    description: "Play 100 notes in total",
    icon: "/icons/piano.svg",
    category: "notes",
    level: 1,
    threshold: 100,
    noteThreshold: 100,
  },
  {
    id: "notes_1k",
    name: "Getting Started",
    description: "Play 1,000 notes in total",
    icon: "/icons/piano.svg",
    category: "notes",
    level: 2,
    threshold: 1000,
    noteThreshold: 1000,
  },
  {
    id: "notes_10k",
    name: "Note Collector",
    description: "Play 10,000 notes in total",
    icon: "/icons/piano.svg",
    category: "notes",
    level: 3,
    threshold: 10000,
    noteThreshold: 10000,
  },
  {
    id: "notes_100k",
    name: "Marathon Pianist",
    description: "Play 100,000 notes in total",
    icon: "/icons/piano.svg",
    category: "notes",
    level: 4,
    threshold: 100000,
    noteThreshold: 100000,
  },
  {
    id: "notes_1m",
    name: "Million Notes",
    description: "Play 1,000,000 notes in total",
    icon: "/icons/piano.svg",
    category: "notes",
    level: 5,
    threshold: 1000000,
    noteThreshold: 1000000,
  },

  // ── Time on the website (in seconds) ───────────────────────────
  {
    id: "time_10m",
    name: "Quick Visit",
    description: "Spend 10 minutes on Away",
    icon: "/icons/piano.svg",
    category: "time",
    level: 1,
    threshold: 600,
  },
  {
    id: "time_1h",
    name: "An Hour In",
    description: "Spend 1 hour on Away",
    icon: "/icons/piano.svg",
    category: "time",
    level: 2,
    threshold: 3600,
  },
  {
    id: "time_5h",
    name: "Frequent Visitor",
    description: "Spend 5 hours on Away",
    icon: "/icons/piano.svg",
    category: "time",
    level: 3,
    threshold: 18000,
  },
  {
    id: "time_25h",
    name: "Dedicated Player",
    description: "Spend 25 hours on Away",
    icon: "/icons/piano.svg",
    category: "time",
    level: 4,
    threshold: 90000,
  },
  {
    id: "time_100h",
    name: "Living Here",
    description: "Spend 100 hours on Away",
    icon: "/icons/piano.svg",
    category: "time",
    level: 5,
    threshold: 360000,
  },

  // ── Courses finished ───────────────────────────────────────────
  {
    id: "courses_1",
    name: "First Lesson",
    description: "Finish 1 course",
    icon: "/icons/piano.svg",
    category: "courses",
    level: 1,
    threshold: 1,
  },
  {
    id: "courses_5",
    name: "Eager Learner",
    description: "Finish 5 courses",
    icon: "/icons/piano.svg",
    category: "courses",
    level: 2,
    threshold: 5,
  },
  {
    id: "courses_10",
    name: "Course Hunter",
    description: "Finish 10 courses",
    icon: "/icons/piano.svg",
    category: "courses",
    level: 3,
    threshold: 10,
  },
  {
    id: "courses_20",
    name: "Almost There",
    description: "Finish 20 courses",
    icon: "/icons/piano.svg",
    category: "courses",
    level: 4,
    threshold: 20,
  },
  {
    id: "courses_all",
    name: "Master Student",
    description: "Finish every course",
    icon: "/icons/piano.svg",
    category: "courses",
    level: 5,
    threshold: TOTAL_COURSES,
  },

  // ── Songs finished ─────────────────────────────────────────────
  {
    id: "songs_1",
    name: "First Song",
    description: "Finish 1 song",
    icon: "/icons/piano.svg",
    category: "songs",
    level: 1,
    threshold: 1,
  },
  {
    id: "songs_5",
    name: "Song Explorer",
    description: "Finish 5 songs",
    icon: "/icons/piano.svg",
    category: "songs",
    level: 2,
    threshold: 5,
  },
  {
    id: "songs_10",
    name: "Repertoire",
    description: "Finish 10 songs",
    icon: "/icons/piano.svg",
    category: "songs",
    level: 3,
    threshold: 10,
  },
  {
    id: "songs_25",
    name: "Performer",
    description: "Finish 25 songs",
    icon: "/icons/piano.svg",
    category: "songs",
    level: 4,
    threshold: 25,
  },
  {
    id: "songs_50",
    name: "Concertist",
    description: "Finish 50 songs",
    icon: "/icons/piano.svg",
    category: "songs",
    level: 5,
    threshold: 50,
  },

  // ── Mastery (unlocked after all 20 above) ──────────────────────
  {
    id: "master_all",
    name: "Away Legend",
    description: "Unlock all 20 achievements",
    icon: "/icons/logo.svg",
    category: "master",
    level: 1,
    threshold: TOTAL_NORMAL_ACHIEVEMENTS,
  },
];

const ACHIEVEMENTS_KEY = "away:unlocked_achievements";
const EQUIPPED_KEY = "away:equipped_badge";
const TOTAL_NOTES_KEY = "away:total_notes";
const TOTAL_SECONDS_KEY = "away:total_seconds";
const COMPLETED_COURSES_KEY = "away:completed_courses";
const COMPLETED_SONGS_KEY = "away:completed_songs";

export const ACHIEVEMENT_UNLOCK_EVENT = "away:achievement-unlocked";

function readNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

function readJsonArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, value: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getTotalNotes(): number {
  return readNumber(TOTAL_NOTES_KEY);
}

export function setTotalNotes(value: number): void {
  writeNumber(TOTAL_NOTES_KEY, Math.max(0, Math.floor(value)));
}

export function incrementTotalNotes(count: number = 1): number {
  const next = getTotalNotes() + count;
  writeNumber(TOTAL_NOTES_KEY, next);
  return next;
}

export function getTotalSeconds(): number {
  return readNumber(TOTAL_SECONDS_KEY);
}

export function setTotalSeconds(value: number): void {
  writeNumber(TOTAL_SECONDS_KEY, Math.max(0, Math.floor(value)));
}

export function incrementTotalSeconds(count: number = 1): number {
  const next = getTotalSeconds() + count;
  writeNumber(TOTAL_SECONDS_KEY, next);
  return next;
}

export function getCompletedCourses(): string[] {
  return readJsonArray(COMPLETED_COURSES_KEY);
}

export function markCourseCompleted(courseId: string): boolean {
  const list = getCompletedCourses();
  if (list.includes(courseId)) return false;
  list.push(courseId);
  writeJsonArray(COMPLETED_COURSES_KEY, list);
  return true;
}

export function getCompletedSongs(): string[] {
  return readJsonArray(COMPLETED_SONGS_KEY);
}

export function markSongCompleted(songId: string): boolean {
  const list = getCompletedSongs();
  if (list.includes(songId)) return false;
  list.push(songId);
  writeJsonArray(COMPLETED_SONGS_KEY, list);
  return true;
}

export function getUnlockedAchievements(): string[] {
  return readJsonArray(ACHIEVEMENTS_KEY);
}

export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  writeJsonArray(ACHIEVEMENTS_KEY, unlocked);
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
  if (typeof window === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(EQUIPPED_KEY, id);
    } else {
      localStorage.removeItem(EQUIPPED_KEY);
    }
  } catch {}
}

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

export function getCategoryProgress(category: AchievementCategory): number {
  switch (category) {
    case "notes":
      return getTotalNotes();
    case "time":
      return getTotalSeconds();
    case "courses":
      return getCompletedCourses().length;
    case "songs":
      return getCompletedSongs().length;
    case "master": {
      const unlocked = new Set(getUnlockedAchievements());
      return ACHIEVEMENTS.filter((a) => a.category !== "master" && unlocked.has(a.id)).length;
    }
  }
}

function dispatchUnlock(achievement: Achievement) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ACHIEVEMENT_UNLOCK_EVENT, { detail: achievement }));
  } catch {}
}

// Checks every category against current progress, unlocks any newly-earned achievements,
// dispatches a window event for each, and returns the list. The optional `totalNotes` arg is
// kept for backward compatibility — progress is always read from storage.
export function checkAndUnlockAchievements(_totalNotes?: number): Achievement[] {
  const unlocked = new Set(getUnlockedAchievements());
  const newlyUnlocked: Achievement[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (ach.category === "master") continue;
    if (unlocked.has(ach.id)) continue;
    if (getCategoryProgress(ach.category) >= ach.threshold) {
      if (unlockAchievement(ach.id)) {
        unlocked.add(ach.id);
        newlyUnlocked.push(ach);
      }
    }
  }

  // Master tier is gated on the others — check it after every other category has been resolved.
  for (const ach of ACHIEVEMENTS) {
    if (ach.category !== "master") continue;
    if (unlocked.has(ach.id)) continue;
    if (getCategoryProgress("master") >= ach.threshold) {
      if (unlockAchievement(ach.id)) {
        unlocked.add(ach.id);
        newlyUnlocked.push(ach);
      }
    }
  }

  for (const a of newlyUnlocked) dispatchUnlock(a);
  return newlyUnlocked;
}

// Back-compat for ProfileModal — shows what a player has earned based solely on the server-side
// notes-played stat. Other categories live in localStorage and aren't synced across devices.
export function getUnlockedAchievementIdsForNotes(totalNotes: number): string[] {
  return ACHIEVEMENTS.filter((a) => a.category === "notes" && totalNotes >= a.threshold).map((a) => a.id);
}
