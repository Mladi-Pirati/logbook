import { z } from "zod"

export const MAX_DESCRIPTION_DOCUMENT_BYTES = 256 * 1024
export const MAX_TICKET_ATTACHMENTS = 10

export type RichTextMark = {
  type: "bold" | "italic" | "strike" | "code" | "link"
  attrs?: {
    href: string
    target?: "_blank" | null
    rel?: string | null
    class?: null
    title?: string | null
  }
}

export type RichTextNode = {
  type:
    | "doc"
    | "paragraph"
    | "heading"
    | "blockquote"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "codeBlock"
    | "hardBreak"
    | "text"
    | "mention"
    | "attachment"
  attrs?: Record<string, unknown>
  content?: RichTextNode[]
  marks?: RichTextMark[]
  text?: string
}

export type RichTextDocument = RichTextNode & {
  type: "doc"
  content: RichTextNode[]
}

export type RichTextAttachment = {
  id: string
  fileName: string
  contentType: string
  size: number
  isInline: boolean
}

export type MentionableUser = {
  id: string
  username: string
  firstName: string
  lastName: string
}

export const EMPTY_RICH_TEXT_DOCUMENT: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

const uuidSchema = z.string().uuid()
const blockNodeTypes = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "attachment",
])
const inlineNodeTypes = new Set(["text", "hardBreak", "mention"])
const allowedMarkTypes = new Set(["bold", "italic", "strike", "code", "link"])

export function isSafeRichTextHref(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return true
  try {
    const url = new URL(href)
    return ["http:", "https:", "mailto:"].includes(url.protocol)
  } catch {
    return false
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateMarks(value: unknown): value is RichTextMark[] {
  if (!Array.isArray(value)) return false
  return value.every((mark) => {
    if (!isPlainObject(mark) || typeof mark.type !== "string") return false
    if (!allowedMarkTypes.has(mark.type)) return false
    if (mark.type !== "link") return mark.attrs === undefined
    if (
      !isPlainObject(mark.attrs) ||
      !hasOnlyKeys(mark.attrs, ["href", "target", "rel", "class", "title"]) ||
      typeof mark.attrs.href !== "string" ||
      mark.attrs.href.length > 2048 ||
      !isSafeRichTextHref(mark.attrs.href)
    ) {
      return false
    }
    if (
      mark.attrs.target !== undefined &&
      mark.attrs.target !== null &&
      mark.attrs.target !== "_blank"
    ) {
      return false
    }
    if (
      mark.attrs.rel !== undefined &&
      mark.attrs.rel !== null &&
      mark.attrs.rel !== "noopener noreferrer"
    ) {
      return false
    }
    if (mark.attrs.class !== undefined && mark.attrs.class !== null)
      return false
    return (
      mark.attrs.title === undefined ||
      mark.attrs.title === null ||
      (typeof mark.attrs.title === "string" && mark.attrs.title.length <= 512)
    )
  })
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function validateNode(
  value: unknown,
  parentType?: string,
): value is RichTextNode {
  if (!isPlainObject(value) || typeof value.type !== "string") return false
  if (!hasOnlyKeys(value, ["type", "attrs", "content", "marks", "text"])) {
    return false
  }

  const { type } = value
  if (type === "text") {
    return (
      inlineNodeTypes.has(type) &&
      typeof value.text === "string" &&
      value.text.length <= MAX_DESCRIPTION_DOCUMENT_BYTES &&
      value.attrs === undefined &&
      value.content === undefined &&
      (value.marks === undefined || validateMarks(value.marks))
    )
  }

  if (value.text !== undefined || value.marks !== undefined) return false

  if (type === "hardBreak") {
    return (
      inlineNodeTypes.has(type) &&
      value.attrs === undefined &&
      value.content === undefined &&
      ["paragraph", "heading"].includes(parentType ?? "")
    )
  }

  if (type === "mention") {
    return (
      inlineNodeTypes.has(type) &&
      isPlainObject(value.attrs) &&
      hasOnlyKeys(value.attrs, ["id", "label", "mentionSuggestionChar"]) &&
      typeof value.attrs.id === "string" &&
      value.attrs.id.length > 0 &&
      value.attrs.id.length <= 255 &&
      (value.attrs.label === undefined ||
        value.attrs.label === null ||
        (typeof value.attrs.label === "string" &&
          value.attrs.label.length <= 255)) &&
      (value.attrs.mentionSuggestionChar === undefined ||
        value.attrs.mentionSuggestionChar === "@") &&
      value.content === undefined &&
      ["paragraph", "heading"].includes(parentType ?? "")
    )
  }

  if (type === "attachment") {
    return (
      blockNodeTypes.has(type) &&
      isPlainObject(value.attrs) &&
      hasOnlyKeys(value.attrs, ["id"]) &&
      uuidSchema.safeParse(value.attrs.id).success &&
      value.content === undefined
    )
  }

  const content = value.content
  if (content !== undefined && !Array.isArray(content)) return false
  if (value.attrs !== undefined && !isPlainObject(value.attrs)) return false

  if (type === "doc") {
    return (
      parentType === undefined &&
      value.attrs === undefined &&
      Array.isArray(content) &&
      content.every(
        (child) =>
          isPlainObject(child) &&
          typeof child.type === "string" &&
          blockNodeTypes.has(child.type) &&
          validateNode(child, type),
      )
    )
  }

  if (type === "paragraph") {
    return (
      value.attrs === undefined &&
      (content ?? []).every(
        (child) =>
          isPlainObject(child) &&
          typeof child.type === "string" &&
          inlineNodeTypes.has(child.type) &&
          validateNode(child, type),
      )
    )
  }

  if (type === "heading") {
    return (
      isPlainObject(value.attrs) &&
      hasOnlyKeys(value.attrs, ["level"]) &&
      [1, 2, 3].includes(value.attrs.level as number) &&
      (content ?? []).every(
        (child) =>
          isPlainObject(child) &&
          typeof child.type === "string" &&
          inlineNodeTypes.has(child.type) &&
          validateNode(child, type),
      )
    )
  }

  if (type === "codeBlock") {
    return (
      (value.attrs === undefined ||
        (isPlainObject(value.attrs) &&
          hasOnlyKeys(value.attrs, ["language"]) &&
          (value.attrs.language === null ||
            typeof value.attrs.language === "string"))) &&
      (content ?? []).every(
        (child) =>
          isPlainObject(child) &&
          child.type === "text" &&
          child.marks === undefined &&
          validateNode(child, type),
      )
    )
  }

  if (type === "blockquote") {
    return (
      value.attrs === undefined &&
      Array.isArray(content) &&
      content.length > 0 &&
      content.every(
        (child) =>
          isPlainObject(child) &&
          ["paragraph", "heading"].includes(String(child.type)) &&
          validateNode(child, type),
      )
    )
  }

  if (type === "bulletList" || type === "orderedList") {
    return (
      (value.attrs === undefined ||
        (type === "orderedList" &&
          isPlainObject(value.attrs) &&
          hasOnlyKeys(value.attrs, ["start", "type"]) &&
          Number.isInteger(value.attrs.start) &&
          Number(value.attrs.start) > 0 &&
          (value.attrs.type === null ||
            ["1", "a", "A", "i", "I"].includes(String(value.attrs.type))))) &&
      Array.isArray(content) &&
      content.length > 0 &&
      content.every(
        (child) =>
          isPlainObject(child) &&
          child.type === "listItem" &&
          validateNode(child, type),
      )
    )
  }

  if (type === "listItem") {
    return (
      value.attrs === undefined &&
      ["bulletList", "orderedList"].includes(parentType ?? "") &&
      Array.isArray(content) &&
      content.length > 0 &&
      content[0] &&
      isPlainObject(content[0]) &&
      content[0].type === "paragraph" &&
      content.every(
        (child) =>
          isPlainObject(child) &&
          ["paragraph", "bulletList", "orderedList"].includes(
            String(child.type),
          ) &&
          validateNode(child, type),
      )
    )
  }

  return false
}

function canonicalizeRichTextNode(node: RichTextNode): RichTextNode {
  return {
    ...node,
    ...(node.type === "mention"
      ? { attrs: { id: String(node.attrs?.id ?? "") } }
      : {}),
    ...(node.content
      ? { content: node.content.map(canonicalizeRichTextNode) }
      : {}),
  }
}

export function parseRichTextDocument(value: unknown) {
  let serialized: string
  let documentValue: unknown
  try {
    serialized = JSON.stringify(value)
    documentValue = JSON.parse(serialized) as unknown
  } catch {
    return null
  }
  if (
    new TextEncoder().encode(serialized).byteLength >
    MAX_DESCRIPTION_DOCUMENT_BYTES
  ) {
    return null
  }
  if (!validateNode(documentValue) || documentValue.type !== "doc") return null

  const document = canonicalizeRichTextNode(documentValue) as RichTextDocument
  const attachmentIds = getRichTextAttachmentIds(document)
  if (attachmentIds.length > MAX_TICKET_ATTACHMENTS) return null
  return document
}

export const richTextDocumentSchema = z
  .unknown()
  .transform((value, context) => {
    const document = parseRichTextDocument(value)
    if (!document) {
      context.addIssue({
        code: "custom",
        message: "Invalid rich-text document",
      })
      return z.NEVER
    }
    return document
  })

export function plainTextToRichText(value: string | null | undefined) {
  if (!value) return structuredClone(EMPTY_RICH_TEXT_DOCUMENT)

  const content: RichTextNode[] = []
  const lines = value.split("\n")
  const paragraphContent: RichTextNode[] = []

  for (const [index, line] of lines.entries()) {
    if (line) paragraphContent.push({ type: "text", text: line })
    if (index < lines.length - 1) paragraphContent.push({ type: "hardBreak" })
  }
  content.push({ type: "paragraph", content: paragraphContent })
  return { type: "doc", content } satisfies RichTextDocument
}

function mentionText(node: RichTextNode, mentions?: Map<string, string>) {
  const id = String(node.attrs?.id ?? "")
  return `@${mentions?.get(id) ?? "Unknown user"}`
}

function inlineText(
  node: RichTextNode,
  mentions?: Map<string, string>,
): string {
  if (node.type === "text") return node.text ?? ""
  if (node.type === "hardBreak") return "\n"
  if (node.type === "mention") return mentionText(node, mentions)
  return (node.content ?? [])
    .map((child) => inlineText(child, mentions))
    .join("")
}

export function richTextToPlainText(
  document: RichTextDocument,
  options?: { mentions?: Map<string, string> },
) {
  const blocks: string[] = []

  function visit(node: RichTextNode, listPrefix = "") {
    if (node.type === "attachment") return
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "codeBlock"
    ) {
      blocks.push(`${listPrefix}${inlineText(node, options?.mentions)}`)
      return
    }
    if (node.type === "listItem") {
      node.content?.forEach((child, index) =>
        visit(child, index === 0 ? listPrefix : ""),
      )
      return
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      let index = Number(node.attrs?.start ?? 1)
      node.content?.forEach((child) => {
        visit(child, node.type === "bulletList" ? "• " : `${index}. `)
        index += 1
      })
      return
    }
    node.content?.forEach((child) => visit(child))
  }

  visit(document)
  return blocks.join("\n").trim() || null
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1")
}

function markdownInline(
  node: RichTextNode,
  mentions?: Map<string, string>,
): string {
  if (node.type === "hardBreak") return "  \n"
  if (node.type === "mention") {
    return escapeMarkdown(mentionText(node, mentions))
  }
  if (node.type !== "text")
    return (node.content ?? [])
      .map((child) => markdownInline(child, mentions))
      .join("")

  let value = escapeMarkdown(node.text ?? "")
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") value = `**${value}**`
    if (mark.type === "italic") value = `*${value}*`
    if (mark.type === "strike") value = `~~${value}~~`
    if (mark.type === "code") value = `\`${value.replaceAll("`", "\\`")}\``
    if (mark.type === "link" && mark.attrs?.href) {
      value = `[${value}](${mark.attrs.href})`
    }
  }
  return value
}

export function richTextToDiscordMarkdown(
  document: RichTextDocument,
  options?: {
    baseUrl?: string
    attachments?: Map<string, Pick<RichTextAttachment, "fileName">>
    attachmentBasePath?: string
    mentions?: Map<string, string>
  },
) {
  function render(node: RichTextNode, depth = 0): string {
    if (
      node.type === "text" ||
      node.type === "hardBreak" ||
      node.type === "mention"
    ) {
      return markdownInline(node, options?.mentions)
    }
    if (node.type === "paragraph")
      return (node.content ?? [])
        .map((child) => markdownInline(child, options?.mentions))
        .join("")
    if (node.type === "heading") {
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${(node.content ?? []).map((child) => markdownInline(child, options?.mentions)).join("")}`
    }
    if (node.type === "blockquote") {
      return (node.content ?? [])
        .map((child) =>
          render(child, depth)
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        )
        .join("\n")
    }
    if (node.type === "codeBlock") {
      return `\`\`\`\n${inlineText(node, options?.mentions)}\n\`\`\``
    }
    if (node.type === "attachment") {
      const id = String(node.attrs?.id ?? "")
      const name = options?.attachments?.get(id)?.fileName ?? "Attachment"
      const path = `${options?.attachmentBasePath ?? "/api/ticket-attachments"}/${id}`
      return options?.baseUrl
        ? `[📎 ${escapeMarkdown(name)}](${options.baseUrl}${path})`
        : `📎 ${escapeMarkdown(name)}`
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      let index = Number(node.attrs?.start ?? 1)
      return (node.content ?? [])
        .map((child) => {
          const prefix = node.type === "bulletList" ? "- " : `${index++}. `
          return `${"  ".repeat(depth)}${prefix}${render(child, depth + 1)}`
        })
        .join("\n")
    }
    if (node.type === "listItem") {
      return (node.content ?? [])
        .map((child, index) =>
          index === 0 ? render(child, depth) : `\n${render(child, depth)}`,
        )
        .join("")
    }
    return (node.content ?? [])
      .map((child) => render(child, depth))
      .join("\n\n")
  }

  return render(document).trim() || null
}

export function getRichTextAttachmentIds(document: RichTextDocument) {
  const ids: string[] = []
  const seen = new Set<string>()

  function visit(node: RichTextNode) {
    if (node.type === "attachment") {
      const id = String(node.attrs?.id ?? "")
      if (id && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    node.content?.forEach(visit)
  }

  visit(document)
  return ids
}

export function getRichTextMentionIds(document: RichTextDocument) {
  const ids: string[] = []
  const seen = new Set<string>()

  function visit(node: RichTextNode) {
    if (node.type === "mention") {
      const id = String(node.attrs?.id ?? "")
      if (id && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    node.content?.forEach(visit)
  }

  visit(document)
  return ids
}

export function isEmptyRichTextDocument(document: RichTextDocument) {
  return (
    richTextToPlainText(document) === null &&
    getRichTextAttachmentIds(document).length === 0
  )
}
