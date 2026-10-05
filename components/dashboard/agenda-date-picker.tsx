"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function toIso(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

/** Seletor de data do painel (Calendar + Popover do shadcn). Navega via querystring, sem mudar contratos. */
export function AgendaDatePicker({ date, label, hrefBase }: { date: string; label: string; hrefBase: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = new Date(`${date}T12:00:00`);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "min-w-0 flex-1 justify-start gap-2 sm:flex-none")} aria-label={`Escolher data. Data exibida: ${label}`}>
        <CalendarDays aria-hidden="true" className="text-muted" />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent aria-label="Calendário">
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected}
          onSelect={(value) => {
            if (!value) return;
            setOpen(false);
            router.push(`${hrefBase}&date=${toIso(value)}`);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
