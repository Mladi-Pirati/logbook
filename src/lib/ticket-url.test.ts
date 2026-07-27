import { describe, expect, test } from "bun:test"
import { getCanonicalTicketUrl, parseTicketKey } from "./ticket-url"

describe("canonical ticket URL", () => {
  test("uses the public project key and ticket number", () => {
    expect(
      getCanonicalTicketUrl("https://logbook.example/", "IT", 9),
    ).toBe("https://logbook.example/tickets/IT-9")
  })

  test("parses and normalizes public ticket keys", () => {
    expect(parseTicketKey("it-9")).toEqual({
      projectKey: "IT",
      number: 9,
    })
    expect(parseTicketKey("not-a-ticket")).toEqual(null)
  })
})
