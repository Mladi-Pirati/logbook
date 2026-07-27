"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

export const RichTextEditor = dynamic(
  () =>
    import("@/components/rich-text/rich-text-editor").then(
      (module) => module.RichTextEditor,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full" />,
  },
)
