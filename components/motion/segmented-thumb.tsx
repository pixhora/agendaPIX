/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { SegmentedThumbView, type SegmentedOption, type SegmentedThumbProps } from "@/components/motion/segmented-thumb-view";

export type { SegmentedOption, SegmentedThumbProps };

/** Grupo de rádio. O polegar é CSS. Quem guarda o valor controlado já é cliente e importa este módulo. */
export function SegmentedThumb(props: SegmentedThumbProps) {
  return <SegmentedThumbView {...props} />;
}
