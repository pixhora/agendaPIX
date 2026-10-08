"use client";

/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

export type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SegmentedThumbProps = {
  name: string;
  label: string;
  options: SegmentedOption[];
  /** Controlado. Omita para usar `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

/** Grupo de rádio com polegar deslizante. O nome e o valor entram no formulário. */
export function SegmentedThumb({ name, label, options, value, defaultValue, onValueChange, className }: SegmentedThumbProps) {
  const count = Math.min(Math.max(options.length, 1), 8);
  const initial = defaultValue ?? options[0]?.value;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-count={count}
      className={`seg-track motion-focus ${className ?? ""}`}
    >
      <div className="seg-thumb" aria-hidden="true" />
      <div className="seg-options">
        {options.map((option) => {
          const inputProps = value !== undefined
            ? { checked: option.value === value }
            : { defaultChecked: option.value === initial };
          return (
            <label key={option.value}>
              <input
                type="radio"
                name={name}
                value={option.value}
                disabled={option.disabled}
                className="sr-only"
                onChange={() => onValueChange?.(option.value)}
                {...inputProps}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
