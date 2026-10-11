/** Mobile tenta a Web Share API. O resto abre wa.me sem número, só com o texto. */
export async function sendOnWhatsApp(
  text: string,
  env: {
    mobile: boolean;
    share?: (data: { text: string }) => Promise<void>;
    open: (url: string) => void;
  },
) {
  if (env.mobile && env.share) {
    try {
      await env.share({ text });
      return "shared" as const;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "aborted" as const;
    }
  }
  env.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  return "wa" as const;
}

export function whatsAppStoreHref(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}
