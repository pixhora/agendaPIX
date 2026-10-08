"use client";

/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { SegmentedThumbView, type SegmentedThumbProps } from "@/components/motion/segmented-thumb-view";

export type { SegmentedThumbProps };

/** Mesmo grupo, com valor controlado. Só esta variante vai para o cliente. */
export function SegmentedThumbControlled(props: SegmentedThumbProps) {
  return <SegmentedThumbView {...props} />;
}
