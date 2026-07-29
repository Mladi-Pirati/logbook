import { after } from "next/server"
import { and, count, eq, isNull } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { commentAttachments } from "@/db/schema"
import {
  cleanupCommentAttachmentObjects,
  commentAttachmentDownloadUrl,
  deleteTicketAttachmentObject,
  inspectAttachment,
  MAX_ATTACHMENT_BYTES,
  putTicketAttachment,
} from "@/lib/ticket-attachments"
import { MAX_TICKET_ATTACHMENTS } from "@/lib/rich-text"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.helmUserId
  if (!userId) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  const draftId = formData?.get("draftId")
  const file = formData?.get("file")
  if (
    typeof draftId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      draftId,
    ) ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_ATTACHMENT_BYTES
  ) {
    return Response.json(
      { ok: false, error: "invalid_upload" },
      { status: 400 },
    )
  }

  const [draftCount] = await db
    .select({ value: count() })
    .from(commentAttachments)
    .where(
      and(
        eq(commentAttachments.draftId, draftId),
        eq(commentAttachments.uploadedById, userId),
        isNull(commentAttachments.deletedAt),
      ),
    )
  if ((draftCount?.value ?? 0) >= MAX_TICKET_ATTACHMENTS) {
    return Response.json(
      { ok: false, error: "attachment_limit" },
      { status: 409 },
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const inspected = inspectAttachment(file.name, file.type, bytes)
  if (!inspected) {
    return Response.json(
      { ok: false, error: "unsupported_file_type" },
      { status: 415 },
    )
  }

  const id = crypto.randomUUID()
  const objectKey = `comment-attachments/${id}`
  try {
    await putTicketAttachment({
      objectKey,
      body: bytes,
      contentType: inspected.contentType,
      fileName: inspected.fileName,
    })
    await db.insert(commentAttachments).values({
      id,
      draftId,
      uploadedById: userId,
      objectKey,
      fileName: inspected.fileName,
      contentType: inspected.contentType,
      size: file.size,
      isInline: inspected.isInline,
    })
  } catch (error) {
    await deleteTicketAttachmentObject(objectKey).catch(() => undefined)
    console.error("[comment-attachments] upload failed", error)
    return Response.json({ ok: false, error: "upload_failed" }, { status: 502 })
  }

  after(() => cleanupCommentAttachmentObjects())
  return Response.json({
    ok: true,
    attachment: {
      id,
      fileName: inspected.fileName,
      contentType: inspected.contentType,
      size: file.size,
      isInline: inspected.isInline,
      url: commentAttachmentDownloadUrl(id),
    },
  })
}
