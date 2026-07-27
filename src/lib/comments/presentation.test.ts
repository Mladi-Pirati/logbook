import { describe, expect, test } from "bun:test"
import { getCommentAuthorPresentation } from "./presentation"

describe("comment author presentation", () => {
  test("uses first and last name for linked users", () => {
    expect(
      getCommentAuthorPresentation({
        author: {
          id: "helm-1",
          firstName: "Ana",
          lastName: "Novak",
          discordUserId: "123",
        },
        discordUserId: "123",
        discordUsername: "ana",
        discordDisplayName: "Ana P.",
      }),
    ).toEqual({ displayName: "Ana Novak", secondaryLabel: null })
  })

  test("labels unlinked Logbook users with their Helm ID", () => {
    expect(
      getCommentAuthorPresentation({
        author: {
          id: "helm-2",
          firstName: "Maja",
          lastName: "Kovač",
          discordUserId: null,
        },
        discordUserId: null,
        discordUsername: null,
        discordDisplayName: null,
      }),
    ).toEqual({
      displayName: "Maja Kovač",
      secondaryLabel: "Helm helm-2",
    })
  })

  test("labels unlinked Discord users with server identity and ID", () => {
    const result = getCommentAuthorPresentation({
      author: null,
      discordUserId: "456",
      discordUsername: "rok",
      discordDisplayName: "Rok P.",
    })

    expect(result).toEqual({
      displayName: "Rok P.",
      secondaryLabel: "Discord 456",
    })
    expect(result).not.toHaveProperty("fullName")
  })
})
