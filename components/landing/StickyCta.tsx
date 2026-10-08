"use client";

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLandingNavOpen, subscribeLandingNav } from "./nav-state";

const HEIGHT_VAR = "--sticky-cta-height";

export function StickyCta() {
  const menuOpen = useSyncExternalStore(subscribeLandingNav, getLandingNavOpen, () => false);
  const [heroGone, setHeroGone] = useState(false);
  const [finalVisible, setFinalVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-primary-cta");
    const finalCta = document.getElementById("cta-final");
    const footer = document.getElementById("rodape");
    if (!hero || !finalCta || !footer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target.id === "hero-primary-cta") setHeroGone(!entry.isIntersecting);
          if (entry.target.id === "cta-final") setFinalVisible(entry.isIntersecting);
          if (entry.target.id === "rodape") setFooterVisible(entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );

    observer.observe(hero);
    observer.observe(finalCta);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const read = () => {
      setNarrow(media.matches);
      const viewport = window.visualViewport;
      setKeyboardOpen(viewport ? viewport.height < window.innerHeight * 0.75 : false);
      const tag = document.activeElement?.tagName;
      setFieldFocused(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");
    };
    read();
    media.addEventListener("change", read);
    window.addEventListener("resize", read);
    window.addEventListener("focusin", read);
    window.addEventListener("focusout", read);
    window.visualViewport?.addEventListener("resize", read);
    return () => {
      media.removeEventListener("change", read);
      window.removeEventListener("resize", read);
      window.removeEventListener("focusin", read);
      window.removeEventListener("focusout", read);
      window.visualViewport?.removeEventListener("resize", read);
    };
  }, []);

  const visible = heroGone && !finalVisible && !footerVisible && !menuOpen && narrow && !keyboardOpen && !fieldFocused;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.setProperty(HEIGHT_VAR, "0px");
      return;
    }
    const bar = document.getElementById("sticky-cta");
    const apply = () => root.style.setProperty(HEIGHT_VAR, `${bar?.offsetHeight ?? 0}px`);
    apply();
    if (!bar) return;
    const resize = new ResizeObserver(apply);
    resize.observe(bar);
    return () => {
      resize.disconnect();
      root.style.setProperty(HEIGHT_VAR, "0px");
    };
  }, [visible]);

  return (
    <div
      id="sticky-cta"
      role="region"
      aria-label="Criar agenda"
      aria-hidden={!visible}
      inert={visible ? undefined : true}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/92 px-4 pt-3 backdrop-blur-[8px] md:hidden",
        "pb-[calc(12px+env(safe-area-inset-bottom))]",
        "transition-transform duration-[180ms] ease-[var(--ease-standard)] motion-reduce:transition-none",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <Link href="/onboarding" className={buttonVariants({ size: "lg", className: "w-full" })}>
        Criar minha agenda grátis
      </Link>
      <p className="mt-1.5 text-center text-[12px] text-muted">7 dias grátis · sem cartão</p>
    </div>
  );
}
