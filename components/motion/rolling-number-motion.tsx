"use client";

/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { useEffect, useRef, type ReactNode } from "react";
import { cssDurationMs } from "@/components/motion/rolling-format";
import { shouldStartInViewAnimation } from "@/components/motion/in-view-policy";

/** Rola os dígitos que o servidor já pintou no valor final. */
export function RollingNumberMotion({ text, children }: { text: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;
    let animations: Animation[] = [];

    const stop = () => {
      for (const animation of animations) animation.cancel();
      animations = [];
    };

    const play = () => {
      stop();
      if (!shouldStartInViewAnimation(media.matches)) return;
      const style = getComputedStyle(document.documentElement);
      const ease = style.getPropertyValue("--ease-out-quint").trim() || "cubic-bezier(0.22, 1, 0.36, 1)";
      const duration = cssDurationMs(style.getPropertyValue("--dur-3"), 560);
      root.querySelectorAll<HTMLElement>("[data-digit]").forEach((strip, index) => {
        const digit = Number(strip.dataset.digit);
        if (!Number.isFinite(digit) || digit <= 0) return;
        animations.push(strip.animate(
          [
            { transform: `translateY(calc(${digit} * -1em))` },
            { transform: `translateY(calc(${digit + 10} * -1em))` },
          ],
          { duration, delay: index * 40, easing: ease, fill: "forwards" },
        ));
      });
    };

    const connect = () => {
      observer?.disconnect();
      stop();
      if (!shouldStartInViewAnimation(media.matches)) return;
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        play();
      }, { threshold: 0.4 });
      observer.observe(root);
    };

    connect();
    media.addEventListener("change", connect);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", connect);
      stop();
    };
  }, [text]);

  return (
    <span ref={ref} aria-hidden="true" className="inline-flex items-baseline">
      {children}
    </span>
  );
}
