import { auth } from "@/auth"
import { getHelm } from "@/lib/helm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ memberId: string; version: string }> },
) {
  const session = await auth()
  if (!session?.user || !session.accessToken) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }
  const { memberId, version } = await context.params
  try {
    const helm = await getHelm(session.accessToken)
    const upstream = await helm.user.profilePictures.fetch(memberId, version)
    const headers = new Headers()
    for (const name of [
      "cache-control",
      "content-length",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    if (!upstream.ok) headers.set("Cache-Control", "no-store")
    return new Response(upstream.body, { headers, status: upstream.status })
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 502
    return new Response(null, {
      status,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
