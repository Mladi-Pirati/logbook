import { z } from "zod";

const clientRolesClaimsSchema = z
  .object({
    resource_access: z
      .record(
        z.string(),
        z.object({
          roles: z.array(z.string()).default([]),
        }),
      )
      .optional(),
  })
  .passthrough();

function parseClaims(value: unknown) {
  const parsed = clientRolesClaimsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function getClientRolesFromClaims(value: unknown, clientId: string) {
  return parseClaims(value)?.resource_access?.[clientId]?.roles ?? [];
}

export function keycloakProfileHasClientRole(
  profile: unknown,
  clientId: string,
) {
  return getClientRolesFromClaims(profile, clientId).length > 0;
}

export function keycloakAccessTokenHasClientRole(
  accessToken: unknown,
  clientId: string,
) {
  if (typeof accessToken !== "string") return false;

  const [, payload] = accessToken.split(".");
  if (!payload) return false;

  try {
    return (
      getClientRolesFromClaims(
        JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
        clientId,
      ).length > 0
    );
  } catch {
    return false;
  }
}

export function getKeycloakUsernameFromProfile(profile: unknown) {
  const parsed = z
    .object({
      preferred_username: z.string().optional(),
      email: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough()
    .safeParse(profile);

  if (!parsed.success) return null;

  return (
    parsed.data.preferred_username ??
    parsed.data.email ??
    parsed.data.name ??
    null
  );
}

export function getKeycloakFullNameFromProfile(profile: unknown) {
  const parsed = z
    .object({
      name: z.string().optional(),
      given_name: z.string().optional(),
      family_name: z.string().optional(),
      preferred_username: z.string().optional(),
    })
    .passthrough()
    .safeParse(profile);

  if (!parsed.success) return null;

  const fullName =
    parsed.data.name ??
    [parsed.data.given_name, parsed.data.family_name]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join(" ");

  return fullName || parsed.data.preferred_username || null;
}
