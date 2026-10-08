"use client";

/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { useEffect, useRef } from "react";
import { cssDurationMs, splitRollingText } from "@/components/motion/rolling-format";
import { shouldStartInViewAnimation } from "@/components/motion/in-view-policy";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** Rola os dígitos com WAAPI. A primeira pintura já mostra o valor final, vindo do servidor. */
export function RollingNumberMotion({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!shouldStartInViewAnimation(media.matches)) return;

    let animations: Animation[] = [];
    const stop = () => {
      for (const animation of animations) animation.cancel();
      animations = [];
    };

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (media.matches) return;
      const style = getComputedStyle(document.documentElement);
      const ease = style.getPropertyValue("--ease-out-quint").trim() || "cubic-bezier(0.22, 1, 0.36, 1)";
      const duration = cssDurationMs(style.getPropertyValue("--dur-3"), 560);
      root.querySelectorAll<HTMLElement>("[data-digit]").forEach((strip, index) => {
        const digit = Number(strip.dataset.digit);
        if (!Number.isFinite(digit) || digit <= 0) return;
        animations.push(strip.animate(
          [
            { transform: "translateY(0)" },
            { transform: `translateY(calc(${digit} * -1em))` },
          ],
          { duration, delay: index * 40, easing: ease, fill: "forwards" },
        ));
      });
    }, { threshold: 0.4 });

    observer.observe(root);
    const onChange = () => {
      if (!media.matches) return;
      observer.disconnect();
      stop();
    };
    media.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onChange);
      stop();
    };
  }, [text]);

  return (
    <span ref={ref} aria-hidden="true" className="inline-flex items-baseline">
      {splitRollingText(text).map((part, index) => part.type === "digit" ? (
        <span key={index} className="roll-window">
          <span className="roll-strip" data-digit={part.digit}>
            {DIGITS.map((digit) => <span key={digit}>{digit}</span>)}
          </span>
        </span>
      ) : (
        <span key={index} className="roll-mark">{part.char}</span>
      ))}
    </span>
  );
}
