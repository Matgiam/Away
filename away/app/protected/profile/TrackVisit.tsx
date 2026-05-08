"use client";

import { useEffect } from "react";
import { incrementConnexions } from "@/lib/stats";

export function TrackVisit({ userId }: { userId: string }) {
  useEffect(() => {
    const key = "away_visit_counted";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    incrementConnexions(userId);
  }, [userId]);

  return null;
}
