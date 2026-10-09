function svgProps(className?: string) {
  return {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CalendarCheckIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}

export function SmartphoneIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

export function CircleCheckIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16 9-5.5 5.5L8 12" />
    </svg>
  );
}

export function LayoutPanelIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect width="7" height="18" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
    </svg>
  );
}
