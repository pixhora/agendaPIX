"use client";

import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Calendar do shadcn sobre react-day-picker v9, com os tokens do app e locale pt-BR. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: React.ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: cn(defaults.root, "w-fit"),
        months: "relative flex flex-col gap-4",
        month: "flex flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: "inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
        button_next: "inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
        month_caption: "flex h-10 items-center justify-center px-10",
        caption_label: "font-display text-sm font-bold capitalize",
        weekdays: "flex",
        weekday: "w-10 text-center text-xs font-semibold uppercase text-muted",
        week: "mt-1 flex",
        day: "size-10 p-0 text-center text-sm",
        day_button: "inline-flex size-10 items-center justify-center rounded-full font-medium tabular-nums text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring aria-selected:bg-ink aria-selected:text-paper",
        today: "[&>button]:ring-1 [&>button]:ring-pix [&>button]:font-bold",
        selected: "",
        outside: "[&>button]:text-muted",
        disabled: "[&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === "left" ? <ChevronLeft aria-hidden="true" className={cn("size-4", chevronClass)} /> : <ChevronRight aria-hidden="true" className={cn("size-4", chevronClass)} />,
      }}
      {...props}
    />
  );
}

export { Calendar };
