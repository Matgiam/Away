"use client";

import { useState } from "react";
import { getEquippedBadge, getAchievement } from "@/lib/achievements";

export function BadgedUsername({ username }: { username: string }) {
  const [equipped] = useState<string | null>(getEquippedBadge);

  const badge = equipped ? getAchievement(equipped) : null;
  const Icon = badge?.icon;

  return (
    <span className="inline-flex items-center gap-2">
      {Icon && <Icon className="w-6 h-6 shrink-0" aria-hidden />}
      {username}
    </span>
  );
}
