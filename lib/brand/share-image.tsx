import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brandColors } from "@/lib/brand/colors";
import { sitePromise } from "@/lib/site";

export const shareImageSize = { width: 1200, height: 630 };
export const shareImageAlt = `AgendaPix. ${sitePromise}`;
/**
 * O ponto final de "pago." vira um glifo solto no Satori (vão maior que o das letras).
 * Só o cartão omite esse ponto. O texto da página e o alt continuam com ele.
 */
const shareTitle = sitePromise.replace(/\.$/u, "");
/** Cartão neutro da página do negócio. Sem nome, serviço ou horário (BE-08). */
export const neutralShareImageAlt = "AgendaPix. Agende online · sinal no Pix";

function toArrayBuffer(data: Buffer): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function loadShareAssets() {
  const [fontBold, fontExtraBold, icon] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-700.ttf")),
    readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-800.ttf")),
    readFile(join(process.cwd(), "public/icon-512.png")),
  ]);
  return {
    fontBold,
    fontExtraBold,
    iconSrc: `data:image/png;base64,${icon.toString("base64")}`,
  };
}

function shareFonts(fontBold: Buffer, fontExtraBold: Buffer) {
  return [
    { name: "Plus Jakarta Sans", data: toArrayBuffer(fontBold), style: "normal" as const, weight: 700 as const },
    { name: "Plus Jakarta Sans", data: toArrayBuffer(fontExtraBold), style: "normal" as const, weight: 800 as const },
  ];
}

/** Plus Jakarta não tem o glifo ✓. Traço de 28 px, a altura da faixa. */
function CheckMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" style={{ display: "flex" }}>
      <path
        d="M6 14.5 L11.5 20 L22 8"
        fill="none"
        stroke={brandColors.ink}
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Lockup({ iconSrc }: { iconSrc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {/* Satori (next/og) só desenha <img>; next/image não entra nesse runtime. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} width={72} height={72} alt="" style={{ borderRadius: 22 }} />
      <div style={{ display: "flex", marginLeft: 20, fontSize: 42, letterSpacing: -0.84 }}>
        <span style={{ fontWeight: 700, color: brandColors.ink }}>Agenda</span>
        <span style={{ fontWeight: 800, color: brandColors.pix }}>Pix</span>
      </div>
    </div>
  );
}

/** Cartão 1200×630 da home: papel, lockup, promessa e a faixa do horário, tudo centrado. */
export async function renderShareImage() {
  const { fontBold, fontExtraBold, iconSrc } = await loadShareAssets();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: brandColors.paper,
          padding: "40px 0",
          gap: 28,
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        <Lockup iconSrc={iconSrc} />
        <div
          style={{
            display: "flex",
            width: 560,
            maxWidth: 560,
            textAlign: "center",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.9,
            color: brandColors.ink,
          }}
        >
          {shareTitle}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 560,
            maxWidth: 560,
            background: brandColors.pixBright,
            color: brandColors.ink,
            borderRadius: 16,
            height: 84,
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ display: "flex" }}>15:30</span>
            <span style={{ display: "flex" }}>·</span>
            <CheckMark />
            <span style={{ display: "flex" }}>Reservado · sinal pago</span>
          </div>
        </div>
      </div>
    ),
    { ...shareImageSize, fonts: shareFonts(fontBold, fontExtraBold) },
  );
}

/** Mesmo tamanho da home, só o lockup e a frase fixa. Nenhum dado do negócio. */
export async function renderNeutralShareImage() {
  const { fontBold, fontExtraBold, iconSrc } = await loadShareAssets();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: brandColors.paper,
          padding: 64,
          fontFamily: "Plus Jakarta Sans",
          gap: 36,
        }}
      >
        <Lockup iconSrc={iconSrc} />
        <div
          style={{
            display: "flex",
            textAlign: "center",
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: -1.2,
            color: brandColors.ink,
          }}
        >
          Agende online · sinal no Pix
        </div>
      </div>
    ),
    { ...shareImageSize, fonts: shareFonts(fontBold, fontExtraBold) },
  );
}
