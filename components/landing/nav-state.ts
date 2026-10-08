type Listener = () => void;

let open = false;
const listeners = new Set<Listener>();

export function getLandingNavOpen(): boolean {
  return open;
}

export function setLandingNavOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export function subscribeLandingNav(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
