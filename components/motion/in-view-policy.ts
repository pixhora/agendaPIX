/** A animação de entrada só corre quando o sistema permite movimento. */
export function shouldStartInViewAnimation(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

/** Estado da ilha. Sem movimento, nada fica armado: o CSS mostra o cartão aberto. */
export function nextInViewState(reducedMotion: boolean, visible: boolean): { armed: boolean; inview: boolean } {
  if (reducedMotion) return { armed: false, inview: false };
  return { armed: true, inview: visible };
}
