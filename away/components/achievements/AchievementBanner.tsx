"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Achievement } from "@/lib/achievements";

interface Props {
  achievement: Achievement;
  onDismiss: () => void;
}

export function AchievementBanner({ achievement, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { y: -120, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
        onComplete: () => {
          gsap.to(el, {
            y: -120,
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
            delay: 3,
            onComplete: onDismiss,
          });
        },
      }
    );
  }, []);

  return (
    <div
      ref={ref}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a0118]/90 backdrop-blur-xl px-6 py-4 shadow-2xl">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
          <img src={achievement.icon} alt="" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <p className="text-white/50 text-xs uppercase tracking-widest font-medium">Achievement Unlocked</p>
          <p className="text-white text-lg font-semibold">{achievement.name}</p>
          <p className="text-white/40 text-sm">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}
