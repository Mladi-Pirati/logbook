"use client";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
