/** A animação de entrada só corre quando o sistema permite movimento. */
export function shouldStartInViewAnimation(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
