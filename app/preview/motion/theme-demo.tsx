"use client";

import { useState } from "react";
import { SegmentedThumb } from "@/components/motion/segmented-thumb";

const options = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

const labels: Record<string, string> = {
  light: "Claro",
  dark: "Escuro",
  system: "Sistema",
};

/** Exemplo controlado. Não troca o tema desta página. */
export function ThemeAppearanceDemo() {
  const [value, setValue] = useState("system");
  return (
    <div className="space-y-3">
      <SegmentedThumb
        name="appearance"
        label="Aparência"
        options={options}
        value={value}
        onValueChange={setValue}
      />
      <p className="text-sm text-muted">Aparência selecionada: {labels[value] ?? value}. Esta página não muda de tema por aqui.</p>
    </div>
  );
}
