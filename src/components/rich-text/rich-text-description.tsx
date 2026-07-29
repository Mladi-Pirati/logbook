"use client"

import type { ReactNode } from "react"
import {
  renderJSONContentToReactElement,
  type MarkProps,
  type NodeProps,
} from "@tiptap/static-renderer/json/react"
import { FileIcon } from "@phosphor-icons/react"
import {
  isEmptyRichTextDocument,
  isSafeRichTextHref,
  type MentionableUser,
  type RichTextAttachment,
  type RichTextDocument,
  type RichTextMark,
  type RichTextNode,
} from "@/lib/rich-text"

export function RichTextDescription({
  document,
  attachments,
  users,
  attachmentBasePath = "/api/ticket-attachments",
  emptyLabel = "No description.",
}: {
  document: RichTextDocument
  attachments: RichTextAttachment[]
  users: MentionableUser[]
  attachmentBasePath?: string
  emptyLabel?: string | null
}) {
  if (isEmptyRichTextDocument(document)) {
    return emptyLabel ? (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    ) : null
  }

  const attachmentMap = new Map(
    attachments.map((attachment) => [attachment.id, attachment]),
  )
  const userMap = new Map(users.map((user) => [user.id, user]))
  const render = renderJSONContentToReactElement<RichTextMark, RichTextNode>({
    nodeMapping: {
      doc: ({ children }: NodeProps<RichTextNode, ReactNode>) => (
        <>{children}</>
      ),
      text: ({ node }: NodeProps<RichTextNode, ReactNode>) => node.text ?? "",
      hardBreak: () => <br />,
      mention: ({ node }) => {
        const user = userMap.get(String(node.attrs?.id ?? ""))
        return (
          <span className="inline-flex rounded-sm bg-primary/10 px-1 font-medium text-primary">
            @{user ? `${user.firstName} ${user.lastName}` : "Unknown user"}
          </span>
        )
      },
      paragraph: ({ children }) => <p>{children}</p>,
      heading: ({ node, children }) => {
        const level = Number(node.attrs?.level ?? 1)
        if (level === 2) return <h2>{children}</h2>
        if (level === 3) return <h3>{children}</h3>
        return <h1>{children}</h1>
      },
      blockquote: ({ children }) => <blockquote>{children}</blockquote>,
      bulletList: ({ children }) => <ul>{children}</ul>,
      orderedList: ({ node, children }) => (
        <ol start={Number(node.attrs?.start ?? 1)}>{children}</ol>
      ),
      listItem: ({ children }) => <li>{children}</li>,
      codeBlock: ({ children }) => (
        <pre>
          <code>{children}</code>
        </pre>
      ),
      attachment: ({ node }) => {
        const attachment = attachmentMap.get(String(node.attrs?.id ?? ""))
        if (!attachment) return null
        const url = `${attachmentBasePath}/${attachment.id}`
        if (attachment.isInline) {
          return (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {/* Private authenticated object route; intrinsic size is unavailable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={attachment.fileName}
                className="max-h-[32rem] max-w-full object-contain"
              />
            </a>
          )
        }
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border bg-muted/20 p-3 hover:bg-muted/40"
          >
            <FileIcon className="size-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {attachment.fileName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </span>
          </a>
        )
      },
    },
    markMapping: {
      bold: ({ children }: MarkProps<RichTextMark, ReactNode>) => (
        <strong>{children}</strong>
      ),
      italic: ({ children }) => <em>{children}</em>,
      strike: ({ children }) => <s>{children}</s>,
      code: ({ children }) => <code>{children}</code>,
      link: ({ mark, children }) => {
        const href = mark.attrs?.href ?? ""
        if (!isSafeRichTextHref(href)) return <>{children}</>
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        )
      },
    },
    unhandledNode: () => null,
    unhandledMark: ({ children }) => <>{children}</>,
  })

  return (
    <div className="grid gap-3 text-sm [&_a]:text-primary [&_a]:underline-offset-2 [&_a:hover]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-medium [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:whitespace-pre-wrap [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6">
      {render({ content: document })}
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
