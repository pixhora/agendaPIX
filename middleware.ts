import { NextResponse } from "next/server";

export function middleware() {
  const response = NextResponse.next();
  const headers = response.headers;

  // Strict-Transport-Security: força HTTPS por 1 ano (31536000s)
  // Só ativa em produção para evitar problemas em dev local
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // X-Content-Type-Options: previne MIME-sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // X-Frame-Options: previne clickjacking (nenhuma página pode embedar este app)
  headers.set("X-Frame-Options", "DENY");

  // Referrer-Policy: controla quais dados de referrer são enviados
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy: desabilita features desnecessárias
  headers.set(
    "Permissions-Policy",
    "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), " +
    "cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), " +
    "execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), " +
    "geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), " +
    "midi=(), navigation-override=(), payment=(), picture-in-picture=(), " +
    "publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), " +
    "web-share=(), xr-spatial-tracking=()"
  );

  // Content-Security-Policy
  // Permite Better Auth, QR codes data:image/png;base64, e script inline de theme
  const csp = [
    "default-src 'self'",
    // Scripts: 'self' (chunks do Next), 'unsafe-inline' (theme script no layout)
    "script-src 'self' 'unsafe-inline'",
    // Styles: 'self' + 'unsafe-inline' (Tailwind, shadcn inline styles)
    "style-src 'self' 'unsafe-inline'",
    // Imagens: 'self' (assets) + data: (QR codes base64)
    "img-src 'self' data:",
    // Fonts: 'self' (Google Fonts baixadas)
    "font-src 'self'",
    // Connect: 'self' (APIs internas)
    "connect-src 'self'",
    // Frames: nenhum iframe permitido
    "frame-ancestors 'none'",
    // Base URI: apenas mesma origem
    "base-uri 'self'",
    // Form action: apenas mesma origem
    "form-action 'self'",
    // Object/embed: bloqueado
    "object-src 'none'",
  ].join("; ");

  headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
