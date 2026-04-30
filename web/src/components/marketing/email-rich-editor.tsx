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
  placeholder?: string;
  /** 顯示插入變數與格式工具列 */
  showToolbar?: boolean;
};

export function EmailRichEditor({
  initialHtml,
  onChange,
  disabled,
  className,
  placeholder = "撰寫郵件內文…",
  showToolbar = true,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialHtml || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] px-3 py-2 focus:outline-none",
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
      <div
        className={cn(
          "min-h-[200px] animate-pulse rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900",
          className
        )}
      />
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
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
          <ToolbarBtn
            label="粗體"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
          />
          <ToolbarBtn
            label="斜體"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
          />
          <ToolbarBtn
            label="項目符號"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
          />
          <ToolbarBtn
            label="編號"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
          />
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-600" aria-hidden />
          <button
            type="button"
            disabled={disabled}
            title="實際寫入：{{customer_name}}（發送時會替換為客戶名稱）"
            onClick={() => editor.chain().focus().insertContent("{{customer_name}}").run()}
            className="rounded px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
          >
            插入客戶名稱
          </button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-xs",
        active
          ? "bg-zinc-200 font-medium dark:bg-zinc-700"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
        disabled && "opacity-50"
      )}
    >
      {label}
    </button>
  );
}
