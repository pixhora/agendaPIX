import { timingSafeEqual } from "node:crypto";

export function safeEqualString(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) {
    const dummy = a.length > 0 ? a : Buffer.from([0]);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function safeEqualHex(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && a.length > 0 && left.length === right.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
