"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { mergeAttributes, Node, type Editor } from "@tiptap/core"
import Mention from "@tiptap/extension-mention"
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  ReactRenderer,
  type NodeViewProps,
  useEditor,
  useEditorState,
} from "@tiptap/react"
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion"
import StarterKit from "@tiptap/starter-kit"
import {
  ArrowClockwiseIcon,
  ArrowCounterClockwiseIcon,
  CodeBlockIcon,
  CodeIcon,
  FileIcon,
  LinkIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  PaperclipIcon,
  QuotesIcon,
  SpinnerGapIcon,
  TextBIcon,
  TextHOneIcon,
  TextHThreeIcon,
  TextHTwoIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  isSafeRichTextHref,
  MAX_TICKET_ATTACHMENTS,
  type MentionableUser,
  type RichTextAttachment,
  type RichTextDocument,
} from "@/lib/rich-text"

type EditorAttachment = RichTextAttachment & {
  url: string
  isDraft: boolean
}

type AttachmentExtensionOptions = {
  getAttachment: (id: string) => EditorAttachment | undefined
  removeAttachment: (attachment: EditorAttachment) => void
}

const TicketAttachmentNode = Node.create<AttachmentExtensionOptions>({
  name: "attachment",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      getAttachment: () => undefined,
      removeAttachment: () => undefined,
    }
  },

  addAttributes() {
    return { id: { default: null } }
  },

  parseHTML() {
    return [{ tag: "div[data-ticket-attachment]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-ticket-attachment": "", ...HTMLAttributes }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentNodeView)
  },
})

function AttachmentNodeView({
  node,
  extension,
  deleteNode,
  selected,
}: NodeViewProps) {
  const options = extension.options as AttachmentExtensionOptions
  const attachment = options.getAttachment(String(node.attrs.id))

  if (!attachment) {
    return (
      <NodeViewWrapper
        className="my-2 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
        contentEditable={false}
      >
        Attachment unavailable
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      className={cn(
        "group/attachment relative my-2 border bg-muted/30 p-2",
        selected && "border-ring ring-1 ring-ring/40",
      )}
      contentEditable={false}
      data-drag-handle
    >
      {attachment.isInline ? (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer">
          {/* Private authenticated object route; dimensions are not known at edit time. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.fileName}
            className="max-h-80 max-w-full object-contain"
          />
        </a>
      ) : (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2 pr-8 text-sm hover:underline"
        >
          <FileIcon className="size-5 shrink-0" />
          <span className="truncate">{attachment.fileName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </span>
        </a>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Remove attachment"
        className="absolute right-2 top-2 opacity-70 hover:opacity-100"
        onClick={() => {
          options.removeAttachment(attachment)
          deleteNode()
        }}
      >
        <TrashIcon />
      </Button>
    </NodeViewWrapper>
  )
}

type UploadState = {
  id: string
  file: File
  status: "uploading" | "failed"
  error?: string
}

type MentionListProps = SuggestionProps<MentionableUser, { id: string }>
type MentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const safeSelectedIndex = Math.min(
      selectedIndex,
      Math.max(items.length - 1, 0),
    )

    function selectItem(index: number) {
      const item = items[index]
      if (item) command({ id: item.id })
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false
        if (event.key === "ArrowUp") {
          setSelectedIndex((index) => (index + items.length - 1) % items.length)
          return true
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((index) => (index + 1) % items.length)
          return true
        }
        if (event.key === "Enter") {
          selectItem(safeSelectedIndex)
          return true
        }
        return false
      },
    }))

    return (
      <div
        className="min-w-64 overflow-hidden border bg-popover p-1 text-popover-foreground shadow-md"
        role="listbox"
        aria-label="Mention a user"
      >
        {items.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No users found
          </div>
        ) : (
          items.map((user, index) => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={index === safeSelectedIndex}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm",
                index === safeSelectedIndex &&
                  "bg-accent text-accent-foreground",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(index)}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {user.firstName.slice(0, 1)}
                {user.lastName.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {user.firstName} {user.lastName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                @{user.username}
              </span>
            </button>
          ))
        )}
      </div>
    )
  },
)

export function RichTextEditor({
  value,
  attachments,
  users,
  draftId,
  attachmentBasePath = "/api/ticket-attachments",
  disabled,
  onChange,
  onPendingChange,
  onDraftAttachmentsChange,
}: {
  value: RichTextDocument
  attachments: RichTextAttachment[]
  users: MentionableUser[]
  draftId: string
  attachmentBasePath?: string
  disabled?: boolean
  onChange: (value: RichTextDocument) => void
  onPendingChange: (pending: boolean) => void
  onDraftAttachmentsChange?: (ids: string[]) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const usersRef = useRef(users)
  usersRef.current = users
  const attachmentMapRef = useRef(
    new Map<string, EditorAttachment>(
      attachments.map((attachment) => [
        attachment.id,
        {
          ...attachment,
          url: `${attachmentBasePath}/${attachment.id}`,
          isDraft: false,
        },
      ]),
    ),
  )
  const [attachmentVersion, setAttachmentVersion] = useState(0)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [draftAttachmentIds, setDraftAttachmentIds] = useState<string[]>([])

  useEffect(() => {
    const currentDrafts = new Map(
      [...attachmentMapRef.current.values()]
        .filter((attachment) => attachment.isDraft)
        .map((attachment) => [attachment.id, attachment]),
    )
    attachmentMapRef.current = new Map([
      ...attachments.map(
        (attachment) =>
          [
            attachment.id,
            {
              ...attachment,
              url: `${attachmentBasePath}/${attachment.id}`,
              isDraft: false,
            },
          ] as const,
      ),
      ...currentDrafts,
    ])
    setAttachmentVersion((version) => version + 1)
  }, [attachmentBasePath, attachments])

  useEffect(() => {
    onPendingChange(uploads.some((upload) => upload.status === "uploading"))
  }, [onPendingChange, uploads])

  useEffect(() => {
    onDraftAttachmentsChange?.(draftAttachmentIds)
  }, [draftAttachmentIds, onDraftAttachmentsChange])

  const extension = useMemo(
    () =>
      TicketAttachmentNode.configure({
        getAttachment: (id) => attachmentMapRef.current.get(id),
        removeAttachment: (attachment) => {
          attachmentMapRef.current.delete(attachment.id)
          setAttachmentVersion((version) => version + 1)
          if (attachment.isDraft) {
            setDraftAttachmentIds((ids) =>
              ids.filter((id) => id !== attachment.id),
            )
            void fetch(`${attachmentBasePath}/${attachment.id}`, {
              method: "DELETE",
            })
          }
        },
      }),
    [attachmentBasePath],
  )

  const mentionExtension = useMemo(
    () =>
      Mention.extend({
        addAttributes() {
          return {
            id: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-id"),
              renderHTML: (attributes) =>
                attributes.id ? { "data-id": attributes.id } : {},
            },
          }
        },
      }).configure({
        HTMLAttributes: {
          class:
            "inline-flex rounded-sm bg-primary/10 px-1 font-medium text-primary",
        },
        renderText: ({ node }) =>
          `@${mentionDisplayName(usersRef.current, String(node.attrs.id))}`,
        renderHTML: ({ node, options }) => [
          "span",
          mergeAttributes(options.HTMLAttributes, {
            "data-type": "mention",
            "data-id": node.attrs.id,
          }),
          `@${mentionDisplayName(usersRef.current, String(node.attrs.id))}`,
        ],
        suggestion: {
          char: "@",
          // Keep the popup inside Base UI's modal tree. A body-level portal is
          // visually covered and made non-interactive by the dialog backdrop.
          container: '[data-slot="dialog-content"]',
          items: ({ query }) => {
            const normalizedQuery = query.trim().toLocaleLowerCase()
            return usersRef.current
              .filter((user) => {
                if (!normalizedQuery) return true
                return [
                  user.username,
                  user.firstName,
                  user.lastName,
                  `${user.firstName} ${user.lastName}`,
                ].some((value) =>
                  value.toLocaleLowerCase().includes(normalizedQuery),
                )
              })
              .slice(0, 8)
          },
          render: () => {
            let component:
              ReactRenderer<MentionListHandle, MentionListProps> | undefined
            let unmount: (() => void) | undefined

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                  className: "z-50",
                })
                unmount = props.mount(component.element)
              },
              onUpdate: (props) => component?.updateProps(props),
              onKeyDown: (props) => component?.ref?.onKeyDown(props) ?? false,
              onExit: () => {
                unmount?.()
                component?.destroy()
              },
            }
          },
        },
      }),
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: value,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          defaultProtocol: "https",
          isAllowedUri: (url, context) =>
            context.defaultValidate(url) && isSafeRichTextHref(url),
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
          },
        },
      }),
      mentionExtension,
      extension,
    ],
    editorProps: {
      attributes: {
        class:
          "min-h-40 px-3 py-2 text-sm outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-medium [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6",
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])]
        if (files.length === 0) return false
        event.preventDefault()
        void uploadFiles(files)
        return true
      },
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])]
        if (files.length === 0) return false
        event.preventDefault()
        void uploadFiles(files)
        return true
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON() as RichTextDocument)
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  async function uploadFiles(files: File[]) {
    if (!editor || disabled) return
    const currentCount = attachmentMapRef.current.size + uploads.length
    const available = Math.max(0, MAX_TICKET_ATTACHMENTS - currentCount)
    const accepted = files.slice(0, available)
    if (accepted.length === 0) return

    const queued = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "uploading" as const,
    }))
    setUploads((current) => [...current, ...queued])

    await Promise.all(
      queued.map(async (upload) => {
        const formData = new FormData()
        formData.set("draftId", draftId)
        formData.set("file", upload.file)

        try {
          const response = await fetch(attachmentBasePath, {
            method: "POST",
            body: formData,
          })
          const result = (await response.json()) as {
            ok: boolean
            error?: string
            attachment?: RichTextAttachment & { url: string }
          }
          if (!response.ok || !result.ok || !result.attachment) {
            throw new Error(uploadErrorMessage(result.error))
          }

          const attachment: EditorAttachment = {
            ...result.attachment,
            isDraft: true,
          }
          attachmentMapRef.current.set(attachment.id, attachment)
          setAttachmentVersion((version) => version + 1)
          setDraftAttachmentIds((ids) => [...ids, attachment.id])
          editor
            .chain()
            .focus()
            .insertContent({
              type: "attachment",
              attrs: { id: attachment.id },
            })
            .run()
          setUploads((current) =>
            current.filter((item) => item.id !== upload.id),
          )
        } catch (error) {
          setUploads((current) =>
            current.map((item) =>
              item.id === upload.id
                ? {
                    ...item,
                    status: "failed",
                    error:
                      error instanceof Error ? error.message : "Upload failed",
                  }
                : item,
            ),
          )
        }
      }),
    )
  }

  // Node views resolve metadata through a ref; this state read refreshes them.
  void attachmentVersion

  return (
    <div className="overflow-hidden border border-input bg-background">
      <EditorToolbar
        editor={editor}
        disabled={disabled}
        onAttach={() => fileInputRef.current?.click()}
      />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.zip,.rar,.7z,.gz,.tar"
        onChange={(event) => {
          void uploadFiles([...(event.target.files ?? [])])
          event.target.value = ""
        }}
      />
      {uploads.length > 0 && (
        <div className="grid gap-1 border-t bg-muted/20 p-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              {upload.status === "uploading" ? (
                <SpinnerGapIcon className="animate-spin" />
              ) : (
                <WarningCircleIcon className="text-destructive" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {upload.file.name}
              </span>
              {upload.status === "failed" && (
                <>
                  <span className="text-destructive">{upload.error}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setUploads((current) =>
                        current.filter((item) => item.id !== upload.id),
                      )
                      void uploadFiles([upload.file])
                    }}
                  >
                    Retry
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    title="Remove failed upload"
                    onClick={() =>
                      setUploads((current) =>
                        current.filter((item) => item.id !== upload.id),
                      )
                    }
                  >
                    <TrashIcon />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditorToolbar({
  editor,
  disabled,
  onAttach,
}: {
  editor: Editor | null
  disabled?: boolean
  onAttach: () => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      strike: currentEditor?.isActive("strike") ?? false,
      code: currentEditor?.isActive("code") ?? false,
      heading1: currentEditor?.isActive("heading", { level: 1 }) ?? false,
      heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      heading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
      codeBlock: currentEditor?.isActive("codeBlock") ?? false,
      link: currentEditor?.isActive("link") ?? false,
    }),
  })

  const inactive = disabled || !editor
  const buttons = [
    {
      title: "Bold",
      icon: TextBIcon,
      active: state?.bold,
      action: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      title: "Italic",
      icon: TextItalicIcon,
      active: state?.italic,
      action: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      title: "Strike",
      icon: TextStrikethroughIcon,
      active: state?.strike,
      action: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      title: "Inline code",
      icon: CodeIcon,
      active: state?.code,
      action: () => editor?.chain().focus().toggleCode().run(),
    },
    {
      title: "Heading 1",
      icon: TextHOneIcon,
      active: state?.heading1,
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: "Heading 2",
      icon: TextHTwoIcon,
      active: state?.heading2,
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: "Heading 3",
      icon: TextHThreeIcon,
      active: state?.heading3,
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: "Bullet list",
      icon: ListBulletsIcon,
      active: state?.bulletList,
      action: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      title: "Numbered list",
      icon: ListNumbersIcon,
      active: state?.orderedList,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      title: "Quote",
      icon: QuotesIcon,
      active: state?.blockquote,
      action: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      title: "Code block",
      icon: CodeBlockIcon,
      active: state?.codeBlock,
      action: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
  ]

  function editLink() {
    if (!editor) return
    const current = String(editor.getAttributes("link").href ?? "")
    const href = window.prompt("Link URL", current)
    if (href === null) return
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    if (!isSafeRichTextHref(href)) return
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/20 p-1">
      {buttons.map(({ title, icon: Icon, active, action }) => (
        <Button
          key={title}
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon-xs"
          title={title}
          disabled={inactive}
          onClick={action}
        >
          <Icon />
        </Button>
      ))}
      <Button
        type="button"
        variant={state?.link ? "secondary" : "ghost"}
        size="icon-xs"
        title="Add or edit link"
        disabled={inactive}
        onClick={editLink}
      >
        <LinkIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Attach files"
        disabled={inactive}
        onClick={onAttach}
      >
        <PaperclipIcon />
      </Button>
      <span className="mx-1 h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Undo"
        disabled={inactive || !editor?.can().undo()}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <ArrowCounterClockwiseIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Redo"
        disabled={inactive || !editor?.can().redo()}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <ArrowClockwiseIcon />
      </Button>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function uploadErrorMessage(error?: string) {
  if (error === "attachment_limit") return "Maximum 10 files"
  if (error === "unsupported_file_type") return "Unsupported file type"
  if (error === "invalid_upload") return "File exceeds the 25 MB limit"
  return "Upload failed"
}

function mentionDisplayName(users: MentionableUser[], id: string) {
  const user = users.find((candidate) => candidate.id === id)
  return user ? `${user.firstName} ${user.lastName}` : "Unknown user"
}
