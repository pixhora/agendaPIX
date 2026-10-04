"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

import { backendOrigin } from "./backend-origin";

export const authClient = createAuthClient({
  baseURL: backendOrigin,
  fetchOptions: { credentials: "include" },
  plugins: [magicLinkClient()],
});
