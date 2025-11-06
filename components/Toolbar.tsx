export const Toolbar = ({ editor }: { editor: any }) => {
    if (!editor) return null

    const btn = (label: string, fn: () => void, active?: boolean) => (
        <button
            onClick={fn}
            className={`px-2 py-1 border rounded text-sm ${active ? 'bg-black text-white' : 'bg-gray-100'
                }`}
        >
            {label}
        </button>
    )

    return (
        <div className="flex flex-wrap gap-2 mb-2">
            {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
            {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
            {btn('U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            {btn('H', () => editor.chain().focus().toggleHighlight().run(), editor.isActive('highlight'))}

            {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
            {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}

            {btn('UL', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
            {btn('OL', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}

            {btn('Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
            {btn('Code', () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'))}

            {btn('⇦', () => editor.chain().focus().setTextAlign('left').run())}
            {btn('⇨', () => editor.chain().focus().setTextAlign('right').run())}
            {btn('☰', () => editor.chain().focus().setTextAlign('center').run())}

            {btn('Undo', () => editor.chain().focus().undo().run())}
            {btn('Redo', () => editor.chain().focus().redo().run())}
        </div>
    )
}
