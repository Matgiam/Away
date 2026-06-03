// ============================================================================
// achievements/BadgedUsername.tsx
// ----------------------------------------------------------------------------
// Renders a username with the user's currently-equipped achievement icon
// next to it. Listens to BADGE_EQUIP_EVENT so the badge updates everywhere
// the moment the user equips a different one — no page refresh needed.
//
// Used in chat, the room player list, and anywhere the user's name shows up.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import {
  BADGE_EQUIP_EVENT,
  getAchievement,
  getEquippedBadge,
} from "@/lib/achievements";

export function BadgedUsername({ username }: { username: string }) {
  const [equipped, setEquipped] = useState<string | null>(getEquippedBadge);

  // Stay in sync when the user equips/unequips a badge anywhere in the app — no refresh needed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setEquipped(detail ?? null);
    };
    window.addEventListener(BADGE_EQUIP_EVENT, onChange);
    return () => window.removeEventListener(BADGE_EQUIP_EVENT, onChange);
  }, []);

  const badge = equipped ? getAchievement(equipped) : null;
  const Icon = badge?.icon;

  return (
    <span className="inline-flex items-center gap-2">
      {Icon && <Icon className="w-6 h-6 shrink-0" aria-hidden />}
      {username}
    </span>
  );
}
