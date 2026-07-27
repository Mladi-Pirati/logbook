import { after } from "next/server"
import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { ticketAttachments } from "@/db/schema"
import {
  cleanupTicketAttachmentObjects,
  getTicketAttachmentObject,
} from "@/lib/ticket-attachments"

export const runtime = "nodejs"

function encodedContentDisposition(fileName: string, inline: boolean) {
  const fallback = fileName.replaceAll(/[^\x20-\x7e]|["\\]/g, "_")
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.helmUserId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const attachment = await db.query.ticketAttachments.findFirst({
    where: and(
      eq(ticketAttachments.id, id),
      isNull(ticketAttachments.deletedAt),
    ),
  })
  if (
    !attachment ||
    (attachment.ticketId === null &&
      attachment.uploadedById !== session.user.helmUserId)
  ) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 })
  }

  try {
    const object = await getTicketAttachmentObject(attachment.objectKey)
    const body = object.Body?.transformToWebStream()
    if (!body) throw new Error("S3 returned an empty body")

    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": encodedContentDisposition(
          attachment.fileName,
          attachment.isInline,
        ),
        "Content-Length": String(attachment.size),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": attachment.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[ticket-attachments] download failed", error)
    return Response.json(
      { ok: false, error: "download_failed" },
      { status: 502 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.helmUserId
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const [attachment] = await db
    .update(ticketAttachments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(ticketAttachments.id, id),
        eq(ticketAttachments.uploadedById, userId),
        isNull(ticketAttachments.ticketId),
        isNull(ticketAttachments.deletedAt),
      ),
    )
    .returning({ id: ticketAttachments.id })

  if (!attachment) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 })
  }

  after(() => cleanupTicketAttachmentObjects())
  return Response.json({ ok: true })
}
