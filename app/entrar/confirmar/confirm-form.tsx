"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { confirmLoginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-8 w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </Button>
  );
}

export function ConfirmLoginForm({
  token,
  callbackURL,
  errorCallbackURL,
  newUserCallbackURL,
}: {
  token: string;
  callbackURL?: string;
  errorCallbackURL?: string;
  newUserCallbackURL?: string;
}) {
  return (
    <form action={confirmLoginAction}>
      <input type="hidden" name="token" value={token} />
      {callbackURL ? <input type="hidden" name="callbackURL" value={callbackURL} /> : null}
      {errorCallbackURL ? <input type="hidden" name="errorCallbackURL" value={errorCallbackURL} /> : null}
      {newUserCallbackURL ? <input type="hidden" name="newUserCallbackURL" value={newUserCallbackURL} /> : null}
      <SubmitButton />
    </form>
  );
}
