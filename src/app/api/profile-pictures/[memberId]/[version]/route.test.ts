import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"

let accessToken: string | null = "access-token"
let upstream: Response = new Response()
let requested: { memberId: string; token: string; version: string } | null = null

mock.module("@/auth", () => ({
  auth: async () =>
    accessToken ? { accessToken, user: { id: "member-1" } } : null,
}))
mock.module("@/lib/helm", () => ({
  getHelm: async (token: string) => ({
    user: {
      profilePictures: {
        fetch: async (memberId: string, version: string) => {
          requested = { memberId, token, version }
          return upstream
        },
      },
    },
  }),
}))

const routeModulePromise = import("./route")

function context(memberId = "member/1", version = "version 1") {
  return { params: Promise.resolve({ memberId, version }) }
}

beforeEach(() => {
  accessToken = "access-token"
  requested = null
  upstream = new Response(new Uint8Array([1, 2, 3]), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Length": "3",
      "Content-Type": "image/webp",
      ETag: '"etag-1"',
      "Last-Modified": "Mon, 27 Jul 2026 10:00:00 GMT",
      "X-Untrusted-Upstream": "do-not-forward",
    },
  })
})

afterAll(() => {
  mock.restore()
})

describe("Logbook profile picture proxy", () => {
  test("requires a session with a current access token", async () => {
    accessToken = null
    const { GET } = await routeModulePromise
    const response = await GET(new Request("https://logbook.test/picture"), context())

    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(requested).toBeNull()
  })

  test("uses validated route parameters and forwards only image cache headers", async () => {
    const { GET } = await routeModulePromise
    const response = await GET(new Request("https://logbook.test/picture"), context())

    expect(requested).toEqual({
      memberId: "member/1",
      token: "access-token",
      version: "version 1",
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=31536000, immutable",
    )
    expect(response.headers.get("Content-Type")).toBe("image/webp")
    expect(response.headers.get("X-Untrusted-Upstream")).toBeNull()
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    )
  })

  test("preserves a no-store upstream 404", async () => {
    upstream = new Response(null, { status: 404 })
    const { GET } = await routeModulePromise
    const response = await GET(new Request("https://logbook.test/picture"), context())

    expect(response.status).toBe(404)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
})
