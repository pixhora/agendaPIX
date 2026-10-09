"use client";

import { isValidElement, type ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { legalHeadingId, type LegalTocItem } from "@/lib/legal/headings";

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children);
  return "";
}

function Heading({ level, children }: { level: 2 | 3; children: ReactNode }) {
  const id = legalHeadingId(plainText(children));
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id ?? undefined} className={level === 2 ? "group mt-10 scroll-mt-24 font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink" : "group mt-6 scroll-mt-24 font-display text-xl font-bold leading-tight text-ink"}>
      {children}
      {id ? (
        <a
          href={`#${id}`}
          className="ml-2 text-muted opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:shadow-[var(--shadow-focus)]"
          aria-label={`Link da seção ${id}`}
        >
          #
        </a>
      ) : null}
    </Tag>
  );
}

const components: Components = {
  h1: ({ children }) => <h1 className="font-display text-[40px] font-extrabold leading-tight tracking-tight text-ink">{children}</h1>,
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  p: ({ children }) => <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-ink">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-ink">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink">{children}</ol>,
  li: ({ children }) => <li className="max-w-[65ch]">{children}</li>,
  a: ({ href, children }) => {
    const className = "font-semibold text-ink underline underline-offset-4 outline-none focus-visible:shadow-[var(--shadow-focus)]";
    if (href?.startsWith("/")) return <Link href={href} className={className}>{children}</Link>;
    const external = href?.startsWith("http");
    return (
      <a href={href} className={className} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="mt-4 border-l-4 border-pix pl-4 text-ink">{children}</blockquote>,
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm leading-relaxed">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line bg-subtle px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-line px-3 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-8 border-line" />,
};

export function LegalArticle({ markdown, toc }: { markdown: string; toc: LegalTocItem[] }) {
  return (
    <article>
      {toc.length > 0 ? (
        <nav aria-label="Nesta página" className="mt-8 rounded-card border border-line bg-surface px-4 py-4">
          <p className="font-display text-base font-bold text-ink">Nesta página</p>
          <ol className="mt-3 space-y-2">
            {toc.map((item) => (
              <li key={item.id} className={item.level === 3 ? "pl-4" : undefined}>
                <a href={`#${item.id}`} className="inline-flex min-h-11 items-center text-sm leading-snug text-ink underline-offset-4 outline-none hover:underline focus-visible:shadow-[var(--shadow-focus)]">
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
