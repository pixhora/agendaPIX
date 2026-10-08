import { readFileSync } from "node:fs";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingIsland } from "../../components/motion/booking-island";
import { CopyButton } from "../../components/motion/copy-button";
import { CountdownRing, formatClock, ringGeometry } from "../../components/motion/countdown-ring";
import { GradeLoader } from "../../components/motion/grade-loader";
import { RollingNumber } from "../../components/motion/rolling-number";
import { formatRollingValue, splitRollingText, cssDurationMs } from "../../components/motion/rolling-format";
import { SegmentedThumb } from "../../components/motion/segmented-thumb";
import { COPY_ERROR, COPY_RESET_MS, copyValue } from "../../components/motion/motion-runtime";
import { shouldStartInViewAnimation } from "../../components/motion/in-view-policy";
import { isMotionPreviewOpen } from "../../app/preview/motion/access";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";

const durations = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
];

describe("movimento: valor final no servidor", () => {
  it("formata centavos em real e minutos sem gravar um número fixo", () => {
    const holdMinutes = 10;
    expect(formatRollingValue(holdMinutes, "integer", " minutos")).toBe("10 minutos");
    expect(formatRollingValue(12, "integer", " minutos")).toBe("12 minutos");
  });

  it("separa dígitos e mantém o texto ao redor", () => {
    const parts = splitRollingText("12 minutos");
    expect(parts.filter((part) => part.type === "digit").map((part) => part.digit)).toEqual([1, 2]);
    expect(parts.filter((part) => part.type === "mark").map((part) => part.char).join("")).toBe(" minutos");
    expect(cssDurationMs(".56s")).toBe(560);
    expect(cssDurationMs("0.18s")).toBe(180);
    expect(cssDurationMs("320ms")).toBe(320);
    expect(cssDurationMs("")).toBe(560);
  });

  it("coloca o valor real só para leitor de tela e esconde os dígitos animados", () => {
    const html = renderToStaticMarkup(RollingNumber({ value: 12, suffix: " minutos", id: "hold" }));
    expect(html).toContain('id="hold" class="sr-only">12 minutos<');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("tabular-nums");
    expect(html).toContain('data-digit="1"');
    expect(html).toContain('data-digit="2"');
    expect(html).not.toContain("data-inview");
    expect(renderToStaticMarkup(RollingNumber({ value: 12, suffix: " minutos" }))).toBe(
      renderToStaticMarkup(RollingNumber({ value: 12, suffix: " minutos" })),
    );
  });
});

describe("movimento: acessibilidade e movimento reduzido", () => {
  it("não anima quando o sistema pede menos movimento", () => {
    expect(shouldStartInViewAnimation(true)).toBe(false);
    expect(shouldStartInViewAnimation(false)).toBe(true);
  });

  it("o CSS guarda o estado final parado e o foco só no invólucro", () => {
    const css = readFileSync("app/motion.css", "utf8");
    expect(css).toContain("@theme");
    expect(css).toContain("--ease-out-quint:");
    expect(css).toContain("--dur-1:");
    expect(css).toContain("--dur-2:");
    expect(css).toContain("--dur-3:");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".island-detail { opacity: 1; }");
    expect(css).toContain(".grade-loader svg rect { opacity: 1; }");
    expect(css).toContain("box-shadow: var(--shadow-focus)");
    expect(css).toContain("transform: translateX");
    const globals = readFileSync("app/globals.css", "utf8");
    expect(globals.startsWith('@import "tailwindcss";\n@import "./motion.css";')).toBe(true);
  });

  it("a ilha nasce com o texto da reserva e sem disparar a animação", () => {
    const html = renderToStaticMarkup(BookingIsland({
      compactLabel: "Nova reserva",
      guestName: "Ana",
      serviceName: "Corte feminino",
      whenLabel: "sex, 09 out, 14:00",
      statusLabel: "Confirmado · sinal pago",
      label: "Nova reserva de Ana: Corte feminino, sex, 09 out, 14:00. Confirmado, sinal pago.",
    }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Nova reserva de Ana: Corte feminino, sex, 09 out, 14:00. Confirmado, sinal pago."');
    expect(html).toContain("Nova reserva");
    expect(html).toContain("Confirmado · sinal pago");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("data-inview");
  });

  it("o anel mostra mm:ss, o tom e não depende de um relógio interno", () => {
    expect(formatClock(90)).toBe("01:30");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-4)).toBe("00:00");
    const half = ringGeometry(450, 900);
    expect(half.ratio).toBeCloseTo(0.5);
    expect(half.dash).toBeCloseTo(half.circumference / 2);
    expect(ringGeometry(10, 0).ratio).toBe(0);

    const html = renderToStaticMarkup(CountdownRing({ secondsLeft: 45, totalSeconds: 900, tone: "warn", label: "Falta pouco" }));
    expect(html).toContain("00:45");
    expect(html).toContain('data-tone="warn"');
    expect(html).toContain("text-warning");
    expect(html).toContain("Falta pouco");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("setInterval");

    const expired = renderToStaticMarkup(CountdownRing({ secondsLeft: 0, totalSeconds: 900, tone: "expired", label: "Prazo encerrado" }));
    expect(expired).toContain("00:00");
    expect(expired).toContain('data-tone="expired"');
    expect(expired).toContain("text-danger");
  });

  it("a marca carregando anuncia o texto e usa o símbolo importado", () => {
    const html = renderToStaticMarkup(GradeLoader({}));
    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando…");
    expect(html).toContain("<svg");
    expect(html).toContain("text-pix-bright");
    expect(html).not.toContain("data-inview");
    const custom = renderToStaticMarkup(GradeLoader({ label: "Verificando pagamento…" }));
    expect(custom).toContain("Verificando pagamento…");
  });

  it("o botão de copiar tem rótulo, região ao vivo e campo de fallback", () => {
    const html = renderToStaticMarkup(createElement(CopyButton, { value: "codigo-pix" }));
    expect(html).toContain("Copiar código");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('type="button"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('value="codigo-pix"');
    expect(html).toContain("motion-focus");
    expect(html).not.toContain(COPY_ERROR);
    expect(COPY_RESET_MS).toBe(2000);
  });

  it("copia pelo clipboard e cai no comando antigo quando ele falha", async () => {
    const select = vi.fn();
    await expect(copyValue("abc", { writeText: async () => {}, select })).resolves.toBe("copied");
    expect(select).not.toHaveBeenCalled();

    const fallbackSelect = vi.fn();
    await expect(copyValue("abc", {
      writeText: async () => { throw new Error("negado"); },
      execCommand: () => true,
      select: fallbackSelect,
    })).resolves.toBe("copied");
    expect(fallbackSelect).toHaveBeenCalledOnce();

    await expect(copyValue("abc", {
      writeText: async () => { throw new Error("negado"); },
      execCommand: () => false,
      select: () => {},
    })).resolves.toBe("failed");

    await expect(copyValue("", { writeText: async () => {} })).resolves.toBe("failed");
    await expect(copyValue("abc", {
      execCommand: () => { throw new Error("sem comando"); },
      select: () => {},
    })).resolves.toBe("failed");
  });

  it("o seletor é um grupo de rádio com nome, valor e uma opção marcada", () => {
    const uncontrolled = renderToStaticMarkup(SegmentedThumb({
      name: "duration",
      label: "Duração do serviço",
      options: durations,
      defaultValue: "30",
    }));
    expect(uncontrolled).toContain('role="radiogroup"');
    expect(uncontrolled).toContain('aria-label="Duração do serviço"');
    expect(uncontrolled).toContain('name="duration"');
    expect(uncontrolled).toContain('value="15"');
    expect(uncontrolled).toContain('value="60"');
    expect(uncontrolled).toContain("motion-focus");
    expect(uncontrolled).toContain('aria-hidden="true"');
    expect(uncontrolled.match(/checked=""/g)?.length).toBe(1);
    expect(uncontrolled).toContain('value="30"');

    const controlled = renderToStaticMarkup(SegmentedThumb({
      name: "appearance",
      label: "Aparência",
      options: [
        { value: "light", label: "Claro" },
        { value: "dark", label: "Escuro" },
        { value: "system", label: "Sistema" },
      ],
      value: "dark",
    }));
    expect(controlled).toContain('name="appearance"');
    expect(controlled.match(/checked=""/g)?.length).toBe(1);
    const darkIndex = controlled.indexOf('value="dark"');
    expect(controlled.slice(darkIndex - 20, darkIndex)).toContain("checked");
  });
});

describe("vitrine de movimento", () => {
  it("fica fechada em produção e fora do índice", () => {
    expect(isMotionPreviewOpen("production")).toBe(false);
    expect(isMotionPreviewOpen("development")).toBe(true);
    expect(isMotionPreviewOpen("test")).toBe(true);
    const rules = robots().rules;
    const disallow = Array.isArray(rules) ? rules.flatMap((rule) => rule.disallow ?? []) : rules?.disallow ?? [];
    const blocked = Array.isArray(disallow) ? disallow : [disallow];
    expect(blocked).toContain("/preview");
    expect(sitemap().some((item) => item.url.includes("/preview"))).toBe(false);
  });

  it("marca a licença do Cult UI nos arquivos adaptados e não na Grade A", () => {
    const notice = "Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam";
    for (const file of [
      "components/motion/rolling-number.tsx",
      "components/motion/rolling-number-motion.tsx",
      "components/motion/booking-island.tsx",
      "components/motion/copy-button.tsx",
      "components/motion/motion-runtime.ts",
      "components/motion/segmented-thumb.tsx",
      "components/motion/countdown-ring.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).toContain(notice);
    }
    expect(readFileSync("components/motion/grade-loader.tsx", "utf8")).not.toContain("Jordan-Gilliam");
    const thirdParty = readFileSync("THIRD_PARTY_NOTICES.md", "utf8");
    expect(thirdParty).toContain("Copyright (c) 2023 Jordan-Gilliam");
    expect(thirdParty).toContain("Permission is hereby granted, free of charge");
    expect(thirdParty).toContain("THE SOFTWARE IS PROVIDED \"AS IS\"");
    expect(thirdParty).toContain("grade-loader.tsx");
  });
});
