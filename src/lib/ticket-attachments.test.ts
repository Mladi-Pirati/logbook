import { describe, expect, test } from "bun:test"
import {
  inspectAttachment,
  sanitizeAttachmentFileName,
} from "./ticket-attachments"

describe("ticket attachments", () => {
  test("recognizes safe inline raster images by signature", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(inspectAttachment("image.png", "image/png", png)).toEqual({
      fileName: "image.png",
      contentType: "image/png",
      isInline: true,
    })
  })

  test("rejects spoofed images and executable content", () => {
    const text = new TextEncoder().encode("<script>alert(1)</script>")
    expect(inspectAttachment("image.png", "image/png", text)).toBeNull()
    expect(inspectAttachment("payload.html", "text/html", text)).toBeNull()
    expect(
      inspectAttachment("payload.exe", "application/octet-stream", text),
    ).toBeNull()
  })

  test("forces unknown document MIME types to download as binary", () => {
    const bytes = new TextEncoder().encode("hello")
    expect(
      inspectAttachment("notes.txt", "application/x-unknown", bytes),
    ).toEqual({
      fileName: "notes.txt",
      contentType: "application/octet-stream",
      isInline: false,
    })
  })

  test("sanitizes path separators and control characters", () => {
    expect(sanitizeAttachmentFileName("../bad\u0000name.pdf")).toBe(
      ".._bad_name.pdf",
    )
  })
})
