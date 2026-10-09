import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legalPagesPublished } from "../marketing/flags";
import { legalTableOfContents, type LegalTocItem } from "./headings";
import { assertLegalPublicationAllowed } from "./publish";

const FILES = {
  termos: "termos.md",
  privacidade: "privacidade.md",
} as const;

export type LegalDocumentName = keyof typeof FILES;

export function legalContentDir(): string {
  const override = process.env.LEGAL_CONTENT_DIR?.trim();
  if (override) return override;
  return join(process.cwd(), "content", "legal");
}

export function loadLegalDocument(name: LegalDocumentName): { markdown: string; toc: LegalTocItem[] } {
  const file = join(legalContentDir(), FILES[name]);
  const markdown = readFileSync(file, "utf8");
  assertLegalPublicationAllowed(markdown, legalPagesPublished(), file);
  return { markdown, toc: legalTableOfContents(markdown) };
}
