"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Heading from "@tiptap/extension-heading";
import { Toolbar } from "./Toolbar";
import "@/styles/tiptap.css"

export default function Tiptap() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // ❗ Tắt heading mặc định để thay bằng bản custom có input rules
      }),

      // 🔥 Heading có hỗ trợ markdown input rules (# + space)
      Heading.extend({
        addInputRules() {
          return [
            {
              find: /^(#{1,3})\s$/,
              handler: ({ state, range, match, chain }) => {
                const level = match[1].length;
                chain().deleteRange(range).toggleHeading({ level }).run();
              },
            },
          ];
        },
      }).configure({
        levels: [1, 2, 3],
      }),

      Placeholder.configure({
        placeholder: 'Gõ nội dung… hoặc thử "# Tiêu đề 1"',
      }),
    ],
    content: "<p>Thử gõ: # Tiêu đề 1</p>",
    immediatelyRender: false,
  });

  return (
    <div className="w-full h-full bg-white border border-gray-300 rounded-md shadow-sm p-4">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="tiptap prose prose-lg max-w-none flex-1 p-4 overflow-auto"
      />
    </div>
  );
}
