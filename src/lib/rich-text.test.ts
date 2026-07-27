import { describe, expect, test } from "bun:test"
import {
  EMPTY_RICH_TEXT_DOCUMENT,
  getRichTextAttachmentIds,
  isSafeRichTextHref,
  parseRichTextDocument,
  plainTextToRichText,
  richTextToDiscordMarkdown,
  richTextToPlainText,
  type RichTextDocument,
} from "./rich-text"

const attachmentId = "c39a8ff2-bd42-4aa3-b981-6c2dc26f5142"

describe("rich text documents", () => {
  test("preserves legacy line breaks in the canonical document", () => {
    const document = plainTextToRichText("First\n\nThird")
    expect(richTextToPlainText(document)).toBe("First\n\nThird")
    expect(parseRichTextDocument(document)).toEqual(document)
  })

  test("accepts supported formatting and safe links", () => {
    const document: RichTextDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Logbook",
              marks: [
                { type: "bold" },
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com/ticket",
                    target: "_blank",
                    rel: "noopener noreferrer",
                    class: null,
                    title: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    expect(parseRichTextDocument(document)).toEqual(document)
    expect(richTextToDiscordMarkdown(document)).toBe(
      "[**Logbook**](https://example.com/ticket)",
    )
  })

  test("rejects unsafe links and unknown nodes", () => {
    expect(isSafeRichTextHref("javascript:alert(1)")).toBe(false)
    expect(
      parseRichTextDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "unsafe",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "javascript:alert(1)" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBeNull()
    expect(
      parseRichTextDocument({
        type: "doc",
        content: [{ type: "iframe", attrs: { src: "https://example.com" } }],
      }),
    ).toBeNull()
  })

  test("extracts unique attachment IDs and includes download links", () => {
    const document: RichTextDocument = {
      type: "doc",
      content: [
        { type: "attachment", attrs: { id: attachmentId } },
        { type: "attachment", attrs: { id: attachmentId } },
      ],
    }

    expect(getRichTextAttachmentIds(document)).toEqual([attachmentId])
    expect(
      richTextToDiscordMarkdown(document, {
        baseUrl: "https://logbook.example",
        attachments: new Map([[attachmentId, { fileName: "design.pdf" }]]),
      })?.includes(
        `https://logbook.example/api/ticket-attachments/${attachmentId}`,
      ),
    ).toBe(true)
  })

  test("handles empty descriptions", () => {
    expect(richTextToPlainText(EMPTY_RICH_TEXT_DOCUMENT)).toBeNull()
    expect(parseRichTextDocument(EMPTY_RICH_TEXT_DOCUMENT)).not.toBeNull()
  })
})
