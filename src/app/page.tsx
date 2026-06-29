import { requireUser } from "@/lib/auth/session";
import { getHelm } from "@/lib/helm";
import type { HelmRole, HelmUser } from "@mp/helm-sdk";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sessionUser = await requireUser();

  let user: HelmUser | null = null;
  try {
    const helm = await getHelm();
    user = await helm.user.me();
  } catch (e) {
    console.error("[home] failed to load helm user:", e);
  }

  const fullName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : sessionUser.fullName;
  const username = user?.username ?? sessionUser.username;

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{fullName || "Logbook"}</CardTitle>
          <CardDescription>
            {username ? `@${username}` : "Signed in"}
          </CardDescription>
          <CardAction>
            <SignOutButton />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {user ? (
            <div className="grid gap-2">
              <span className="text-muted-foreground">Roles</span>
              {user.roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role: HelmRole) => (
                    <Badge key={role.key} variant="secondary">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">No roles assigned.</span>
              )}
            </div>
          ) : (
            <p className="text-destructive">
              Could not load your profile from the Helm API.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
