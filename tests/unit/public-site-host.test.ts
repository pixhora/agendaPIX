import { afterEach, describe, expect, it } from "vitest";
import { publicSiteHost } from "../../lib/site";

describe("publicSiteHost", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  });

  it("strips the protocol from the public site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://agendapix.dev.br";
    expect(publicSiteHost()).toBe("agendapix.dev.br");
  });

  it("uses the canonical host when the env is missing or local", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(publicSiteHost()).toBe("www.agendapix.dev.br");
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3344";
    expect(publicSiteHost()).toBe("www.agendapix.dev.br");
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(publicSiteHost()).toBe("www.agendapix.dev.br");
  });
});
