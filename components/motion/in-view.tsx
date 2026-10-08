"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { nextInViewState } from "@/components/motion/in-view-policy";

type InViewProps = {
  children: ReactNode;
  className?: string;
  role?: string;
  "aria-label"?: string;
  id?: string;
  "data-testid"?: string;
};

function paint(element: HTMLElement, reduced: boolean, visible: boolean) {
  const state = nextInViewState(reduced, visible);
  element.toggleAttribute("data-armed", state.armed);
  element.toggleAttribute("data-inview", state.inview);
}

/** Liga a entrada quando o bloco entra na tela. Ouve se o movimento reduzido muda depois. */
export function InView({ children, className, role, id, "aria-label": ariaLabel, "data-testid": testId }: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;
    let visible = false;

    const connect = () => {
      observer?.disconnect();
      observer = null;
      if (media.matches) {
        paint(element, true, false);
        return;
      }
      observer = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        paint(element, false, visible);
      }, { threshold: 0.35 });
      observer.observe(element);
    };

    connect();
    media.addEventListener("change", connect);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", connect);
    };
  }, []);

  return (
    <div ref={ref} className={className} role={role} aria-label={ariaLabel} id={id} data-testid={testId}>
      {children}
    </div>
  );
}
