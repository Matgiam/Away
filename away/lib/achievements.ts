// ============================================================================
// achievements.ts
// ----------------------------------------------------------------------------
// The whole achievement system, in one place:
//
//   * The 21 achievement definitions (5 tiers across 4 categories + 1 ultimate).
//   * localStorage-backed counters (total notes played, time on site, courses
//     and songs completed).
//   * Unlock detection (`checkAndUnlockAchievements`) — call after any stat
//     change and the function returns the achievements that crossed their
//     threshold this tick. Window events fire so the AchievementBanner can
//     pop a toast and the AchievementGrid can refresh.
//   * Badge equip / unequip helpers — the chosen badge sits next to the
//     username in chat / room lists.
//
// Counters live in localStorage and are NOT cross-device. The server-side
// `user_stats` row (Supabase) is the cross-device source of truth for notes
// played and time played — see `lib/stats.ts`. The functions here are the
// per-device cache so milestones can fire immediately during a session.
// ============================================================================

import {
  CLOCK_ICONS,
  MEDAL_ICONS,
  NOTE_ICONS,
  PIANO_ICONS,
  ULTIMATE_ICONS,
  type AchievementIconComponent,
} from "./icons";

// Five buckets the UI uses to group achievements.
//   notes   — running counter of MIDI notes played
//   time    — seconds spent on the site
//   courses — number of distinct courses finished
//   songs   — number of distinct songs finished
//   master  — gated meta-achievement; counts how many OTHER achievements are unlocked
export type AchievementCategory = "notes" | "time" | "courses" | "songs" | "master";

// One achievement definition. `threshold` is the numeric value the user has
// to reach in `getCategoryProgress(category)` to unlock it.
export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: AchievementIconComponent;
  category: AchievementCategory;
  level: number;       // 1–5 within the category (or 1 for master)
  threshold: number;
  // Back-compat: equals `threshold` for notes-category achievements.
  noteThreshold?: number;
};

// Keep in sync with lib/courses/catalog.ts — the "finish every course" tier needs to match.
const TOTAL_COURSES = 32;
const TOTAL_NORMAL_ACHIEVEMENTS = 20; // sum across the four non-master categories (5×4)

// Category metadata for the UI. Labels are empty because the AchievementGrid
// shows category icons rather than text headers, but the keys still drive
// the column order.
export const ACHIEVEMENT_CATEGORIES: { key: AchievementCategory; label: string }[] = [
  { key: "notes", label: "" },
  { key: "time", label: "" },
  { key: "courses", label: "" },
  { key: "songs", label: "" },
  { key: "master", label: "" },
];

// The full achievement catalogue. Adding a new tier means appending here AND
// bumping TOTAL_NORMAL_ACHIEVEMENTS / the master threshold.
export const ACHIEVEMENTS: Achievement[] = [
  // ── Notes played ───────────────────────────────────────────────
  {
    id: "notes_100",
    name: "First Notes",
    description: "Play 100 notes in total",
    icon: PIANO_ICONS[0],
    category: "notes",
    level: 1,
    threshold: 100,
    noteThreshold: 100,
  },
  {
    id: "notes_1k",
    name: "Getting Started",
    description: "Play 1,000 notes in total",
    icon: PIANO_ICONS[1],
    category: "notes",
    level: 2,
    threshold: 1000,
    noteThreshold: 1000,
  },
  {
    id: "notes_10k",
    name: "Note Collector",
    description: "Play 10,000 notes in total",
    icon: PIANO_ICONS[2],
    category: "notes",
    level: 3,
    threshold: 10000,
    noteThreshold: 10000,
  },
  {
    id: "notes_100k",
    name: "Marathon Pianist",
    description: "Play 100,000 notes in total",
    icon: PIANO_ICONS[3],
    category: "notes",
    level: 4,
    threshold: 100000,
    noteThreshold: 100000,
  },
  {
    id: "notes_1m",
    name: "Million Notes",
    description: "Play 1,000,000 notes in total",
    icon: PIANO_ICONS[4],
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
    icon: CLOCK_ICONS[0],
    category: "time",
    level: 1,
    threshold: 600,
  },
  {
    id: "time_1h",
    name: "An Hour In",
    description: "Spend 1 hour on Away",
    icon: CLOCK_ICONS[1],
    category: "time",
    level: 2,
    threshold: 3600,
  },
  {
    id: "time_5h",
    name: "Frequent Visitor",
    description: "Spend 5 hours on Away",
    icon: CLOCK_ICONS[2],
    category: "time",
    level: 3,
    threshold: 18000,
  },
  {
    id: "time_25h",
    name: "Dedicated Player",
    description: "Spend 25 hours on Away",
    icon: CLOCK_ICONS[3],
    category: "time",
    level: 4,
    threshold: 90000,
  },
  {
    id: "time_100h",
    name: "Living Here",
    description: "Spend 100 hours on Away",
    icon: CLOCK_ICONS[4],
    category: "time",
    level: 5,
    threshold: 360000,
  },

  // ── Courses finished ───────────────────────────────────────────
  {
    id: "courses_1",
    name: "First Lesson",
    description: "Finish 1 course",
    icon: MEDAL_ICONS[0],
    category: "courses",
    level: 1,
    threshold: 1,
  },
  {
    id: "courses_5",
    name: "Eager Learner",
    description: "Finish 5 courses",
    icon: MEDAL_ICONS[1],
    category: "courses",
    level: 2,
    threshold: 5,
  },
  {
    id: "courses_10",
    name: "Course Hunter",
    description: "Finish 10 courses",
    icon: MEDAL_ICONS[2],
    category: "courses",
    level: 3,
    threshold: 10,
  },
  {
    id: "courses_20",
    name: "Almost There",
    description: "Finish 20 courses",
    icon: MEDAL_ICONS[3],
    category: "courses",
    level: 4,
    threshold: 20,
  },
  {
    id: "courses_all",
    name: "Master Student",
    description: "Finish every course",
    icon: MEDAL_ICONS[4],
    category: "courses",
    level: 5,
    threshold: TOTAL_COURSES,
  },

  // ── Songs finished ─────────────────────────────────────────────
  {
    id: "songs_1",
    name: "First Song",
    description: "Finish 1 song",
    icon: NOTE_ICONS[0],
    category: "songs",
    level: 1,
    threshold: 1,
  },
  {
    id: "songs_5",
    name: "Song Explorer",
    description: "Finish 5 songs",
    icon: NOTE_ICONS[1],
    category: "songs",
    level: 2,
    threshold: 5,
  },
  {
    id: "songs_10",
    name: "Repertoire",
    description: "Finish 10 songs",
    icon: NOTE_ICONS[2],
    category: "songs",
    level: 3,
    threshold: 10,
  },
  {
    id: "songs_25",
    name: "Performer",
    description: "Finish 25 songs",
    icon: NOTE_ICONS[3],
    category: "songs",
    level: 4,
    threshold: 25,
  },
  {
    id: "songs_50",
    name: "Concertist",
    description: "Finish 50 songs",
    icon: NOTE_ICONS[4],
    category: "songs",
    level: 5,
    threshold: 50,
  },

  // ── Mastery (unlocked after all 20 above) ──────────────────────
  {
    id: "master_all",
    name: "Away Legend",
    description: "Unlock all 20 achievements",
    icon: ULTIMATE_ICONS[0],
    category: "master",
    level: 1,
    threshold: TOTAL_NORMAL_ACHIEVEMENTS,
  },
];

// localStorage keys — kept private; callers use the helpers below.
const ACHIEVEMENTS_KEY = "away:unlocked_achievements";
const EQUIPPED_KEY = "away:equipped_badge";
const TOTAL_NOTES_KEY = "away:total_notes";
const TOTAL_SECONDS_KEY = "away:total_seconds";
const COMPLETED_COURSES_KEY = "away:completed_courses";
const COMPLETED_SONGS_KEY = "away:completed_songs";

// Public window-event names so other components can react without coupling
// directly to this module.
export const ACHIEVEMENT_UNLOCK_EVENT = "away:achievement-unlocked";
export const BADGE_EQUIP_EVENT = "away:badge-equipped";

// --- Tiny typed wrappers around localStorage --------------------------------
// All four functions tolerate SSR (no window) and storage failures (quota,
// private browsing) so the callers can stay sync-only without try/catch.

function readNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(key)) || 0; // NaN/null → 0
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
    // Defensive: filter to strings so a corrupted entry can't crash callers.
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

// --- Notes counter ----------------------------------------------------------

export function getTotalNotes(): number {
  return readNumber(TOTAL_NOTES_KEY);
}

// Floor + clamp so the counter can't go negative or fractional even if
// somebody hand-edits localStorage.
export function setTotalNotes(value: number): void {
  writeNumber(TOTAL_NOTES_KEY, Math.max(0, Math.floor(value)));
}

// Returns the new total so callers can immediately compare against thresholds.
export function incrementTotalNotes(count: number = 1): number {
  const next = getTotalNotes() + count;
  writeNumber(TOTAL_NOTES_KEY, next);
  return next;
}

// --- Time counter -----------------------------------------------------------

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

// --- Completion sets --------------------------------------------------------

export function getCompletedCourses(): string[] {
  return readJsonArray(COMPLETED_COURSES_KEY);
}

// Returns false when the course was already completed (no state change),
// true if this is the first time. Caller can use the bool to decide whether
// to fire confetti / re-check unlocks.
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

// --- Achievement unlock state ----------------------------------------------

export function getUnlockedAchievements(): string[] {
  return readJsonArray(ACHIEVEMENTS_KEY);
}

// Returns false if already unlocked; true on first unlock.
export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  writeJsonArray(ACHIEVEMENTS_KEY, unlocked);
  return true;
}

// --- Equipped badge ---------------------------------------------------------

export function getEquippedBadge(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(EQUIPPED_KEY);
  } catch {
    return null;
  }
}

// Equip / unequip (null) the badge displayed next to the username everywhere.
// Fires a window event so the BadgedUsername component re-renders without
// needing a top-down state update.
export function setEquippedBadge(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(EQUIPPED_KEY, id);
    } else {
      localStorage.removeItem(EQUIPPED_KEY);
    }
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent<string | null>(BADGE_EQUIP_EVENT, { detail: id }));
  } catch {}
}

// --- Lookups ---------------------------------------------------------------

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

// Single function for "where does the user currently stand in this category?".
// Master is special — its progress is the count of OTHER unlocked achievements.
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

// Wraps the window-event dispatch so we never throw out of the unlock loop.
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

  // First pass: every non-master achievement.
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

  // Dispatch toasts AFTER all unlocks resolve so the master badge isn't
  // shown before the achievement that triggered it.
  for (const a of newlyUnlocked) dispatchUnlock(a);
  return newlyUnlocked;
}

// Back-compat for ProfileModal — shows what a player has earned based solely on the server-side
// notes-played stat. Other categories live in localStorage and aren't synced across devices.
export function getUnlockedAchievementIdsForNotes(totalNotes: number): string[] {
  return ACHIEVEMENTS.filter((a) => a.category === "notes" && totalNotes >= a.threshold).map((a) => a.id);
}
