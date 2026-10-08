"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? "");
  const baseId = useId();

  return (
    <div className="divide-y divide-line rounded-frame border border-line bg-surface">
      {items.map((item) => {
        const open = openId === item.id;
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id} className="px-4 sm:px-5">
            <h3>
              <button
                id={buttonId}
                type="button"
                className="flex min-h-[52px] w-full items-center justify-between gap-4 py-3 text-left font-display text-base font-bold text-ink"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? "" : item.id)}
              >
                {item.question}
                <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-muted transition-transform motion-reduce:transition-none", open && "rotate-180")} />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open}>
              <p className="pb-4 text-[15px] leading-relaxed text-pretty text-muted">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
