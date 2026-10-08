/**
 * Inspired by/adapted from Cult UI (https://github.com/nolly-studio/cult-ui), MIT License, Copyright (c) 2023 Jordan-Gilliam
 */

import { SegmentedThumbView, type SegmentedOption, type SegmentedThumbProps } from "@/components/motion/segmented-thumb-view";

export type { SegmentedOption, SegmentedThumbProps };

type UncontrolledProps = Omit<SegmentedThumbProps, "value" | "onValueChange">;

/** Grupo de rádio no servidor. O polegar é CSS. O caso controlado fica no wrapper cliente. */
export function SegmentedThumb(props: UncontrolledProps) {
  return <SegmentedThumbView {...props} />;
}
