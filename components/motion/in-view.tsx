"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { shouldStartInViewAnimation } from "@/components/motion/in-view-policy";

type InViewProps = {
  children: ReactNode;
  className?: string;
  role?: string;
  "aria-label"?: string;
  id?: string;
  "data-testid"?: string;
};

/** Liga `data-inview` quando o bloco entra na tela e o movimento é permitido. */
export function InView({ children, className, role, id, "aria-label": ariaLabel, "data-testid": testId }: InViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!shouldStartInViewAnimation(media.matches)) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (media.matches) return;
      element.setAttribute("data-inview", "");
      observer.disconnect();
    }, { threshold: 0.35 });

    observer.observe(element);
    const onChange = () => {
      if (!media.matches) return;
      element.removeAttribute("data-inview");
      observer.disconnect();
    };
    media.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <div ref={ref} className={className} role={role} aria-label={ariaLabel} id={id} data-testid={testId}>
      {children}
    </div>
  );
}
