import type { FaqItem } from "@/lib/marketing/landing-copy";

export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-frame border border-line bg-surface">
      {items.map((item, index) => (
        <details key={item.id} name="perguntas" open={index === 0} className="group px-4 sm:px-5">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left font-display text-base font-bold text-ink [&::-webkit-details-marker]:hidden">
            {item.question}
            <Chevron />
          </summary>
          <p className="pb-4 text-[15px] leading-relaxed text-pretty text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none">
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
