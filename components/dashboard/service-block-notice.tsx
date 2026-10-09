import { serviceBlockCopy } from "@/lib/dashboard/service-block";

export function ServiceBlockNotice({ reason }: { reason: string | null }) {
  const copy = serviceBlockCopy(reason);
  if (!copy) return null;
  return (
    <p role="status" className="mt-3 rounded-field border border-warning/30 bg-warning-soft px-3 py-3 text-sm leading-relaxed text-ink">
      <span className="font-semibold">{copy.title}. </span>
      {copy.body}
    </p>
  );
}
