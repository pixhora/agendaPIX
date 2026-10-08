import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sitePromise } from "@/lib/site";

export const shareImageSize = { width: 1200, height: 630 };
export const shareImageAlt = `AgendaPix. ${sitePromise}`;

function toArrayBuffer(data: Buffer): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/** Cartão 1200×630: papel, lockup Grade A, promessa da landing e a faixa do horário reservado. */
export async function renderShareImage() {
  const [font, icon] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans.ttf")),
    readFile(join(process.cwd(), "public/icon-512.png")),
  ]);
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F6F5F2",
          padding: 64,
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={iconSrc} width={72} height={72} alt="" style={{ borderRadius: 22 }} />
          <div style={{ display: "flex", marginLeft: 20, fontSize: 42, letterSpacing: -0.84 }}>
            <span style={{ fontWeight: 700, color: "#0B0B0C" }}>Agenda</span>
            <span style={{ fontWeight: 800, color: "#0A6E63" }}>Pix</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.9,
            color: "#0B0B0C",
            maxWidth: 1040,
          }}
        >
          {sitePromise}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#3FD0BE",
            color: "#0B0B0C",
            borderRadius: 16,
            height: 84,
            padding: "0 32px",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          <span>15:30</span>
          <span>Reservado · sinal pago</span>
        </div>
      </div>
    ),
    {
      ...shareImageSize,
      fonts: [
        { name: "Plus Jakarta Sans", data: toArrayBuffer(font), style: "normal", weight: 700 },
        { name: "Plus Jakarta Sans", data: toArrayBuffer(font), style: "normal", weight: 800 },
      ],
    },
  );
}
