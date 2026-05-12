"use client";

import { useState } from "react";
import { getEquippedBadge, getAchievement } from "@/lib/achievements";

export function BadgedUsername({ username }: { username: string }) {
  const [equipped] = useState<string | null>(getEquippedBadge);

  const badge = equipped ? getAchievement(equipped) : null;

  return (
    <span className="inline-flex items-center gap-2">
      {badge && (
        <img src={badge.icon} alt="" className="w-5 h-5 object-contain" />
      )}
      {username}
    </span>
  );
}
