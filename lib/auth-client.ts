"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { getBackendOrigin } from "./backend";

export const authClient = createAuthClient({
  baseURL: getBackendOrigin(),
  fetchOptions: { credentials: "include" },
  plugins: [magicLinkClient()],
});
