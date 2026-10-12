import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brandColors } from "@/lib/brand/colors";
import { slotLinkOgLines, type SlotLinkPreviewView } from "./preview";

function lineLook(line: string) {
  const accent = line === "Sinal no Pix" || line === "Agende pelo AgendaPix";
  return {
    fontSize: accent ? 36 : line.length > 28 ? 44 : 56,
    color: accent ? brandColors.pix : brandColors.ink,
  };
}

function toArrayBuffer(data: Buffer): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function loadFonts() {
  const [fontBold, fontExtraBold, icon] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-700.ttf")),
    readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-800.ttf")),
    readFile(join(process.cwd(), "public/icon-512.png")),
  ]);
  return {
    fonts: [
      { name: "Plus Jakarta Sans", data: toArrayBuffer(fontBold), style: "normal" as const, weight: 700 as const },
      { name: "Plus Jakarta Sans", data: toArrayBuffer(fontExtraBold), style: "normal" as const, weight: 800 as const },
    ],
    iconSrc: `data:image/png;base64,${icon.toString("base64")}`,
  };
}

/** Cartão 1200×630. `lines` troca o texto; o padrão segue o kind. */
export async function renderSlotLinkOg(preview: SlotLinkPreviewView, lines: readonly string[] = slotLinkOgLines(preview)) {
  const { fonts, iconSrc } = await loadFonts();
  const logo = preview.logoUrl && /^https:\/\//.test(preview.logoUrl) ? preview.logoUrl : iconSrc;
  const [title, ...rest] = lines;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: brandColors.paper,
          padding: "72px 80px",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Satori só desenha <img>. A logo da loja, quando existe, substitui o ícone. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={88} height={88} alt="" style={{ borderRadius: 24, objectFit: "cover" }} />
          <div style={{ display: "flex", marginLeft: 28, fontSize: 42, fontWeight: 800, color: brandColors.ink, letterSpacing: -0.8 }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
          {rest.map((line) => (
            <div
              key={line}
              style={{
                display: "flex",
                fontSize: lineLook(line).fontSize,
                fontWeight: 700,
                color: lineLook(line).color,
                marginTop: 12,
                letterSpacing: -1,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
