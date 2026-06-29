import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: DefaultSession["user"] & {
      keycloakUserId: string;
      helmUserId: string;
      fullName: string;
      username: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    keycloakUserId?: string;
    helmUserId?: string;
    fullName?: string;
    username?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    keycloakUserId?: string;
    helmUserId?: string;
    fullName?: string;
    username?: string;
  }
}
