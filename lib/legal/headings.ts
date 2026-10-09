/** Id estável a partir do número do título: "5-A." → "5-a", "5." → "5", "4.1." → "4-1". */
export function legalHeadingId(text: string): string | null {
  const match = text.trim().match(/^(\d+(?:[.-][A-Za-z0-9]+)*)\./);
  if (!match?.[1]) return null;
  return match[1].toLowerCase().replace(/\./g, "-");
}

export type LegalTocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

/** Sumário só com seções numeradas (## e ###). O título da página fica de fora. */
export function legalTableOfContents(markdown: string): LegalTocItem[] {
  const items: LegalTocItem[] = [];
  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})[ \t]+(.+?)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    const text = match[2].replace(/[*_`]/g, "").trim();
    const id = legalHeadingId(text);
    if (!id) continue;
    items.push({ id, text, level: match[1].length === 2 ? 2 : 3 });
  }
  return items;
}
