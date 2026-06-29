import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { z } from "zod";
import { getHelm } from "@/lib/helm";
import {
  getKeycloakUsernameFromProfile,
  getKeycloakFullNameFromProfile,
} from "@/lib/auth/keycloak-access";
import { upsertUser } from "@/lib/sync-user";

const keycloakProfileSchema = z
  .object({ sub: z.string().min(1) })
  .passthrough();

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(
    `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        refresh_token: refreshToken,
      }),
    },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessTokenExpiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

// Auth.js cookies are scoped by host, not port, so multiple apps on localhost
// (e.g. quartermaster) share the default "authjs.*" cookies and clobber each
// other's sessions. Namespacing logbook's cookies keeps them isolated.
const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = "logbook";
const secureName = (name: string) =>
  `${useSecureCookies ? "__Secure-" : ""}${cookiePrefix}.${name}`;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: useSecureCookies,
} as const;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: { name: secureName("session-token"), options: cookieOptions },
    callbackUrl: { name: secureName("callback-url"), options: cookieOptions },
    csrfToken: {
      name: `${useSecureCookies ? "__Host-" : ""}${cookiePrefix}.csrf-token`,
      options: cookieOptions,
    },
  },
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "keycloak") return false;
      try {
        const helm = await getHelm(account.access_token);
        const user = await helm.user.me();
        const hasAccess = user.applications.some(
          (a: { keycloakClientId: string }) =>
            a.keycloakClientId === process.env.KEYCLOAK_CLIENT_ID,
        );
        if (hasAccess) {
          await upsertUser(user).catch((e) =>
            console.error("[auth] upsertUser error:", e),
          );
        }
        return hasAccess;
      } catch (e) {
        console.error("[auth] signIn error:", e);
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      // Initial sign-in: store tokens and profile data from Keycloak
      if (account?.provider === "keycloak" && account.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt =
          account.expires_at ??
          Math.floor(Date.now() / 1000) + (account.expires_in ?? 300);
        const parsed = keycloakProfileSchema.safeParse(profile);
        if (parsed.success) token.keycloakUserId = parsed.data.sub;
        token.username = getKeycloakUsernameFromProfile(profile) ?? "";
        token.fullName = getKeycloakFullNameFromProfile(profile) ?? "";
        // Store helm user id (different from Keycloak sub) for DB foreign keys
        try {
          const helm = await getHelm(account.access_token);
          const helmUser = await helm.user.me();
          token.helmUserId = helmUser.id;
        } catch (e) {
          console.error("[auth] jwt: failed to fetch helm user id:", e);
        }
        return token;
      }

      // Token still valid with 30s buffer
      if (Date.now() / 1000 < (token.accessTokenExpiresAt ?? 0) - 30) {
        return token;
      }

      // Refresh expired token
      if (!token.refreshToken) return null;
      const refreshed = await refreshAccessToken(token.refreshToken);
      if (!refreshed) return null;

      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
      };
    },
    async session({ session, token }) {
      if (token.accessToken) session.accessToken = token.accessToken;
      if (session.user) {
        session.user.keycloakUserId = token.keycloakUserId ?? "";
        session.user.helmUserId = token.helmUserId ?? "";
        session.user.username = token.username ?? "";
        session.user.fullName = token.fullName ?? "";
      }
      return session;
    },
  },
});
