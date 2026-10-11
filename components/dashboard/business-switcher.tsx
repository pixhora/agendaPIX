"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Troca o negócio aberto. O valor vai no formulário, como o select nativo fazia. */
export function BusinessSwitcher({ path, businesses, businessId }: {
  path: string;
  businesses: { id: string; name: string }[];
  businessId?: string;
}) {
  const value = businessId && businesses.some((business) => business.id === businessId) ? businessId : businesses[0]?.id;
  if (!value) return null;
  return (
    <form action={path} className="flex min-w-0 flex-1 items-end gap-2 sm:flex-none">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <label className="text-xs font-semibold text-muted" htmlFor="business">Negócio</label>
        <Select key={value} name="businessId" defaultValue={value}>
          <SelectTrigger id="business" className="font-medium sm:min-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {businesses.map((business) => (
              <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" className="min-h-12">Abrir</Button>
    </form>
  );
}
