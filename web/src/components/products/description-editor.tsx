"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

type Props = {
  initialHtml: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
};

export function DescriptionEditor({ initialHtml, onChange, disabled, className }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: "輸入產品描述…" }),
    ],
    content: initialHtml || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[140px] px-3 py-2 focus:outline-none",
          "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className={cn("min-h-[140px] animate-pulse rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900", className)} />
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950",
        disabled && "opacity-70",
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
