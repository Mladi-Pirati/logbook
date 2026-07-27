import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { ticketAttachments } from "@/db/schema"

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const DRAFT_ATTACHMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000

const s3ConfigSchema = z.object({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  region: z.string().min(1),
  endpoint: z.string().url().optional(),
  bucket: z.string().min(1),
})

const allowedExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "pdf",
  "txt",
  "md",
  "csv",
  "json",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "zip",
  "rar",
  "7z",
  "gz",
  "tar",
])

const allowedContentTypes = new Set([
  "application/octet-stream",
  "application/pdf",
  "application/json",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/zip",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/gzip",
  "application/x-tar",
  "text/plain",
  "text/markdown",
  "text/csv",
])

let cachedClient: S3Client | undefined
let cachedBucket: string | undefined

function getS3Config() {
  return s3ConfigSchema.parse({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    bucket: process.env.S3_BUCKET,
  })
}

function getS3() {
  if (cachedClient && cachedBucket) {
    return { client: cachedClient, bucket: cachedBucket }
  }
  const config = getS3Config()
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  cachedBucket = config.bucket
  return { client: cachedClient, bucket: cachedBucket }
}

function fileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

export function sanitizeAttachmentFileName(fileName: string) {
  const sanitized = fileName
    .normalize("NFKC")
    .replaceAll(/[\u0000-\u001f\u007f/\\]/g, "_")
    .trim()
    .slice(0, 255)
  return sanitized || "attachment"
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

function verifiedInlineImageType(bytes: Uint8Array) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif"
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

export function inspectAttachment(
  fileName: string,
  declaredContentType: string,
  bytes: Uint8Array,
) {
  const safeFileName = sanitizeAttachmentFileName(fileName)
  const extension = fileExtension(safeFileName)
  if (!allowedExtensions.has(extension)) return null

  const inlineContentType = verifiedInlineImageType(bytes)
  if (inlineContentType) {
    const allowedImageExtension =
      (inlineContentType === "image/jpeg" &&
        (extension === "jpg" || extension === "jpeg")) ||
      extension === inlineContentType.slice("image/".length)
    if (!allowedImageExtension) return null
    return {
      fileName: safeFileName,
      contentType: inlineContentType,
      isInline: true,
    }
  }

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) return null
  const normalizedContentType = declaredContentType
    .split(";")[0]
    ?.trim()
    .toLowerCase()
  return {
    fileName: safeFileName,
    contentType: allowedContentTypes.has(normalizedContentType)
      ? normalizedContentType
      : "application/octet-stream",
    isInline: false,
  }
}

export async function putTicketAttachment(input: {
  objectKey: string
  body: Uint8Array
  contentType: string
  fileName: string
}) {
  const { client, bucket } = getS3()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.contentType,
      Metadata: { filename: encodeURIComponent(input.fileName) },
    }),
  )
}

export async function getTicketAttachmentObject(objectKey: string) {
  const { client, bucket } = getS3()
  return client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
}

export async function deleteTicketAttachmentObject(objectKey: string) {
  const { client, bucket } = getS3()
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }),
  )
}

export async function cleanupTicketAttachmentObjects(limit = 25) {
  const cutoff = new Date(Date.now() - DRAFT_ATTACHMENT_MAX_AGE_MS)
  const candidates = await db
    .select({
      id: ticketAttachments.id,
      objectKey: ticketAttachments.objectKey,
    })
    .from(ticketAttachments)
    .where(
      or(
        isNotNull(ticketAttachments.deletedAt),
        and(
          isNull(ticketAttachments.ticketId),
          lt(ticketAttachments.createdAt, cutoff),
        ),
      ),
    )
    .limit(limit)

  await Promise.allSettled(
    candidates.map(async (attachment) => {
      await deleteTicketAttachmentObject(attachment.objectKey)
      await db
        .delete(ticketAttachments)
        .where(eq(ticketAttachments.id, attachment.id))
    }),
  )
}

export function attachmentDownloadUrl(id: string) {
  return `/api/ticket-attachments/${id}`
}
